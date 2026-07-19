"use server";

/**
 * "Reply to school" from the parent dashboard (weekly digest footer).
 *
 * DB-first with demo fallback (the standing "OR" pattern):
 *   1. Try appending to the parent's most recent thread via
 *      manhaj_append_message_public (schema/010).
 *   2. If that fails (no real threads — e.g. the inbox list fell back to
 *      demo fixtures whose ids aren't real rows), create a fresh thread via
 *      manhaj_create_thread_public.
 *   3. If the DB is unreachable entirely, report ok with live=false so the
 *      UI can show a demo confirmation instead of a dead button.
 */

import { revalidatePath } from "next/cache";
import { getCurrentParentId } from "@manhaj/lib/queries/auth";
import { serverClient } from "@manhaj/lib/supabase";
import { createReply, createThread, listThreadsForParent } from "@manhaj/lib/messages";

export type ReplyToSchoolResult =
  | { ok: true; live: boolean }
  | { ok: false; error: string };

export async function replyToSchoolAction(
  body: string,
  studentId: string | null,
  childFirstName: string | null,
): Promise<ReplyToSchoolResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  // Resolve the signed-in parent's name + email (demo defaults otherwise).
  let parentName = "Mr Al-Habsi";
  let parentEmail: string | undefined;
  try {
    const parentId = await getCurrentParentId();
    if (parentId) {
      const db = await serverClient();
      const { data } = await db
        .from("parents")
        .select("full_name, email")
        .eq("id", parentId)
        .maybeSingle();
      if (data?.full_name) parentName = data.full_name;
      if (data?.email) parentEmail = data.email;
    }
  } catch {
    // stay on demo defaults
  }

  // 1. Append to the most recent thread when one exists.
  try {
    const threads = await listThreadsForParent(parentEmail);
    const latest = threads[0];
    if (latest) {
      const messageId = await createReply(latest.id, trimmed, parentName);
      if (messageId) {
        revalidatePath("/parent");
        revalidatePath("/parent/messages");
        return { ok: true, live: true };
      }
      // falls through — the "latest thread" was a demo fixture, not a DB row
    }
  } catch {
    // fall through to create-thread
  }

  // 2. No appendable thread — start a new one.
  try {
    const threadId = await createThread(
      {
        student_id: studentId,
        category: "academic",
        subject: childFirstName ? `Weekly digest — ${childFirstName}` : "Weekly digest reply",
        from_name: parentName,
        from_label: "Parent",
        body: trimmed,
      },
      parentEmail,
    );
    if (threadId) {
      revalidatePath("/parent");
      revalidatePath("/parent/messages");
      return { ok: true, live: true };
    }
  } catch {
    // DB unreachable — demo fallback below
  }

  // 3. Demo fallback — nothing persisted, but the flow still completes.
  return { ok: true, live: false };
}
