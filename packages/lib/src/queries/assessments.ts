import { serverClient } from "../supabase";

export type TeacherAssessmentRaw = {
  id: string;
  label: string;
  section: string;
  subject: string;
  held_on: string | null;
  submitted_count: number;
  avg_score: number;
};

export async function getAssessmentsForTeacher(
  teacherId: string,
  sectionIds: string[],
  limit = 10,
): Promise<TeacherAssessmentRaw[]> {
  if (sectionIds.length === 0) return [];
  const db = await serverClient();
  const { data, error } = await db
    .from("assessments")
    .select(`
      id, label, held_on, max_score,
      sections ( code ),
      subjects ( name_en ),
      assessment_results ( score )
    `)
    .eq("teacher_id", teacherId)
    .in("section_id", sectionIds)
    .order("held_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map(a => {
    const results = (a.assessment_results as Array<{ score: number | null }> | null) ?? [];
    const submitted = results.filter(r => r.score !== null);
    const avgScore = submitted.length > 0
      ? Math.round(submitted.reduce((s, r) => s + (r.score! / Number(a.max_score) * 100), 0) / submitted.length)
      : 0;
    return {
      id: a.id,
      label: a.label,
      section: (a.sections as { code: string } | null)?.code ?? "",
      subject: (a.subjects as { name_en: string } | null)?.name_en ?? "",
      held_on: a.held_on,
      submitted_count: submitted.length,
      avg_score: avgScore,
    };
  });
}
