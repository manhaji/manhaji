-- Manhaj schema · 020_sprint15_feedback.sql
-- ============================================================================
-- Sprint 1.5 — schema gaps from Elias's Phase-1 review feedback
-- (see docs/pm/sprints/sprint-1.5-plan.md, SCHEMA-tagged items)
--
-- DRAFT — do NOT apply to the live DB without explicit approval.
-- Validated against the live DB inside BEGIN…ROLLBACK on 2026-07-19.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DO-block guards throughout).
--
-- What this covers (numbering follows the sprint-1.5 schema checklist):
--   §1  students — re-enrollment + confirmed-leaver columns
--   §2  applicants (student admissions) — parent link, owner, updated_at
--   §3  job_applicants (teacher hiring) — subject for walk-in candidates
--   §4  teacher_contracts — contract document reference (Storage path)
--   §5  lesson_followups — section-scoped follow-ups (Class-hub pop-up)
--   §6  lessons — next-week plan notes + pre-class checklist
--   §7  (goal_checkins / goal_reflections — verified live, no changes needed)
--   §8  study_blocks — wrap-up-task completion flag
--   §9  universities — global reference table + ~40 seeds + applications link
--   §10 student_master_docs — NEW table (Storage-backed document registry)
--   §11 booking_requests — NEW table (counselor 1:1 request-based booking)
--   §12 (report_submissions — verified live: status/submitted_by/file_url ok)
--   §13 (permission_slips — verified live: status/signed_* columns ok)
--
-- Storage buckets (Supabase Dashboard steps — NOT SQL, must be created before
-- the upload UIs ship; all PRIVATE, access via signed URLs):
--   - teacher-contracts     (for §4  teacher_contracts.contract_url)
--   - student-master-docs   (for §10 student_master_docs.storage_path)
--   Note: storage.buckets is currently EMPTY on the live project.
--
-- Known drift note (not fixed here): the live DB carries a migration
-- `20260629105834 admin_corrections` that has no file in schema/. It reshaped
-- `applicants` (HR shape → student-admissions shape + admission_stage enum),
-- created `job_applicants`, and retyped several enums/columns
-- (job_postings.description_md/is_open, student_test_scores, report_submissions,
-- slip_status, university_app_status, applicant_status). This file targets the
-- LIVE shapes. Back-filling the missing admin_corrections file is a separate
-- housekeeping task.
-- ============================================================================

SET search_path = public;

-- ============================================================
-- §1 STUDENTS — re-enrollment funnel + confirmed leavers
--    Semantics:
--      re_enrolled_on        NULL = re-enrollment still pending; a date =
--                            the day the family confirmed re-enrollment.
--      final_enrollment_date NULL = enrolled / expected to continue; a date =
--                            confirmed NOT re-enrolling (last day of enrollment).
--      leaver_reason/comment reason + admin free-text captured by the
--                            "Confirm No Re-enrollment" pop-up.
--    NOTE: distinct from withdrawn_on / withdrawn_reason, which record a
--    MID-YEAR withdrawal. Leaver columns record end-of-year non-re-enrollment.
-- ============================================================
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS re_enrolled_on        date,
    ADD COLUMN IF NOT EXISTS final_enrollment_date date,
    ADD COLUMN IF NOT EXISTS leaver_reason         text,
    ADD COLUMN IF NOT EXISTS leaver_comment        text;

COMMENT ON COLUMN students.re_enrolled_on        IS 'Date the family confirmed re-enrollment for next AY. NULL = pending.';
COMMENT ON COLUMN students.final_enrollment_date IS 'Set only when the family confirms NOT re-enrolling; the student''s last enrollment date. NULL = enrolled.';
COMMENT ON COLUMN students.leaver_reason         IS 'Reason chosen in the Confirm-No-Re-enrollment flow (e.g. relocation, fees, another school, graduation).';
COMMENT ON COLUMN students.leaver_comment        IS 'Free-text admin comment from the Confirm-No-Re-enrollment pop-up.';

