"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertStudyBlock(data: {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  subject_id?: string;
  goal_id?: string;
  notes?: string;
}) {
  const db = await serverClient();
  // Persists a drag-positioned study block; student_id from RLS context
  const { error } = await db
    .from("study_blocks")
    .upsert(data as never, { onConflict: data.id ? "id" : "student_id,date,start_time" });
  if (error) throw new Error(error.message);
  revalidatePath("/student/schedule");
}

export async function deleteStudyBlock(blockId: string) {
  const db = await serverClient();
  const { error } = await db.from("study_blocks").delete().eq("id", blockId);
  if (error) throw new Error(error.message);
  revalidatePath("/student/schedule");
}
