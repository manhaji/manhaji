"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertLessonPlan(data: {
  id?: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  held_on: string;
  topic?: string;
  plan_kind?: "standard" | "cover" | "assessment" | "trip";
  homework_description?: string;
  homework_due_date?: string;
  planned_for_week?: string;
}) {
  const db = await serverClient();
  const { data: lesson, error } = await db
    .from("lessons")
    .upsert(data as never, { onConflict: data.id ? "id" : "section_id,subject_id,held_on" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
  return lesson;
}

export async function saveLessonSummary(data: {
  id: string;
  topic?: string;
  homework_description?: string;
  homework_due_date?: string;
}) {
  const db = await serverClient();
  const { id, ...updates } = data;
  const { error } = await db
    .from("lessons")
    .update(updates as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}