-- ============================================================
-- §2 APPLICANTS (student admissions) — EXTEND live table
--    Live shape (from the untracked admin_corrections migration):
--      full_name, target_grade, stage admission_stage, source, notes,
--      converted_student_id, academic_year_id, email, phone_e164.
--    Adds: parent link (searchable-dropdown OR inline-created parent),
--          pipeline owner, updated_at for the auto-refreshing list.
-- ============================================================
ALTER TABLE applicants
    ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES parents(id)       ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES school_admins(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN applicants.parent_id      IS 'Linked parent — picked from the searchable dropdown or created inline by the Add-applicant pop-up.';
COMMENT ON COLUMN applicants.owner_admin_id IS 'Admissions pipeline owner (registrar/admin responsible for this applicant).';

CREATE INDEX IF NOT EXISTS idx_applicants_school_stage ON applicants (school_id, stage);

-- ============================================================
-- §3 JOB_APPLICANTS (teacher hiring) — EXTEND live table
--    Live table already has the full candidate pipeline:
--      full_name, email, phone_e164, cv_url, cover_letter_md,
--      status applicant_status (new/screening/interview/offer_sent/accepted/
--      rejected/withdrawn), screening_notes, interview_date, ai_summary.
--    Adds: subject — for walk-in candidates not tied to a job_posting
--    (job_posting_id is nullable; posting-linked candidates inherit
--    job_postings.department).
-- ============================================================
ALTER TABLE job_applicants
    ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN job_applicants.subject IS 'Subject/department the candidate teaches — used when the candidate is not linked to a job_posting.';

CREATE INDEX IF NOT EXISTS idx_job_applicants_school_status ON job_applicants (school_id, status);

-- ============================================================
-- §4 TEACHER_CONTRACTS — contract document reference
--    Path inside the PRIVATE `teacher-contracts` Storage bucket
--    (bucket must be created in the Supabase Dashboard — see header).
-- ============================================================
ALTER TABLE teacher_contracts
    ADD COLUMN IF NOT EXISTS contract_url         text,
    ADD COLUMN IF NOT EXISTS contract_uploaded_at timestamptz,
    ADD COLUMN IF NOT EXISTS contract_uploaded_by uuid REFERENCES school_admins(id) ON DELETE SET NULL;

COMMENT ON COLUMN teacher_contracts.contract_url IS 'Storage path of the signed contract inside the private teacher-contracts bucket (serve via signed URL).';

-- ============================================================
-- §5 LESSON_FOLLOWUPS — Class-hub "add follow-up" pop-up
--    Live table already has: title, description, due_date, priority, is_done,
--    tag, student_id, target_teacher_id, completed_at.
--    Changes: follow-ups can now be scoped to a SECTION without a specific
--    lesson (the pop-up lives on the class, not on one lesson), so
--    lesson_id becomes nullable and section_id is added; a CHECK keeps at
--    least one context set. Also sourced by the substitute sheet.
-- ============================================================
ALTER TABLE lesson_followups
    ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES sections(id) ON DELETE SET NULL;

ALTER TABLE lesson_followups
    ALTER COLUMN lesson_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_followups_context_chk'
          AND conrelid = 'lesson_followups'::regclass
    ) THEN
        ALTER TABLE lesson_followups
            ADD CONSTRAINT lesson_followups_context_chk
            CHECK (lesson_id IS NOT NULL OR section_id IS NOT NULL);
    END IF;
END $$;

COMMENT ON COLUMN lesson_followups.section_id IS 'Section context for follow-ups created from the Class hub (no specific lesson).';

CREATE INDEX IF NOT EXISTS idx_lesson_followups_teacher_open
    ON lesson_followups (school_id, teacher_id, is_done);

-- ============================================================
-- §6 LESSONS — Class-hub Next Week page (absorbs the Input page)
--    lessons.planned_for_week (week marker) already exists from 012.
--    Adds: plan_notes (next-class summary text) + pre_class_checklist
--    (jsonb array of {label, done} items).
-- ============================================================
ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS plan_notes          text,
    ADD COLUMN IF NOT EXISTS pre_class_checklist jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN lessons.plan_notes          IS 'Teacher''s next-class plan summary shown on the Class-hub Next Week page.';
COMMENT ON COLUMN lessons.pre_class_checklist IS 'Pre-class checklist as a jsonb array of {"label": text, "done": bool} items.';

-- ============================================================
-- §7 STUDENT GOALS — verified, no changes
--    goal_checkins (checked_on, value, source, progress_pct, notes) and
--    goal_reflections (body, mood, month, audience) already exist live with
--    RLS via the parent student_goals tenant check. Nothing to add.
-- ============================================================

