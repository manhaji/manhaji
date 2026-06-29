"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createStudentGoal(data: {
  academic_year_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  target_date?: string;
}) {
  const db = await serverClient();
  // Student-authored goal; set_by='student', student_id resolved from JWT via RLS
  const { data: goal, error } = await db
    .from("student_goals")
    .insert({ ...data, set_by: "student" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
  return goal;
}

export async function checkInGoal(goalId: string, notes: string) {
  const db = await serverClient();
  // Weekly check-in creates a goal_checkins row
  const { error } = await db
    .from("goal_checkins")
    .insert({ goal_id: goalId, notes, checked_in_at: new Date().toISOString() } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
}

export async function reflectOnGoal(goalId: string, reflection: string) {
  const db = await serverClient();
  // End-of-cycle reflection stored on the goal row
  const { error } = await db
    .from("student_goals")
    .update({ reflection, status: "achieved" } as never)
    .eq("id", goalId);
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
}
