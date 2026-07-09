"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function toggleFollowup(id: string, isDone: boolean) {
  const db = await serverClient();
  const { error } = await db
    .from("lesson_followups")
    .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/classhub");
}

export async function saveCommDraft(data: {
  teacherId: string;
  schoolId: string;
  draftEn: string;
  draftId: string | null;
}) {
  const db = await serverClient();
  if (data.draftId) {
    const { error } = await db
      .from("comm_drafts")
      .update({ edited_en: data.draftEn })
      .eq("id", data.draftId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("comm_drafts")
      .insert({
        teacher_id: data.teacherId,
        school_id:  data.schoolId,
        drafted_en: data.draftEn,
        status:     "draft",
      });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/teacher/classhub");
}