-- ============================================================
-- §8 STUDY_BLOCKS — wrap-up-task persistence
--    Live table: student_id, subject_id, title, block_date, start/end_time,
--    kind, origin. Adds the completion flag the wrap-up flow toggles.
-- ============================================================
ALTER TABLE study_blocks
    ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN study_blocks.is_done IS 'Set true when the student marks the block''s task done in the planner wrap-up.';

-- ============================================================
-- §9 UNIVERSITIES — global reference list + seed + applications link
--    DELIBERATE deviation from the per-tenant pattern: this is a shared
--    read-only reference table (no school_id). RLS is ON with a SELECT-only
--    policy for authenticated users; there is NO insert/update/delete policy,
--    so only the service role / migrations can modify it.
-- ============================================================
CREATE TABLE IF NOT EXISTS universities (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL UNIQUE,
    country    text NOT NULL,
    region     text NOT NULL,   -- 'GCC' | 'Middle East' | 'UK' | 'US' | 'Canada' | 'Australia'
    website    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'universities'
          AND policyname = 'universities_read_all'
    ) THEN
        CREATE POLICY universities_read_all ON universities
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

COMMENT ON TABLE universities IS 'Shared (cross-tenant) university reference list for the student application tracker. Read-only to app users; maintained via migrations/service role.';

CREATE INDEX IF NOT EXISTS idx_universities_region ON universities (region);

-- Seed: 40 well-known universities (GCC/Middle East, UK, US, Canada, Australia)
INSERT INTO universities (name, country, region) VALUES
    -- GCC / Middle East (10)
    ('Sultan Qaboos University',                          'Oman',           'GCC'),
    ('German University of Technology in Oman',           'Oman',           'GCC'),
    ('University of Nizwa',                               'Oman',           'GCC'),
    ('United Arab Emirates University',                   'UAE',            'GCC'),
    ('American University of Sharjah',                    'UAE',            'GCC'),
    ('Khalifa University',                                'UAE',            'GCC'),
    ('New York University Abu Dhabi',                     'UAE',            'GCC'),
    ('Qatar University',                                  'Qatar',          'GCC'),
    ('King Fahd University of Petroleum and Minerals',    'Saudi Arabia',   'GCC'),
    ('American University of Beirut',                     'Lebanon',        'Middle East'),
    -- UK (10)
    ('University of Oxford',                              'United Kingdom', 'UK'),
    ('University of Cambridge',                           'United Kingdom', 'UK'),
    ('Imperial College London',                           'United Kingdom', 'UK'),
    ('University College London',                         'United Kingdom', 'UK'),
    ('London School of Economics and Political Science',  'United Kingdom', 'UK'),
    ('University of Edinburgh',                           'United Kingdom', 'UK'),
    ('University of Manchester',                          'United Kingdom', 'UK'),
    ('King''s College London',                            'United Kingdom', 'UK'),
    ('University of Warwick',                             'United Kingdom', 'UK'),
    ('University of Bristol',                             'United Kingdom', 'UK'),
    -- US (10)
    ('Massachusetts Institute of Technology',             'United States',  'US'),
    ('Stanford University',                               'United States',  'US'),
    ('Harvard University',                                'United States',  'US'),
    ('University of California, Berkeley',                'United States',  'US'),
    ('University of Michigan',                            'United States',  'US'),
    ('New York University',                               'United States',  'US'),
    ('Boston University',                                 'United States',  'US'),
    ('Georgia Institute of Technology',                   'United States',  'US'),
    ('Purdue University',                                 'United States',  'US'),
    ('University of Illinois Urbana-Champaign',           'United States',  'US'),
    -- Canada (5)
    ('University of Toronto',                             'Canada',         'Canada'),
    ('University of British Columbia',                    'Canada',         'Canada'),
    ('McGill University',                                 'Canada',         'Canada'),
    ('University of Waterloo',                            'Canada',         'Canada'),
    ('McMaster University',                               'Canada',         'Canada'),
    -- Australia (5)
    ('University of Melbourne',                           'Australia',      'Australia'),
    ('University of Sydney',                              'Australia',      'Australia'),
    ('University of New South Wales',                     'Australia',      'Australia'),
    ('Australian National University',                    'Australia',      'Australia'),
    ('Monash University',                                 'Australia',      'Australia')
ON CONFLICT (name) DO NOTHING;

-- Link applications to the reference list (university_name stays for
-- free-text / not-in-list entries).
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES universities(id) ON DELETE SET NULL;

