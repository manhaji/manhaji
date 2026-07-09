import { serverClient } from "../supabase";

export type LessonRow = {
  id: string;
  held_on: string;
  topic: string | null;
  learning_objective: string | null;
  homework_description: string | null;
};

export type FollowupRow = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  priority: string;
  tag: string | null;
  is_done: boolean;
  student_id: string | null;
};

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

export async function getWeekLessons(sectionId: string, weekStart: string, weekEnd: string): Promise<LessonRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select("id, held_on, topic, learning_objective, homework_description")
    .eq("section_id", sectionId)
    .gte("held_on", weekStart)
    .lte("held_on", weekEnd)
    .order("held_on");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNextLesson(sectionId: string, afterDate: string): Promise<LessonRow | null> {
  const db = await serverClient();
  const { data } = await db
    .from("lessons")
    .select("id, held_on, topic, learning_objective, homework_description")
    .eq("section_id", sectionId)
    .gt("held_on", afterDate)
    .order("held_on")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getFollowupsForLessons(lessonIds: string[]): Promise<FollowupRow[]> {
  if (lessonIds.length === 0) return [];
  const db = await serverClient();
  const { data, error } = await db
    .from("lesson_followups")
    .select("id, lesson_id, title, description, priority, tag, is_done, student_id")
    .in("lesson_id", lessonIds)
    .order("created_at");
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
