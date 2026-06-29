-- Manhaj schema · 015_student_sweep_corrections.sql
-- ============================================================================
-- Full-sweep corrections from handover_phase1_student.pdf
-- Applied via Supabase MCP on 2026-06-29.
--
-- Tables checked and found clean (no changes needed):
--   student_goals, goal_checkins, goal_reflections, study_blocks,
--   assessments, student_enrollments, personal_statements, university_outcomes
--
-- Gaps fixed:
--
--   applications — column rename + enum replacement
--     program → course  (spec data table uses 'course' throughout)
--     university_app_status enum replaced:
--       Old: planning / applied / offer_received / accepted / rejected / deferred / withdrawn
--       New: researching / in_progress / submitted / interview / admitted / rejected / withdrawn
--       - planning      → researching  (spec's first stage label)
--       - applied       → submitted    (spec has in_progress between these two)
--       - offer_received/accepted → admitted  (spec collapses to one stage)
--       - deferred dropped (not in spec pipeline; re-add later if needed)
--       - interview added (Submitted → Interview → Admitted is an explicit spec stage)
--       - in_progress added (Researching → In Progress is an explicit spec stage)
--       - withdrawn kept (students can withdraw)
--
--   application_grades — add value + student_id + nullable application_id
--     value text: primary grade display string ("43/45", "1480/1600", "8.0/9")
--       used in the UI and by the match model. The existing predicted/actual
--       columns remain for structured reads; value is the spec's unified display field.
--     student_id FK: spec data table shows it on every row; avoids join through
--       application_id → applications for student-level grade queries.
--     application_id nullable: spec shows grades that apply to ALL applications
--       (e.g. IB predicted total), not just one specific application.
--
--   teacher_references — ref_kind: constrained enum → free-form text
--     Old enum: ucas / common_app / direct / other  (application SYSTEM type)
--     Spec uses: "academic (maths)", "personal"  (nature of the reference letter)
--     These are fundamentally different concepts. Converting to text lets teachers
--     describe reference type freely (academic/personal/subject-specific).
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. applications — rename program → course
-- ============================================================
ALTER TABLE applications RENAME COLUMN program TO course;

-- ============================================================
-- 2. university_app_status ENUM — replace to match spec §S3 pipeline
-- ============================================================
ALTER TABLE applications ALTER COLUMN status DROP DEFAULT;
ALTER TABLE applications ALTER COLUMN status TYPE text;
DROP TYPE university_app_status;
CREATE TYPE university_app_status AS ENUM (
    'researching', 'in_progress', 'submitted', 'interview',
    'admitted', 'rejected', 'withdrawn'
);
ALTER TABLE applications
    ALTER COLUMN status TYPE university_app_status
        USING CASE status
            WHEN 'planning'       THEN 'researching'
            WHEN 'applied'        THEN 'submitted'
            WHEN 'offer_received' THEN 'admitted'
            WHEN 'accepted'       THEN 'admitted'
            WHEN 'deferred'       THEN 'submitted'
            WHEN 'withdrawn'      THEN 'withdrawn'
            ELSE 'researching'
        END::university_app_status,
    ALTER COLUMN status SET DEFAULT 'researching';

-- ============================================================
-- 3. application_grades — value, student_id, nullable application_id
-- ============================================================
ALTER TABLE application_grades
    ADD COLUMN IF NOT EXISTS value      text,
    ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students(id);
ALTER TABLE application_grades ALTER COLUMN application_id DROP NOT NULL;

-- ============================================================
-- 4. teacher_references — ref_kind: enum → text
-- ============================================================
ALTER TABLE teacher_references ALTER COLUMN ref_kind TYPE text USING ref_kind::text;
DROP TYPE ref_kind;
