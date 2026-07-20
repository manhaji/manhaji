"use server";

/**
 * Server actions — Study planner wrap-up tasks (Sprint 1.5).
 * Each wrap-up task maps to a study_blocks row for today; ticking it
 * persists study_blocks.is_done (migration 020). Without a session the
 * action returns { ok: false } and the checkbox stays local (demo mode).
 */

import { revalidatePath } from "next/cache";
import { serverClient } from "@manhaj/lib/supabase";

type StudentCtx = { studentId: string; schoolId: string };

async function resolveStudentCtx(): Promise<StudentCtx | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: student } = await db
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();
  if (!student) return null;
  return { studentId: student.id, schoolId: student.school_id };
}

export type SetWrapupDoneResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle a wrap-up task. Finds the student's study block for (date, title)
 * and updates is_done; creates the block first if it doesn't exist yet
 * (tasks derived from homework don't have a block until first tick).
 */
export async function setWrapupDoneAction(
  title: string,
  date: string,          // YYYY-MM-DD
  done: boolean,
): Promise<SetWrapupDoneResult> {
  const taskTitle = (title ?? "").trim();
  if (!taskTitle) return { ok: false, error: "missing_title" };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const db = await serverClient();
  // is_done landed in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: existing, error: findErr } = await anyDb
    .from("study_blocks")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("block_date", date)
    .eq("title", taskTitle)
    .limit(1);
  if (findErr) return { ok: false, error: (findErr as { message: string }).message };

  if (existing?.length) {
    const { error } = await anyDb
      .from("study_blocks")
      .update({ is_done: done })
      .eq("id", existing[0].id);
    if (error) return { ok: false, error: (error as { message: string }).message };
  } else {
    const { error } = await anyDb.from("study_blocks").insert({
      school_id:  ctx.schoolId,
      student_id: ctx.studentId,
      title:      taskTitle,
      block_date: date,
      start_time: "15:00",
      end_time:   "15:30",
      kind:       "study",
      origin:     "edited",
      is_done:    done,
    });
    if (error) return { ok: false, error: (error as { message: string }).message };
  }

  revalidatePath("/student/study-planner");
  return { ok: true };
}
