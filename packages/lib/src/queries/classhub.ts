import { serverClient } from "../supabase";

export type ChecklistItem = { label: string; done: boolean };

export type LessonRow = {
  id: string;
  held_on: string;
  topic: string | null;
  learning_objective: string | null;
  homework_description: string | null;
  plan_notes: string | null;
  pre_class_checklist: ChecklistItem[];
};

export type FollowupRow = {
  id: string;
  lesson_id: string | null;
  section_id?: string | null;
  title: string;
  description: string | null;
  priority: string;
  tag: string | null;
  is_done: boolean;
  student_id: string | null;
  due_date?: string | null;
};

export type SectionOption = {
  sectionId: string;
  code: string;
  gradeLevel: string | null;
  subjectId: string;
  subjectName: string;
};

/** Parse the jsonb pre_class_checklist column into a safe ChecklistItem[]. */
export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is { label?: unknown; done?: unknown } => typeof it === "object" && it !== null)
    .map(it => ({ label: String(it.label ?? ""), done: it.done === true }))
    .filter(it => it.label.length > 0);
}

/**
 * The class/section options a teacher can pick in the Class hub / Rubric
 * selectors — one entry per section × subject the teacher teaches.
 */
export async function getTeacherSectionOptions(teacherId: string): Promise<SectionOption[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("teacher_section_subject")
    .select(`
      sections ( id, code, grade_level ),
      subjects ( id, name_en )
    `)
    .eq("teacher_id", teacherId);
  if (error) throw new Error(error.message);

  const options: SectionOption[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const sec = row.sections as { id: string; code: string; grade_level: string | null } | null;
    const sub = row.subjects as { id: string; name_en: string } | null;
    if (!sec || !sub) continue;
    const key = `${sec.id}|${sub.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      sectionId: sec.id,
      code: sec.code,
      gradeLevel: sec.grade_level,
      subjectId: sub.id,
      subjectName: sub.name_en,
    });
  }
  return options.sort((a, b) => a.code.localeCompare(b.code));
}

export type WeekAssessmentRow = {
  id: string;
  label: string;
  held_on: string | null;
  max_score: number;
  kind: string;
};

export type AssessmentResultRow = {
  assessment_id: string;
  student_id: string;
  score: number | null;
};

export type BehaviourRow = {
  id: string;
  kind: string;
  note: string;
  observed_on: string;
  student_id: string;
};

export type CommDraftRow = {
  id: string;
  drafted_en: string | null;
  edited_en: string | null;
  status: string | null;
  created_at: string | null;
};

const LESSON_COLS = "id, held_on, topic, learning_objective, homework_description, plan_notes, pre_class_checklist";

type RawLesson = {
  id: string;
  held_on: string;
  topic: string | null;
  learning_objective: string | null;
  homework_description: string | null;
  plan_notes: string | null;
  pre_class_checklist: unknown;
};

function toLessonRow(r: RawLesson): LessonRow {
  return {
    id: r.id,
    held_on: r.held_on,
    topic: r.topic,
    learning_objective: r.learning_objective,
    homework_description: r.homework_description,
    plan_notes: r.plan_notes,
    pre_class_checklist: parseChecklist(r.pre_class_checklist),
  };
}

export async function getWeekLessons(sectionId: string, weekStart: string, weekEnd: string): Promise<LessonRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select(LESSON_COLS)
    .eq("section_id", sectionId)
    .gte("held_on", weekStart)
    .lte("held_on", weekEnd)
    .order("held_on");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLessonRow);
}

export async function getNextLesson(sectionId: string, afterDate: string): Promise<LessonRow | null> {
  const db = await serverClient();
  const { data } = await db
    .from("lessons")
    .select(LESSON_COLS)
    .eq("section_id", sectionId)
    .gt("held_on", afterDate)
    .order("held_on")
    .limit(1)
    .maybeSingle();
  return data ? toLessonRow(data) : null;
}

export async function getFollowupsForLessons(lessonIds: string[]): Promise<FollowupRow[]> {
  if (lessonIds.length === 0) return [];
  const db = await serverClient();
  const { data, error } = await db
    .from("lesson_followups")
    .select("id, lesson_id, section_id, title, description, priority, tag, is_done, student_id, due_date")
    .in("lesson_id", lessonIds)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Follow-ups for the Class hub pending list: section-scoped follow-ups
 * (created by the Add-follow-up pop-up, migration 020) plus any linked to the
 * given lessons. One source of truth with the substitute sheet.
 */
export async function getFollowupsForSection(
  sectionId: string,
  lessonIds: string[],
): Promise<FollowupRow[]> {
  const db = await serverClient();
  const orParts = [`section_id.eq.${sectionId}`];
  if (lessonIds.length > 0) orParts.push(`lesson_id.in.(${lessonIds.join(",")})`);
  const { data, error } = await db
    .from("lesson_followups")
    .select("id, lesson_id, section_id, title, description, priority, tag, is_done, student_id, due_date")
    .or(orParts.join(","))
    .order("is_done")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWeekAssessments(
  sectionId: string,
  weekStart: string,
  weekEnd: string,
): Promise<{ assessments: WeekAssessmentRow[]; results: AssessmentResultRow[] }> {
  const db = await serverClient();
  const { data: assessments, error: ae } = await db
    .from("assessments")
    .select("id, label, held_on, max_score, kind")
    .eq("section_id", sectionId)
    .in("kind", ["quiz", "test"])
    .gte("held_on", weekStart)
    .lte("held_on", weekEnd);
  if (ae) throw new Error(ae.message);
  if (!assessments?.length) return { assessments: [], results: [] };
  const ids = assessments.map(a => a.id);
  const { data: results, error: re } = await db
    .from("assessment_results")
    .select("assessment_id, student_id, score")
    .in("assessment_id", ids);
  if (re) throw new Error(re.message);
  return { assessments, results: results ?? [] };
}

export async function getWeekAttendance(
  sectionId: string,
  weekStart: string,
  weekEnd: string,
): Promise<{ total: number; present: number; absent: string[]; late: string[] }> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("student_id, status")
    .eq("section_id", sectionId)
    .gte("marked_on", weekStart)
    .lte("marked_on", weekEnd);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const present = rows.filter(r => r.status === "present" || r.status === "late").length;
  const absent  = [...new Set(rows.filter(r => r.status === "absent").map(r => r.student_id))];
  const late    = [...new Set(rows.filter(r => r.status === "late").map(r => r.student_id))];
  return { total: rows.length, present, absent, late };
}

export async function getWeekBehaviourNotes(
  sectionId: string,
  weekStart: string,
  weekEnd: string,
): Promise<BehaviourRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("behaviour_notes")
    .select("id, kind, note, observed_on, student_id")
    .eq("section_id", sectionId)
    .gte("observed_on", weekStart)
    .lte("observed_on", weekEnd);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLatestCommDraft(teacherId: string): Promise<CommDraftRow | null> {
  const db = await serverClient();
  const { data } = await db
    .from("comm_drafts")
    .select("id, drafted_en, edited_en, status, created_at")
    .eq("teacher_id", teacherId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getParentCountForSection(sectionId: string): Promise<number> {
  const db = await serverClient();
  const { data: students } = await db
    .from("students")
    .select("id")
    .eq("current_section_id", sectionId)
    .is("withdrawn_on", null);
  if (!students?.length) return 0;
  const studentIds = students.map(s => s.id);
  const { data: sp } = await db
    .from("student_parents")
    .select("parent_id")
    .in("student_id", studentIds);
  return new Set((sp ?? []).map(r => r.parent_id)).size;
}
