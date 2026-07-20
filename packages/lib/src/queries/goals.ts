import { serverClient } from "../supabase";

export type GoalStudentProfile = {
  studentName: string;
};

export type GoalKind = "academic" | "behavioural" | "personal" | "university_prep";
export type GoalDbStatus = "on_track" | "at_risk" | "met" | "missed";

export type StudentGoal = {
  id: string;
  title: string;
  kind: GoalKind;
  description: string | null;
  dueOn: string | null;
  status: GoalDbStatus;
  createdByRole: string;
  targetValue: number | null;
  /** Latest check-in progress, 0-100 (null = no check-ins yet). */
  progressPct: number | null;
  lastCheckinOn: string | null;
  checkinCount: number;
};

export type GoalCheckin = {
  id: string;
  checkedOn: string;
  progressPct: number | null;
  value: number | null;
  notes: string | null;
  source: string;
};

export type GoalReflection = {
  id: string;
  body: string;
  month: string | null;
  createdAt: string;
};

/** All goals for a student, newest first, with latest check-in progress. */
export async function getStudentGoals(studentId: string): Promise<StudentGoal[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("student_goals")
    .select(`
      id, title, kind, description, due_on, status, created_by_role, target_value,
      goal_checkins ( id, checked_on, progress_pct )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(g => {
    const checkins = ((g.goal_checkins ?? []) as Array<{ id: string; checked_on: string; progress_pct: number | null }>)
      .sort((a, b) => (a.checked_on < b.checked_on ? 1 : -1));
    const latest = checkins[0] ?? null;
    return {
      id:            g.id,
      title:         g.title,
      kind:          g.kind as GoalKind,
      description:   g.description,
      dueOn:         g.due_on,
      status:        g.status as GoalDbStatus,
      createdByRole: g.created_by_role,
      targetValue:   g.target_value,
      progressPct:   latest?.progress_pct ?? null,
      lastCheckinOn: latest?.checked_on ?? null,
      checkinCount:  checkins.length,
    };
  });
}

/** Check-in history for one goal, newest first. */
export async function getGoalCheckinHistory(goalId: string): Promise<GoalCheckin[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("goal_checkins")
    .select("id, checked_on, progress_pct, value, notes, source")
    .eq("goal_id", goalId)
    .order("checked_on", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map(c => ({
    id:          c.id,
    checkedOn:   c.checked_on,
    progressPct: c.progress_pct,
    value:       c.value,
    notes:       c.notes,
    source:      c.source,
  }));
}

/** Latest saved reflection for a student (most recent first). */
export async function getLatestReflection(studentId: string): Promise<GoalReflection | null> {
  const db = await serverClient();
  const { data, error } = await db
    .from("goal_reflections")
    .select("id, body, month, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return {
    id:        data[0].id,
    body:      data[0].body,
    month:     data[0].month,
    createdAt: data[0].created_at,
  };
}

export type RubricSuggestionData = {
  axisCode: string;
  score: number | null;
};

export async function getGoalStudentProfile(studentId: string): Promise<GoalStudentProfile> {
  const db = await serverClient();
  const { data } = await db
    .from("students")
    .select("full_name_en")
    .eq("id", studentId)
    .single();
  return {
    studentName: data?.full_name_en ?? "",
  };
}

export async function getStudentLatestRubricScores(studentId: string): Promise<RubricSuggestionData[]> {
  const db = await serverClient();
  const { data } = await db
    .from("rubric_scores")
    .select("axis_code, score")
    .eq("student_id", studentId)
    .order("scored_for_month", { ascending: false })
    .limit(20);
  if (!data?.length) return [];
  const seen = new Set<string>();
  return (data ?? []).filter(r => {
    if (seen.has(r.axis_code)) return false;
    seen.add(r.axis_code);
    return true;
  }).map(r => ({ axisCode: r.axis_code, score: r.score }));
}
