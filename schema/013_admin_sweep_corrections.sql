-- Manhaj schema · 013_admin_sweep_corrections.sql
-- ============================================================================
-- Full-sweep corrections from handover_phase1_admin.pdf
-- Applied via Supabase MCP on 2026-06-28 (migration version admin_sweep_corrections).
--
-- Gaps found after reading every section of the admin PDF against all live tables:
--
--   Gap 1: school_admins — `is_active boolean` cannot represent the pending-invite
--           state that the spec explicitly requires (active / pending / inactive).
--           Added `status text CHECK (... IN ('active','pending','inactive'))`.
--
--   Gap 2: report_archive — PDF §8 says "archived with the same student_id /
--           parent_id so 'what did this family receive, and when' is answerable."
--           The generic scope_ref_id cannot satisfy this. Added student_id + parent_id
--           FK columns (nullable — school/section-scoped reports leave them NULL).
--
-- All other tables checked were fully aligned:
--   invitations, ai_briefings, ai_usage_ledger, risk_flags, applicants, students,
--   staff_absences (starts_on ≡ start_date), timetable_slots, substitutions,
--   comm_drafts, comm_templates, consent_records, audit_log, attendance_marks,
--   regulatory_report_catalog, v_assessment_oversight (view already correct).
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. school_admins.status
--    PDF spec shows status: active | pending | inactive
--    is_active (boolean) cannot represent the pending invite state.
--    Add status, seed from is_active, add check constraint.
-- ============================================================
ALTER TABLE school_admins
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'inactive'));

-- Seed: existing deactivated rows → inactive
UPDATE school_admins SET status = 'inactive' WHERE is_active = false;

-- ============================================================
-- 2. report_archive — student_id + parent_id
--    PDF §8: "archived with the same student_id / parent_id so
--    'what did this family receive, and when' is answerable"
--    scope_ref_id (generic) is kept for school/section-scoped reports.
-- ============================================================
ALTER TABLE report_archive
    ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students(id),
    ADD COLUMN IF NOT EXISTS parent_id  uuid REFERENCES parents(id);
