import { serverClient } from "../supabase";

export type HomeworkRow = {
  id: string;
  subject: string;
  title: string;
  due: string | null;
  lesson_date: string;
  ai_estimate: string | null;
};

export async function getHomeworkForSection(sectionId: string, from: string, to: string): Promise<HomeworkRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select(`
      id, held_on, homework_description, homework_due_date,
      subjects ( name_en )
    `)
    .eq("section_id", sectionId)
    .not("homework_description", "is", null)
    .gte("homework_due_date", from)
    .lte("homework_due_date", to)
    .order("homework_due_date");
  if (error) throw new Error(error.message);
  return (data ?? []).map(l => {
    const sub = l.subjects as { name_en: string } | null;
    return {
      id: l.id,
      subject: sub?.name_en ?? "Unknown",
      title: l.homework_description as string,
      due: l.homework_due_date as string | null,
      lesson_date: l.held_on,
      ai_estimate: null,
    };
  });
}

export async function getHomeworkForStudent(studentId: string, from: string, to: string): Promise<HomeworkRow[]> {
  const db = await serverClient();
  const { data: student } = await db
    .from("students")
    .select("current_section_id")
    .eq("id", studentId)
    .single();
  if (!student?.current_section_id) return [];
  return getHomeworkForSection(student.current_section_id, from, to);
}

export async function getRecentLessonsForTeacher(teacherId: string, limit = 10) {
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select(`
      id, held_on, topic, homework_description, homework_due_date,
      sections ( code, grade_level ),
      subjects ( name_en )
    `)
    .eq("teacher_id", teacherId)
    .order("held_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLessonsForSection(sectionId: string, from: string, to: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select(`
      id, held_on, topic, plan_kind, homework_description, homework_due_date,
      subjects ( name_en, code ),
      teachers ( display_name, full_name )
    `)
    .eq("section_id", sectionId)
    .gte("held_on", from)
    .lte("held_on", to)
    .order("held_on", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