COMMENT ON COLUMN applications.university_id IS 'Optional link to the shared universities reference list (Add-university pop-up).';

-- ============================================================
-- §10 STUDENT_MASTER_DOCS — NEW table
--     Registry of a student's master documents (transcript, passport copy,
--     recommendation letters, certificates …). Files live in the PRIVATE
--     `student-master-docs` Storage bucket (Dashboard step — see header).
-- ============================================================
CREATE TABLE IF NOT EXISTS student_master_docs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    doc_type     text NOT NULL,   -- 'transcript' | 'passport' | 'recommendation' | 'certificate' | 'test_report' | 'other'
    title        text,
    storage_path text NOT NULL,
    uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at  timestamptz NOT NULL DEFAULT now(),
    notes        text
);

ALTER TABLE student_master_docs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_master_docs'
          AND policyname = 'tenant_isolation_student_master_docs'
    ) THEN
        CREATE POLICY tenant_isolation_student_master_docs ON student_master_docs
            FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());
    END IF;
END $$;

COMMENT ON TABLE student_master_docs IS 'Per-student master document registry (files in the private student-master-docs Storage bucket; serve via signed URLs).';

CREATE INDEX IF NOT EXISTS idx_student_master_docs_student
    ON student_master_docs (school_id, student_id);

-- ============================================================
-- §11 BOOKING_REQUESTS — NEW table
--     Pilot counselor 1:1 booking: student picks a slot from
--     counselor-defined availability → request row → counselor confirms.
--     status is text+CHECK (matches the sweep-corrections direction of
--     preferring text over churning enums).
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES schools(id),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    counselor_id    uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    requested_start timestamptz NOT NULL,
    requested_end   timestamptz,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
    note            text,
    decided_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'booking_requests'
          AND policyname = 'tenant_isolation_booking_requests'
    ) THEN
        CREATE POLICY tenant_isolation_booking_requests ON booking_requests
            FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());
    END IF;
END $$;

COMMENT ON TABLE booking_requests IS 'Counselor 1:1 booking requests (pilot: request-based, counselor confirms; calendar integration = Phase 2).';

CREATE INDEX IF NOT EXISTS idx_booking_requests_counselor
    ON booking_requests (school_id, counselor_id, status);

-- ============================================================
-- §12 REPORT_SUBMISSIONS — verified, no changes
--     Live table already has status (report_submission_status), submitted_by
--     → school_admins, submitted_at, file_url, period_label, term_id.
-- ============================================================

-- ============================================================
-- §13 PERMISSION_SLIPS — verified, no changes
--     Live table already has status (not_started/draft/signed/declined),
--     signed_by_parent_id, signed_name, signed_at, responded_at, notes —
--     everything the parent Sign & Submit flow writes.
-- ============================================================

-- ============================================================================
-- ROLLBACK (manual, if ever needed — run in reverse order):
--   DROP TABLE IF EXISTS booking_requests;
--   DROP TABLE IF EXISTS student_master_docs;
--   ALTER TABLE applications DROP COLUMN IF EXISTS university_id;
--   DROP TABLE IF EXISTS universities;
--   ALTER TABLE study_blocks DROP COLUMN IF EXISTS is_done;
--   ALTER TABLE lessons DROP COLUMN IF EXISTS plan_notes,
--                       DROP COLUMN IF EXISTS pre_class_checklist;
--   ALTER TABLE lesson_followups DROP CONSTRAINT IF EXISTS lesson_followups_context_chk;
--   ALTER TABLE lesson_followups DROP COLUMN IF EXISTS section_id;
--   -- (lesson_id NOT NULL can be restored only while all rows have lesson_id)
--   ALTER TABLE teacher_contracts DROP COLUMN IF EXISTS contract_url,
--                                 DROP COLUMN IF EXISTS contract_uploaded_at,
--                                 DROP COLUMN IF EXISTS contract_uploaded_by;
--   ALTER TABLE job_applicants DROP COLUMN IF EXISTS subject;
--   ALTER TABLE applicants DROP COLUMN IF EXISTS parent_id,
--                          DROP COLUMN IF EXISTS owner_admin_id,
--                          DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE students DROP COLUMN IF EXISTS re_enrolled_on,
--                        DROP COLUMN IF EXISTS final_enrollment_date,
--                        DROP COLUMN IF EXISTS leaver_reason,
--                        DROP COLUMN IF EXISTS leaver_comment;
-- ============================================================================
