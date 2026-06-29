-- Manhaj schema · 011_phase1_schema.sql
-- ============================================================================
-- Phase 1 — full archetype coverage
-- Archetypes: Admin (A1–A8), Teacher (T1/T2/T3/T6), Parent (P1/P4/P5/P6),
--             Student (S1/S2/S3)
--
-- Applied via Supabase MCP on 2026-06-25 (migration version 20260625143935).
-- This file is the source-of-truth record; do not re-run against a DB that
-- already has this migration applied.
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. NEW ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'parent', 'student');
CREATE TYPE admin_role AS ENUM ('principal', 'vice_principal', 'head_of_year', 'registrar', 'finance', 'it', 'hr');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE absence_reason AS ENUM ('sick', 'personal', 'professional_development', 'emergency', 'other');
CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected', 'covered');
CREATE TYPE applicant_status AS ENUM ('new', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE goal_status AS ENUM ('active', 'achieved', 'dropped');  -- corrected in 012_phase1_corrections
CREATE TYPE goal_kind AS ENUM ('academic', 'attendance', 'behaviour', 'wellbeing', 'extracurricular');
CREATE TYPE goal_created_by AS ENUM ('student', 'teacher', 'counsellor', 'parent');
CREATE TYPE university_app_status AS ENUM ('researching', 'drafting', 'submitted', 'offer_received', 'accepted', 'rejected', 'deferred', 'withdrawn');
CREATE TYPE slip_status AS ENUM ('pending', 'approved', 'declined', 'paid');
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled');
CREATE TYPE lesson_plan_kind AS ENUM ('standard', 'cover', 'revision', 'assessment', 'trip');
CREATE TYPE regulatory_report_kind AS ENUM ('moe_enrolment', 'moe_attendance', 'moe_staff', 'moe_results', 'other');
CREATE TYPE report_submission_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected');
CREATE TYPE notification_kind AS ENUM ('attendance', 'grade', 'invoice', 'announcement', 'permission_slip', 'goal', 'system');

-- Extend existing consent_kind enum
ALTER TYPE consent_kind ADD VALUE IF NOT EXISTS 'trip_photography';
ALTER TYPE consent_kind ADD VALUE IF NOT EXISTS 'trip_participation';

-- ============================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================

-- teachers
ALTER TABLE teachers
    ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS phone_e164     text,
    ADD COLUMN IF NOT EXISTS email          text,
    ADD COLUMN IF NOT EXISTS avatar_url     text,
    ADD COLUMN IF NOT EXISTS hire_date      date,
    ADD COLUMN IF NOT EXISTS is_form_teacher boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS qualifications text;

-- students
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS photo_url          text,
    ADD COLUMN IF NOT EXISTS current_section_id uuid REFERENCES sections(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS current_ay_id      uuid REFERENCES academic_years(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes              text;

-- parents
ALTER TABLE parents
    ADD COLUMN IF NOT EXISTS user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS avatar_url  text,
    ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- user_schools (from 007_jwt_rls_no_service_role.sql)
ALTER TABLE user_schools
    ADD COLUMN IF NOT EXISTS display_role user_role;

-- sections
ALTER TABLE sections
    ADD COLUMN IF NOT EXISTS room_id         uuid REFERENCES rooms(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS form_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL;

-- lessons
ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS plan_kind           lesson_plan_kind NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS homework_description text,
    ADD COLUMN IF NOT EXISTS homework_due_date   date,
    ADD COLUMN IF NOT EXISTS cover_teacher_id    uuid REFERENCES teachers(id) ON DELETE SET NULL;

-- attendance_marks
ALTER TABLE attendance_marks
    ADD COLUMN IF NOT EXISTS notified_parent_at timestamptz,
    ADD COLUMN IF NOT EXISTS notified_channel   text;

-- ============================================================
-- 3. FK FIX: course_selection_forms.locked_by_admin_id
--    Was → teachers(id), now → school_admins(id)
--    (school_admins is created below; the FK is added after the table exists)
-- ============================================================

-- ============================================================
-- 4. NEW TABLES
-- ============================================================

-- school_admins — admin archetype profiles
CREATE TABLE school_admins (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name   text NOT NULL,
    role        admin_role NOT NULL DEFAULT 'principal',
    email       text,
    phone_e164  text,
    avatar_url  text,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE school_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_school_admins ON school_admins
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- Now apply the FK fix for course_selection_forms
ALTER TABLE course_selection_forms
    DROP COLUMN IF EXISTS locked_by_admin_id;
ALTER TABLE course_selection_forms
    ADD COLUMN locked_by_admin_id uuid REFERENCES school_admins(id) ON DELETE SET NULL;

-- invitations — magic-link invite flow
CREATE TABLE invitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    email       text NOT NULL,
    role        user_role NOT NULL,
    token       text NOT NULL UNIQUE,
    status      invitation_status NOT NULL DEFAULT 'pending',
    invited_by  uuid REFERENCES school_admins(id),
    expires_at  timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invitations ON invitations
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- announcements — A3 broadcast
CREATE TABLE announcements (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES schools(id),
    title          text NOT NULL,
    body           text NOT NULL,
    target_roles   user_role[] NOT NULL DEFAULT '{}',
    target_sections uuid[],
    published_at   timestamptz,
    expires_at     timestamptz,
    created_by     uuid REFERENCES school_admins(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_announcements ON announcements
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- ai_briefings — daily AI-generated briefing per role
CREATE TABLE ai_briefings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    target_role user_role NOT NULL,
    target_id   uuid,              -- school_admin_id, teacher_id, etc.
    briefing_date date NOT NULL,
    body        text NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, target_role, target_id, briefing_date)
);
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_briefings ON ai_briefings
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- staff_absences — T6 absence management
CREATE TABLE staff_absences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES schools(id),
    teacher_id      uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    absence_date    date NOT NULL,
    end_date        date,
    reason          absence_reason NOT NULL DEFAULT 'sick',
    status          absence_status NOT NULL DEFAULT 'pending',
    notes           text,
    approved_by     uuid REFERENCES school_admins(id),
    approved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_staff_absences ON staff_absences
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- substitutions — sub assignment for an absence
CREATE TABLE substitutions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES schools(id),
    staff_absence_id uuid NOT NULL REFERENCES staff_absences(id) ON DELETE CASCADE,
    sub_teacher_id   uuid NOT NULL REFERENCES teachers(id),
    timetable_slot_id uuid REFERENCES timetable_slots(id),
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_substitutions ON substitutions
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- job_postings — HR recruitment (A6)
CREATE TABLE job_postings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    title        text NOT NULL,
    department   text,
    description  text,
    requirements text,
    status       text NOT NULL DEFAULT 'open',  -- open | closed | filled
    posted_at    timestamptz,
    closes_at    date,
    created_by   uuid REFERENCES school_admins(id),
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_job_postings ON job_postings
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- applicants — candidates for job_postings
CREATE TABLE applicants (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES schools(id),
    job_posting_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    full_name     text NOT NULL,
    email         text NOT NULL,
    phone_e164    text,
    cv_path       text,
    status        applicant_status NOT NULL DEFAULT 'new',
    notes         text,
    applied_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_applicants ON applicants
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- risk_flags — at-risk student flags (A5 / T2)
CREATE TABLE risk_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    level       risk_level NOT NULL DEFAULT 'medium',
    reason      text NOT NULL,
    raised_by   uuid REFERENCES teachers(id),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES school_admins(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_risk_flags ON risk_flags
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- lesson_followups — post-lesson observations (T2)
CREATE TABLE lesson_followups (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    teacher_id  uuid NOT NULL REFERENCES teachers(id),
    body        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lesson_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_lesson_followups ON lesson_followups
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- permission_slips — trip/event definitions (P4)
-- NOTE: renamed to `activities` in 012_phase1_corrections
CREATE TABLE permission_slips (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES schools(id),
    academic_year_id uuid NOT NULL REFERENCES academic_years(id),
    title           text NOT NULL,
    description_en  text,
    description_ar  text,
    event_date      date,
    event_location  text,
    target_sections uuid[],
    cost_omr        numeric(10,3),
    deadline        timestamptz,
    created_by      uuid REFERENCES school_admins(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE permission_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_permission_slips ON permission_slips
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- permission_slip_responses — per-student consent (P4)
-- NOTE: renamed to `permission_slips` in 012_phase1_corrections
CREATE TABLE permission_slip_responses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slip_id      uuid NOT NULL REFERENCES permission_slips(id) ON DELETE CASCADE,
    student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id    uuid REFERENCES parents(id) ON DELETE SET NULL,
    status       slip_status NOT NULL DEFAULT 'pending',
    responded_at timestamptz,
    notes        text,
    payment_ref  text
);
ALTER TABLE permission_slip_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_psr ON permission_slip_responses
    FOR ALL USING (EXISTS (
        SELECT 1 FROM permission_slips ps
        WHERE ps.id = permission_slip_responses.slip_id
          AND ps.school_id = tenant_id()
    ));

-- invoices — school fee invoices (P5)
CREATE TABLE invoices (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES academic_years(id),
    title        text NOT NULL,
    status       invoice_status NOT NULL DEFAULT 'draft',
    total_omr    numeric(10,3) NOT NULL DEFAULT 0,
    issued_at    timestamptz,
    due_date     date,
    paid_at      timestamptz,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoices ON invoices
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- invoice_line_items — line items on an invoice
-- NOTE: renamed to `invoice_lines` in 012_phase1_corrections
CREATE TABLE invoice_line_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description   text NOT NULL,
    quantity      numeric(10,2) NOT NULL DEFAULT 1,
    unit_price_omr numeric(10,3) NOT NULL,
    total_omr     numeric(10,3) NOT NULL,
    display_order int
);
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoice_lines ON invoice_line_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND i.school_id = tenant_id()
    ));

-- student_goals — S2 goal tracking
CREATE TABLE student_goals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES schools(id),
    student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES academic_years(id),
    kind             goal_kind NOT NULL DEFAULT 'academic',
    title            text NOT NULL,
    description      text,
    target_date      date,     -- renamed to due_on in 012_phase1_corrections
    status           goal_status NOT NULL DEFAULT 'active',  -- fixed in 012_phase1_corrections
    created_by_role  goal_created_by NOT NULL DEFAULT 'student',
    created_by_id    uuid,
    created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE student_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_goals ON student_goals
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- goal_checkins — progress check-ins on a goal
CREATE TABLE goal_checkins (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id      uuid NOT NULL REFERENCES student_goals(id) ON DELETE CASCADE,
    checked_by   uuid,
    progress_pct int,
    notes        text,
    checked_at   timestamptz NOT NULL DEFAULT now()  -- renamed/retyped in 012_phase1_corrections
);
ALTER TABLE goal_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_goal_checkins ON goal_checkins
    FOR ALL USING (EXISTS (
        SELECT 1 FROM student_goals g
        WHERE g.id = goal_checkins.goal_id
          AND g.school_id = tenant_id()
    ));

-- goal_reflections — student reflections on goals
CREATE TABLE goal_reflections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         uuid NOT NULL REFERENCES student_goals(id) ON DELETE CASCADE,
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reflection_text text,   -- renamed to body in 012_phase1_corrections
    mood            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE goal_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_goal_reflections ON goal_reflections
    FOR ALL USING (EXISTS (
        SELECT 1 FROM student_goals g
        WHERE g.id = goal_reflections.goal_id
          AND g.school_id = tenant_id()
    ));

-- study_blocks — S3 student study planner (redesigned in 012_phase1_corrections)
CREATE TABLE study_blocks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id   uuid REFERENCES subjects(id),
    title        text,
    day_of_week  int,        -- dropped in 012_phase1_corrections
    start_time   time,
    end_time     time,
    recurs_weekly boolean NOT NULL DEFAULT true,  -- dropped in 012_phase1_corrections
    color_hex    text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE study_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_study_blocks ON study_blocks
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- university_profiles — student university aspirations
-- NOTE: dropped in 012_phase1_corrections (not in spec)
CREATE TABLE university_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES schools(id),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    target_field    text,
    target_countries text[],
    predicted_grades jsonb,
    personal_statement_draft text,
    advisor_id      uuid REFERENCES teachers(id),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE university_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_university_profiles ON university_profiles
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- student_test_scores — standardised test scores (S1)
CREATE TABLE student_test_scores (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_kind   text NOT NULL,   -- 'SAT' | 'IELTS' | 'IGCSE' | 'AS' | 'A2' | 'IB'
    subject     text,
    score       text NOT NULL,
    taken_on    date,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE student_test_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_test_scores ON student_test_scores
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- university_applications — university application tracking
-- NOTE: renamed to `applications` in 012_phase1_corrections
CREATE TABLE university_applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES schools(id),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    university_name text NOT NULL,
    country         text,
    program         text,
    application_id  text,
    status          university_app_status NOT NULL DEFAULT 'researching',
    applied_on      date,
    deadline        date,
    offer_received  boolean NOT NULL DEFAULT false,
    offer_deadline  date,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE university_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_university_applications ON university_applications
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- regulatory_report_catalog — report definitions (A8)
CREATE TABLE regulatory_report_catalog (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES schools(id),
    kind         regulatory_report_kind NOT NULL,
    label        text NOT NULL,
    description  text,
    frequency    text,   -- 'annual' | 'termly' | 'monthly' | 'on_demand'
    template_path text,
    is_active    boolean NOT NULL DEFAULT true
);
ALTER TABLE regulatory_report_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_regulatory_report_catalog ON regulatory_report_catalog
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- report_submissions — submitted regulatory reports (A8)
CREATE TABLE report_submissions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES schools(id),
    catalog_id     uuid NOT NULL REFERENCES regulatory_report_catalog(id),
    academic_year_id uuid REFERENCES academic_years(id),
    status         report_submission_status NOT NULL DEFAULT 'draft',
    submitted_at   timestamptz,
    submitted_by   uuid REFERENCES school_admins(id),
    file_path      text,
    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE report_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_submissions ON report_submissions
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());

-- notifications — in-app notifications for all roles
CREATE TABLE notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(id),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind        notification_kind NOT NULL,
    title       text NOT NULL,
    body        text,
    ref_table   text,
    ref_id      uuid,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL USING (school_id = tenant_id()) WITH CHECK (school_id = tenant_id());
