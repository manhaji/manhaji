-- Manhaj schema · 012_phase1_corrections.sql
-- ============================================================================
-- Phase 1 gap-analysis corrections
-- Applied via Supabase MCP on 2026-06-28 (migration version 20260628192144).
-- This file is the exact SQL that was applied. Do not re-run against a DB
-- that already has this migration applied.
--
-- What this fixes (see conversation.md §12 for full gap analysis):
--   - goal_status enum: active/achieved/dropped → on_track/at_risk/met/missed
--   - 12 new enum types for new tables
--   - New table: staffing_categories (teacher workload categories)
--   - Missing columns on: teachers, students, lessons, staff_absences,
--     school_admins, invoices
--   - Column renames/fixes on: student_goals, goal_checkins, goal_reflections
--   - study_blocks: recurring → dated-block design
--   - Renames: permission_slips→activities, permission_slip_responses→permission_slips,
--              invoice_line_items→invoice_lines, university_applications→applications
--   - Drop: university_profiles (not in spec)
--   - 8 new tables: substitute_sheets, student_health, report_archive,
--     application_grades, personal_statements, teacher_references,
--     university_outcomes, (plus activities from rename)
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. FIX goal_status ENUM
--    active / achieved / dropped  →  on_track / at_risk / met / missed
-- ============================================================
ALTER TABLE student_goals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE student_goals ALTER COLUMN status TYPE text;
DROP TYPE goal_status;
CREATE TYPE goal_status AS ENUM ('on_track', 'at_risk', 'met', 'missed');
ALTER TABLE student_goals
    ALTER COLUMN status TYPE goal_status USING 'on_track'::goal_status,
    ALTER COLUMN status SET DEFAULT 'on_track';

-- ============================================================
-- 2. NEW ENUM TYPES
-- ============================================================
CREATE TYPE activity_kind        AS ENUM ('trip', 'event', 'workshop', 'other');
CREATE TYPE study_block_kind     AS ENUM ('study', 'free');
CREATE TYPE study_block_origin   AS ENUM ('suggested', 'edited');
CREATE TYPE goal_metric_kind     AS ENUM ('assessment_pct', 'self_streak', 'rubric_axis', 'self_count');
CREATE TYPE goal_checkin_source  AS ENUM ('student', 'auto');
CREATE TYPE ps_status            AS ENUM ('draft', 'submitted', 'reviewed', 'final');
CREATE TYPE ref_kind             AS ENUM ('ucas', 'common_app', 'direct', 'other');
CREATE TYPE ref_status           AS ENUM ('requested', 'drafted', 'sent');
CREATE TYPE grade_kind           AS ENUM ('igcse', 'as_level', 'a2_level', 'ib', 'sat', 'ielts', 'toefl', 'other');
CREATE TYPE report_archive_kind  AS ENUM ('parent_digest', 'absence_summary', 'regulatory', 'fee_statement', 'other');
CREATE TYPE report_archive_scope AS ENUM ('school', 'section', 'student', 'teacher');
CREATE TYPE outcome_kind         AS ENUM ('historic', 'benchmark');

-- ============================================================
-- 3. NEW TABLE: staffing_categories
--    Must exist before teachers.staffing_category_id FK
-- ============================================================
CREATE TABLE staffing_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    label       text NOT NULL,
    description text,
    UNIQUE (school_id, label)
);
ALTER TABLE staffing_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_staffing_categories ON staffing_categories
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 4. MISSING COLUMNS ON EXISTING TABLES
-- ============================================================

ALTER TABLE teachers
    ADD COLUMN IF NOT EXISTS staffing_category_id uuid REFERENCES staffing_categories(id);

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS advisor_id       uuid REFERENCES teachers(id),
    ADD COLUMN IF NOT EXISTS withdrawn_reason text;

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS planned_for_week date;

ALTER TABLE staff_absences
    ADD COLUMN IF NOT EXISTS sub_teacher_id uuid REFERENCES teachers(id);

ALTER TABLE school_admins
    ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES school_admins(id);

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES parents(id),
    ADD COLUMN IF NOT EXISTS reference_code text;

-- ============================================================
-- 5. FIX student_goals COLUMNS
-- ============================================================
ALTER TABLE student_goals RENAME COLUMN target_date TO due_on;
ALTER TABLE student_goals
    ADD COLUMN IF NOT EXISTS metric       goal_metric_kind,
    ADD COLUMN IF NOT EXISTS target_value numeric;

-- ============================================================
-- 6. FIX goal_checkins COLUMNS
-- ============================================================
ALTER TABLE goal_checkins RENAME COLUMN checked_at TO checked_on;
ALTER TABLE goal_checkins ALTER COLUMN checked_on TYPE date USING checked_on::date;
ALTER TABLE goal_checkins
    ADD COLUMN IF NOT EXISTS value  numeric,
    ADD COLUMN IF NOT EXISTS source goal_checkin_source NOT NULL DEFAULT 'student';

-- ============================================================
-- 7. FIX goal_reflections COLUMNS
-- ============================================================
ALTER TABLE goal_reflections RENAME COLUMN reflection_text TO body;
ALTER TABLE goal_reflections
    ADD COLUMN IF NOT EXISTS month    date,
    ADD COLUMN IF NOT EXISTS audience text;

