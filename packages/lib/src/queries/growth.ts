import { serverClient } from "../supabase";

export type RubricAxisScore = {
  axis_code: string;
  this_mo: number;
  last_mo: number;
  history: Array<{ month: string; score: number }>;
};

export type GoalRow = {
  id: string;
  kind: string | null;
  title: string;
  description: string | null;
  due_on: string | null;
  status: string;
  metric: string | null;
  target_value: number | null;
  latest_progress: number | null;
  last_checkin: string | null;
};

export async function getRubricScoresForStudent(studentId: string): Promise<RubricAxisScore[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("rubric_scores")
    .select("axis_code, score, scored_for_month")
    .eq("student_id", studentId)
    .order("scored_for_month", { ascending: false })
    .limit(120); // 6 months × up to 20 axes
  if (error) throw new Error(error.message);

  // Group by axis_code
  const byAxis = new Map<string, Array<{ month: string; score: number }>>();
  for (const row of data ?? []) {
    const key = row.axis_code;
    if (!byAxis.has(key)) byAxis.set(key, []);
    byAxis.get(key)!.push({ month: row.scored_for_month as string, score: Number(row.score) });
  }

  return Array.from(byAxis.entries()).map(([axis_code, history]) => {
    const sorted = [...history].sort((a, b) => b.month.localeCompare(a.month));
    return {
      axis_code,
      this_mo: sorted[0]?.score ?? 0,
      last_mo: sorted[1]?.score ?? 0,
      history: sorted.reverse(),
    };
  });
}

export async function getGoalsForStudent(studentId: string, academicYearId: string): Promise<GoalRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("student_goals")
    .select(`
      id, kind, title, description, due_on, status, metric, target_value,
      goal_checkins ( progress_pct, checked_on )
    `)
    .eq("student_id", studentId)
    .eq("academic_year_id", academicYearId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(g => {
    const checkins = (g.goal_checkins as Array<{ progress_pct: number | null; checked_on: string }> | null) ?? [];
    const sorted = [...checkins].sort((a, b) => b.checked_on.localeCompare(a.checked_on));
    return {
      id: g.id,
      kind: g.kind,
      title: g.title,
      description: g.description,
      due_on: g.due_on,
      status: g.status,
      metric: g.metric,
      target_value: g.target_value ? Number(g.target_value) : null,
      latest_progress: sorted[0]?.progress_pct ?? null,
      last_checkin: sorted[0]?.checked_on ?? null,
    };
  });
}

export async function getAssessmentResultsForStudent(studentId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("assessment_results")
    .select(`
      id, score, is_excused, teacher_comment, recorded_at,
      assessments ( label, kind, held_on, max_score, weight_in_term, subjects ( name_en ) )
    `)
    .eq("student_id", studentId)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
