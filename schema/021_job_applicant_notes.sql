-- Manhaj schema · 021_job_applicant_notes.sql
-- ============================================================================
-- Sprint 1.6 — A6 (Admin hiring pipeline): applicant status-history / comments
-- (see docs/pm/sprints/sprint-1.6-plan.md task 1.6-A6-db,
--  docs/pm/reviews/2026-07-24-admin-dashboard-1.5-feedback.md item A6)
--
-- DRAFT — do NOT apply to the live DB without explicit approval.
-- NOT APPLIED. Awaiting Elias sign-off; then applied via PR/CI as the other
-- numbered migrations are.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DO-block guards throughout).
--
-- WHAT THIS COVERS
--   Adds ONE new table, `job_applicant_notes`, an append-only timeline keyed to
--   `job_applicants`. It backs the A6 hiring-pipeline Edit flow, which must let
--   admins / hiring managers:
--     - change an applicant's status,
--     - record a comment on EVERY status change,
--     - post general comments (no status change), and
--     - read the full comment/status history ordered by time.
--   A single table serves both cases: a row with `to_status` set is a
--   status-change event (from→to captured); a row with only `comment` is a
--   general comment. This keeps one chronological history per applicant.
--
-- DESIGN NOTES
--   - Enum reuse: `from_status` / `to_status` reuse the EXISTING
--     `applicant_status` enum type used by `job_applicants.status` — no parallel
--     enum is invented. We reference the TYPE, not literal values, so the table
--     stays correct regardless of the enum's live value set (see drift note).
--   - Append-only: this is an audit trail, so there is NO updated_at column and
--     NO update trigger (matches `behaviour_notes`, which is also created_at
--     only). Corrections are made by adding a new row, never by mutating history.
--   - `created_by` → school_admins(id) ON DELETE SET NULL: mirrors the "who did
--     this" columns on comparable admin-facing tables (020 teacher_contracts
--     .contract_uploaded_by, applicants.owner_admin_id, staff_absences
--     .approved_by). Nullable so history survives an admin record being removed.
--   - ON DELETE CASCADE from job_applicants: if an applicant row is deleted its
--     history goes with it (the history has no meaning without the applicant).
--   - CHECK constraints enforce the A6 rules at the DB level:
--       * a row must carry a comment OR a status change (no empty rows);
--       * a status change (to_status set) MUST carry a non-blank comment —
--         i.e. "comment on every status change" is guaranteed by the database,
--         not only by the UI.
--
-- RLS
--   RLS ON, with the standard tenant-isolation policy the rest of the schema
--   uses: FOR ALL USING/ WITH CHECK (school_id = tenant_id()) — identical to
--   job_applicants, job_postings, school_admins, and the 020 new tables. This
--   scopes every read/write to the caller's own school. Admin/staff access is
--   governed the same way the rest of the admin surface is (all admin queries
--   run under a JWT whose app_metadata.school_id feeds tenant_id()).
--
-- SEED / DEMO (flag only — NOT seeded here)
--   The hiring-pipeline UI currently renders MOCK funnel numbers. For the demo
--   buckets and history view to be non-empty against real data, the pipeline
--   needs real `job_applicants` rows and a few `job_applicant_notes` rows.
--   Those are LIVE WRITES and are intentionally NOT included in this migration.
--   Recommend either (a) an OR-fallback to mock in the UI when a school has no
--   applicants, or (b) a separate, explicitly-approved seed step. Do NOT seed
--   live data as part of applying this schema change.
--
-- KNOWN DRIFT (carried from 020's header, relevant here)
--   `job_applicants` and the current shape of the `applicant_status` enum were
--   created by an untracked live migration `20260629105834 admin_corrections`
--   (no file in schema/). Per 020's header the live enum is
--   (new/screening/interview/offer_sent/accepted/rejected/withdrawn); the
--   tracked 011 defined an earlier value set. This file targets the LIVE shapes
--   (it references the enum TYPE and the live `job_applicants` table, exactly as
--   020 does) and does not depend on which value set is live. A read-only verify
--   of `job_applicants` (has school_id, status applicant_status) and the enum
--   should be run at review time before apply.
-- ============================================================================

SET search_path = public;

-- ============================================================
-- job_applicant_notes — append-only status-change + comment history
-- ============================================================
CREATE TABLE IF NOT EXISTS job_applicant_notes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES schools(id),
    applicant_id  uuid NOT NULL REFERENCES job_applicants(id) ON DELETE CASCADE,
    from_status   applicant_status,           -- status before the change; NULL for a general comment
    to_status     applicant_status,           -- status after the change; NULL for a general comment
    comment       text,                        -- required when to_status is set (see CHECK)
    created_by    uuid REFERENCES school_admins(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),

    -- No empty rows: a note must carry a comment or represent a status change.
    CONSTRAINT job_applicant_notes_nonempty_chk
        CHECK (comment IS NOT NULL OR to_status IS NOT NULL),

    -- "Comment on every status change": if a status change is recorded, a
    -- non-blank comment is mandatory.
    CONSTRAINT job_applicant_notes_status_comment_chk
        CHECK (to_status IS NULL OR (comment IS NOT NULL AND btrim(comment) <> ''))
);

ALTER TABLE job_applicant_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'job_applicant_notes'
          AND policyname = 'tenant_isolation_job_applicant_notes'
    ) THEN
        CREATE POLICY tenant_isolation_job_applicant_notes ON job_applicant_notes
            FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());
    END IF;
END $$;

-- Full-history reads: newest-first per applicant within a tenant.
CREATE INDEX IF NOT EXISTS idx_job_applicant_notes_applicant
    ON job_applicant_notes (school_id, applicant_id, created_at DESC);

COMMENT ON TABLE  job_applicant_notes            IS 'Append-only history for a job applicant: status-change events (from/to + mandatory comment) and general comments. Backs the A6 hiring-pipeline Edit flow (status change + comment + full history).';
COMMENT ON COLUMN job_applicant_notes.from_status IS 'Applicant status before the change (reuses applicant_status enum). NULL for a general comment.';
COMMENT ON COLUMN job_applicant_notes.to_status   IS 'Applicant status after the change (reuses applicant_status enum). NULL for a general comment; when set, comment is required.';
COMMENT ON COLUMN job_applicant_notes.comment     IS 'Free-text comment. Mandatory (non-blank) on a status change; the sole content of a general comment.';
COMMENT ON COLUMN job_applicant_notes.created_by  IS 'The admin/hiring manager who recorded the note (school_admins.id). NULL if that admin record is later removed.';

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   DROP TABLE IF EXISTS job_applicant_notes;
--   -- (drops the table, its RLS policy, index, and constraints together)
-- ============================================================================
