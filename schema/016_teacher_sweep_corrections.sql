-- Manhaj schema · 016_teacher_sweep_corrections.sql
-- ============================================================================
-- Full-sweep corrections from handover_phase1_teacher.pdf
-- Applied via Supabase MCP on 2026-06-29.
--
-- Tables checked and found clean (no changes needed):
--   attendance_marks, rubrics, lessons (plan_kind + planned_for_week present),
--   staff_absences, substitute_sheets, student_goals, timetable_slots,
--   teacher_section_subject, assessments, assessment_results, behaviour_notes,
--   comm_drafts, comm_templates, study_blocks
--
-- Gaps fixed:
--
--   rubric_criteria — add ai_suggested boolean
--     Spec data table has "AI-suggested?" per axis: 4 data-led axes (analytical,
--     creative, written, homework = yes) vs 2 pure-judgement axes (oral,
--     participation = no). Flag drives which axes the AI call proposes a score
--     for vs leaves blank for teacher observation only.
--
--   rubric_scores — add source text
--     Spec data table has a source column: "AI-proposed, confirmed" /
--     "AI-proposed, adjusted ↑" / "judgement" / "judgement + note".
--     Provides the audit trail for how each score was entered and feeds
--     the AI cost reconciliation against ai_usage_ledger.
--
--   lesson_followups — add tag, student_id, is_done, target_teacher_id
--     tag: routes the follow-up type (priority / concept / ptc / handoff).
--       handoff routes to a named receiving teacher; ptc attaches to the
--       student's parent-teacher-conference notes; priority/concept stay on
--       the teacher's own list.
--     student_id: links follow-up to a specific student ("Catch up Khalil").
--     is_done: explicit boolean completion flag (spec column). The existing
--       completed_at timestamptz is kept for the timestamp detail; is_done
--       is the fast boolean the UI toggles and the spec queries.
--     target_teacher_id: the receiving teacher for handoff-tagged follow-ups
--       ("Note for Mr Khalid (G6)"). In spec: "handoff tag routes to a named
--       receiving teacher". Not flagged by user but required for handoff routing.
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. rubric_criteria — add ai_suggested boolean
-- ============================================================
ALTER TABLE rubric_criteria
    ADD COLUMN IF NOT EXISTS ai_suggested boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. rubric_scores — add source text
-- ============================================================
ALTER TABLE rubric_scores
    ADD COLUMN IF NOT EXISTS source text;

-- ============================================================
-- 3. lesson_followups — add tag, student_id, is_done, target_teacher_id
-- ============================================================
ALTER TABLE lesson_followups
    ADD COLUMN IF NOT EXISTS tag               text,
    ADD COLUMN IF NOT EXISTS student_id        uuid REFERENCES students(id),
    ADD COLUMN IF NOT EXISTS is_done           boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS target_teacher_id uuid REFERENCES teachers(id);
