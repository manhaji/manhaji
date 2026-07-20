import { serverClient } from "../supabase";

export type RubricCriterion = {
  id: string;
  axis_code: string;
  axis_name_en: string;
  description_en: string | null;
  ai_suggested: boolean;
  display_order: number | null;
  scale_min: number;
  scale_max: number;
};

export type RubricScore = {
  student_id: string;
  axis_code: string;
  score: number;
  notes: string | null;
  source: string | null;
};

export async function getRubricForSchool(schoolId: string): Promise<{ id: string; name: string } | null> {
  const db = await serverClient();
  const { data } = await db
    .from("rubrics")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("is_manhaj_default", true)
    .maybeSingle();
  return data ?? null;
}

export async function getRubricCriteria(rubricId: string): Promise<RubricCriterion[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("rubric_criteria")
    .select("id, axis_code, axis_name_en, description_en, ai_suggested, display_order, scale_min, scale_max")
    .eq("rubric_id", rubricId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRubricScoresForStudents(
  studentIds: string[],
  rubricId: string,
  month: string,               // "YYYY-MM" or "YYYY-MM-DD"
): Promise<RubricScore[]> {
  if (studentIds.length === 0) return [];
  // scored_for_month is a date column normalised to the 1st of the month.
  const monthDate = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month;
  const db = await serverClient();
  const { data, error } = await db
    .from("rubric_scores")
    .select("student_id, axis_code, score, notes, source")
    .eq("rubric_id", rubricId)
    .eq("scored_for_month", monthDate)
    .in("student_id", studentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    student_id: r.student_id,
    axis_code: r.axis_code,
    score: r.score,
    notes: r.notes,
    source: r.source,
  }));
}