-- ============================================================
-- 8. FIX study_blocks — recurring → dated blocks
-- ============================================================
ALTER TABLE study_blocks
    DROP COLUMN IF EXISTS day_of_week,
    DROP COLUMN IF EXISTS recurs_weekly;
ALTER TABLE study_blocks
    ADD COLUMN IF NOT EXISTS block_date date,
    ADD COLUMN IF NOT EXISTS kind       study_block_kind   NOT NULL DEFAULT 'study',
    ADD COLUMN IF NOT EXISTS origin     study_block_origin NOT NULL DEFAULT 'suggested';

-- ============================================================
-- 9. RENAME TABLES + ADD MISSING SPEC COLUMNS
-- ============================================================

-- 9a. permission_slips → activities
ALTER TABLE permission_slips
    ADD COLUMN IF NOT EXISTS kind             activity_kind NOT NULL DEFAULT 'trip',
    ADD COLUMN IF NOT EXISTS grade_level      text,
    ADD COLUMN IF NOT EXISTS depart_time      time,
    ADD COLUMN IF NOT EXISTS return_time      time,
    ADD COLUMN IF NOT EXISTS transport        text,
    ADD COLUMN IF NOT EXISTS supervisor_ratio text,
    ADD COLUMN IF NOT EXISTS curriculum_link  text,
    ADD COLUMN IF NOT EXISTS risk_pdf_path    text;
ALTER TABLE permission_slips RENAME COLUMN event_date TO activity_date;
ALTER TABLE permission_slips RENAME TO activities;

-- 9b. permission_slip_responses → permission_slips
ALTER TABLE permission_slip_responses RENAME COLUMN slip_id TO activity_id;
ALTER TABLE permission_slip_responses RENAME TO permission_slips;

-- 9c. invoice_line_items → invoice_lines
ALTER TABLE invoice_line_items RENAME TO invoice_lines;

-- 9d. university_applications → applications
ALTER TABLE university_applications
    ADD COLUMN IF NOT EXISTS fit_tag    text,
    ADD COLUMN IF NOT EXISTS docs_done  int NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS docs_total int NOT NULL DEFAULT 0;
ALTER TABLE university_applications RENAME TO applications;

-- 9e. Drop university_profiles (not in spec)
DROP TABLE IF EXISTS university_profiles CASCADE;

-- ============================================================
-- 10. NEW TABLE: substitute_sheets
-- ============================================================
CREATE TABLE substitute_sheets (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES schools(id),
    staff_absence_id uuid NOT NULL REFERENCES staff_absences(id) ON DELETE CASCADE,
    for_date         date NOT NULL,
    sub_teacher_id   uuid REFERENCES teachers(id),
    pdf_path         text,
    version          int NOT NULL DEFAULT 1,
    ack_at           timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE substitute_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_substitute_sheets ON substitute_sheets
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 11. NEW TABLE: student_health
-- ============================================================
CREATE TABLE student_health (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid NOT NULL REFERENCES schools(id),
    student_id              uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    allergies               text,
    conditions              text,
    medications             text,
    emergency_contact_name  text,
    emergency_contact_phone text,
    emergency_contact_rel   text,
    consent_emergency_care  boolean NOT NULL DEFAULT false,
    updated_by_parent_id    uuid REFERENCES parents(id),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id)
);
ALTER TABLE student_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_health ON student_health
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 12. NEW TABLE: report_archive
-- ============================================================
CREATE TABLE report_archive (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    report_kind  report_archive_kind  NOT NULL,
    scope        report_archive_scope NOT NULL,
    scope_ref_id uuid,
    storage_path text NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),
    sent_at      timestamptz,
    delete_after date,
    deleted_at   timestamptz
);
ALTER TABLE report_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_archive ON report_archive
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 13. NEW TABLE: application_grades
--     Depends on applications (renamed in step 9d)
-- ============================================================
CREATE TABLE application_grades (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES schools(id),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    grade_kind     grade_kind NOT NULL,
    label          text NOT NULL,
    predicted      text,
    actual         text,
    validated_by   uuid REFERENCES teachers(id),
    validated_on   date
);
ALTER TABLE application_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_application_grades ON application_grades
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 14. NEW TABLE: personal_statements
-- ============================================================
CREATE TABLE personal_statements (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES schools(id),
    student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    application_id uuid REFERENCES applications(id),
    version        int NOT NULL DEFAULT 1,
    status         ps_status NOT NULL DEFAULT 'draft',
    body           text,
    reviewed_by    uuid REFERENCES teachers(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE personal_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_personal_statements ON personal_statements
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 15. NEW TABLE: teacher_references
-- ============================================================
CREATE TABLE teacher_references (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid NOT NULL REFERENCES schools(id),
    student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_teacher_id uuid NOT NULL REFERENCES teachers(id),
    ref_kind          ref_kind NOT NULL,
    base_reference_id uuid REFERENCES teacher_references(id),
    application_id    uuid REFERENCES applications(id),
    status            ref_status NOT NULL DEFAULT 'requested',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE teacher_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teacher_references ON teacher_references
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ============================================================
-- 16. NEW TABLE: university_outcomes
-- ============================================================
CREATE TABLE university_outcomes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    kind        outcome_kind NOT NULL,
    university  text NOT NULL,
    course      text,
    cohort_year int,
    applicants  int,
    admits      int,
    admit_rate  numeric(5,2),
    source      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE university_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_university_outcomes ON university_outcomes
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());
