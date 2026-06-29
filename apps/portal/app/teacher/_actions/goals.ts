"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function setStudentGoal(data: {
  student_id: string;
  academic_year_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  target_date?: string;
}) {
  const db = await serverClient();
  // Teacher-authored goal assigned to a student
  const { data: goal, error } = await db
    .from("student_goals")
    .insert({ ...data, set_by: "teacher" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
  return goal;
}

export async function updateGoalStatus(
  goalId: string,
  status: "active" | "achieved" | "dropped",
) {
  const db = await serverClient();
  const { error } = await db
    .from("student_goals")
    .update({ status } as never)
    .eq("id", goalId);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}
