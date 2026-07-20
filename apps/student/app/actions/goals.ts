"use server";

/**
 * Server actions — My Goals (Sprint 1.5).
 *
 * All writes go through the signed-in student's own RLS-scoped session
 * (tenant_isolation policies on student_goals / goal_checkins /
 * goal_reflections). When there is no session the action returns
 * { ok: false } and the client keeps a local demo copy — the "OR" pattern.
 */

import { revalidatePath } from "next/cache";
import { serverClient } from "@manhaj/lib/supabase";
import {
  getGoalCheckinHistory,
  type GoalCheckin,
  type GoalKind,
} from "@manhaj/lib/queries/goals";

type StudentCtx = { studentId: string; schoolId: string; academicYearId: string };

async function resolveStudentCtx(): Promise<StudentCtx | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [{ data: student }, { data: year }] = await Promise.all([
    db.from("students").select("id, school_id").eq("user_id", user.id).single(),
    db.from("academic_years").select("id").eq("is_current", true).single(),
  ]);
  if (!student || !year) return null;
  return { studentId: student.id, schoolId: student.school_id, academicYearId: year.id };
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type AddGoalInput = {
  title: string;
  kind: GoalKind;
  description?: string;
  dueOn?: string;        // YYYY-MM-DD
  targetValue?: number;
};

export async function addGoalAction(input: AddGoalInput): Promise<ActionResult<{ id: string }>> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Give your goal a name first." };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const db = await serverClient();
  const { data, error } = await db
    .from("student_goals")
    .insert({
      school_id:        ctx.schoolId,
      student_id:       ctx.studentId,
      academic_year_id: ctx.academicYearId,
      kind:             input.kind,
      title,
      description:      input.description?.trim() || null,
      due_on:           input.dueOn || null,
      target_value:     input.targetValue ?? null,
      status:           "on_track",
      created_by_role:  "student",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/goals");
  return { ok: true, data: { id: data.id } };
}

/** "See history" — check-ins for one goal, newest first. */
export async function fetchGoalHistoryAction(goalId: string): Promise<ActionResult<GoalCheckin[]>> {
  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };
  const checkins = await getGoalCheckinHistory(goalId);
  return { ok: true, data: checkins };
}

/** Daily tick / weekly check-in on a goal → goal_checkins row. */
export async function tickGoalAction(goalId: string, progressPct?: number): Promise<ActionResult> {
  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  const { error } = await db.from("goal_checkins").insert({
    goal_id:      goalId,
    checked_on:   new Date().toISOString().slice(0, 10),
    progress_pct: progressPct ?? null,
    source:       "student",
    checked_by:   user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/goals");
  return { ok: true };
}

/**
 * Save the monthly reflection → goal_reflections.
 * goal_reflections.goal_id is NOT NULL, so the reflection attaches to the
 * student's most recent goal; if the student has none yet, a lightweight
 * personal goal is created to hold reflections.
 */
export async function saveReflectionAction(body: string): Promise<ActionResult> {
  const text = (body ?? "").trim();
  if (!text) return { ok: false, error: "Write a sentence or two first." };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const db = await serverClient();

  // Attach to the most recent goal, or create a holder goal if none exist.
  let goalId: string | null = null;
  const { data: goals } = await db
    .from("student_goals")
    .select("id")
    .eq("student_id", ctx.studentId)
    .order("created_at", { ascending: false })
    .limit(1);
  goalId = goals?.[0]?.id ?? null;

  if (!goalId) {
    const { data: created, error: createErr } = await db
      .from("student_goals")
      .insert({
        school_id:        ctx.schoolId,
        student_id:       ctx.studentId,
        academic_year_id: ctx.academicYearId,
        kind:             "personal",
        title:            "Reflect on my month",
        description:      "Created automatically to hold your monthly reflections.",
        status:           "on_track",
        created_by_role:  "student",
      })
      .select("id")
      .single();
    if (createErr || !created) return { ok: false, error: createErr?.message ?? "Could not save." };
    goalId = created.id;
  }

  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { error } = await db.from("goal_reflections").insert({
    goal_id:    goalId,
    student_id: ctx.studentId,
    body:       text,
    month,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/goals");
  return { ok: true };
}
