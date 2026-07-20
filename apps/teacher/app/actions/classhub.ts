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

export type NewFollowup = {
  schoolId: string;
  teacherId: string;
  sectionId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  studentId: string | null;
  priority: "high" | "medium" | "low";
};

/** Class-hub Add-follow-up pop-up → section-scoped lesson_followups row (migration 020). */
export async function addFollowup(data: NewFollowup): Promise<{ ok: boolean; error?: string }> {
  if (!data.title.trim()) return { ok: false, error: "Title is required." };
  const db = await serverClient();
  const { error } = await db
    .from("lesson_followups")
    .insert({
      school_id:  data.schoolId,
      teacher_id: data.teacherId,
      section_id: data.sectionId,
      lesson_id:  null,
      title:      data.title.trim(),
      description: data.description?.trim() || null,
      due_date:   data.dueDate || null,
      student_id: data.studentId || null,
      priority:   data.priority,
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/classhub");
  return { ok: true };
}

export type NextWeekPlan = {
  lessonId: string | null;        // existing next-week lesson, or null to create one
  schoolId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  heldOn: string;                 // the planned lesson date (YYYY-MM-DD)
  planNotes: string;
  checklist: { label: string; done: boolean }[];
};

/**
 * Class-hub Next Week page (absorbs the old Input page): writes the
 * next-class summary to lessons.plan_notes and the pre-class checklist to
 * lessons.pre_class_checklist (migration 020). Creates the lesson row when
 * next week has none yet.
 */
export async function saveNextWeekPlan(data: NextWeekPlan): Promise<{ ok: boolean; error?: string; lessonId?: string }> {
  const db = await serverClient();
  if (data.lessonId) {
    const { error } = await db
      .from("lessons")
      .update({
        plan_notes:          data.planNotes || null,
        pre_class_checklist: data.checklist,
      })
      .eq("id", data.lessonId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/teacher/classhub");
    return { ok: true, lessonId: data.lessonId };
  }
  const { data: inserted, error } = await db
    .from("lessons")
    .insert({
      school_id:           data.schoolId,
      section_id:          data.sectionId,
      subject_id:          data.subjectId,
      teacher_id:          data.teacherId,
      held_on:             data.heldOn,
      planned_for_week:    data.heldOn,
      plan_notes:          data.planNotes || null,
      pre_class_checklist: data.checklist,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/classhub");
  return { ok: true, lessonId: inserted?.id };
}

/** Persist a pre-class checklist toggle from the This-week view. */
export async function savePreClassChecklist(lessonId: string, checklist: { label: string; done: boolean }[]) {
  const db = await serverClient();
  const { error } = await db
    .from("lessons")
    .update({ pre_class_checklist: checklist })
    .eq("id", lessonId);
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
