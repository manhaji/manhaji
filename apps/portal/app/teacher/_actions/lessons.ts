"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertLessonPlan(data: {
  id?: string;
  timetable_slot_id: string;
  date: string;
  objectives?: string;
  activities?: string;
  resources?: string;
  notes?: string;
}) {
  const db = await serverClient();
  // Upsert on (timetable_slot_id, date) if no id provided
  const { data: plan, error } = await db
    .from("lesson_plans")
    .upsert(data as never, { onConflict: data.id ? "id" : "timetable_slot_id,date" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
  return plan;
}

export async function saveLessonSummary(data: {
  lesson_plan_id: string;
  coverage_notes?: string;
  student_engagement?: "low" | "medium" | "high";
  follow_up_needed?: boolean;
}) {
  const db = await serverClient();
  // Summary is written post-lesson; updates the plan row
  const { error } = await db
    .from("lesson_plans")
    .update(data as never)
    .eq("id", data.lesson_plan_id);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}
