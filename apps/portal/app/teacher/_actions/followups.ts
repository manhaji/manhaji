"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createLessonFollowup(data: {
  lesson_plan_id: string;
  student_id?: string;
  target_teacher_id?: string;
  tag?: string;
  notes: string;
}) {
  const db = await serverClient();
  const { data: followup, error } = await db
    .from("lesson_followups")
    .insert({ ...data, is_done: false } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
  return followup;
}

export async function completeLessonFollowup(followupId: string, resolution_notes?: string) {
  const db = await serverClient();
  const { error } = await db
    .from("lesson_followups")
    .update({
      is_done: true,
      resolution_notes,
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", followupId);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}

export async function updateFollowupTag(followupId: string, tag: string) {
  const db = await serverClient();
  const { error } = await db
    .from("lesson_followups")
    .update({ tag } as never)
    .eq("id", followupId);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}
