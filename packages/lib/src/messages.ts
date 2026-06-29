/**
 * Server-side wrappers for the messages RPCs in schema/010.
 *
 * All four functions return the same shapes as lib/mock-messages.ts so the
 * UI components don't need re-typing. On error the wrapper logs + returns
 * a safe fallback (empty list / no-op).
 */

import { serverClient } from "./supabase";
import { MOCK_THREADS, type Thread, type MessageCategory } from "./mock-messages";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";
const DEMO_PARENT_EMAIL = "mahmoud.al-habsi@example.com";

/**
 * Phase 2.4b-1.1 — demo fallback.
 *
 * When the Postgres-backed inbox is empty (e.g. the schema/seed haven't
 * been applied yet on a fresh deploy), fall back to the 12 demo threads
 * in `mock-messages` so the demo stays visually rich. Any real thread in
 * Postgres wins — the fallback only fires when the RPC returns zero rows
 * or errors. Disable with MESSAGES_NO_FALLBACK=true.
 */
const DISABLE_MOCK_FALLBACK = process.env.MESSAGES_NO_FALLBACK === "true";

export type NewThreadPayload = {
  student_id:  string | null;   // null for household
  category:    MessageCategory;
  subject:     string;
  from_name:   string;
  from_label:  string;
  body:        string;
};

/** Fetch threads + nested messages for the (demo) parent. */
export async function listThreadsForParent(
  parentEmail: string = DEMO_PARENT_EMAIL,
): Promise<Thread[]> {
  const sb = await serverClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("manhaj_threads_for_parent_public", {
    p_school_name:  SCHOOL_NAME,
    p_parent_email: parentEmail,
  });
  if (error) {
    console.error("[messages] listThreadsForParent failed:", error);
    return DISABLE_MOCK_FALLBACK ? [] : MOCK_THREADS;
  }
  const threads = (data as Thread[]) ?? [];
  if (threads.length === 0 && !DISABLE_MOCK_FALLBACK) {
    console.warn("[messages] DB returned 0 threads — falling back to MOCK_THREADS for demo");
    return MOCK_THREADS;
  }
  return threads;
}

/** Append a parent reply to an existing thread. Returns the new message id. */
export async function createReply(
  threadId: string,
  body:     string,
  parentName: string = "Mr Al-Habsi",
): Promise<string | null> {
  const sb = await serverClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("manhaj_append_message_public", {
    p_thread_id:  threadId,
    p_role:       "parent",
    p_from_name:  parentName,
    p_from_label: "Parent",
    p_body:       body,
  });
  if (error) {
    console.error("[messages] createReply failed:", error);
    return null;
  }
  return (data as string) ?? null;
}

/** Create a brand-new thread + initial parent message. Returns the new thread id. */
export async function createThread(
  payload:    NewThreadPayload,
  parentEmail: string = DEMO_PARENT_EMAIL,
): Promise<string | null> {
  const sb = await serverClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("manhaj_create_thread_public", {
    p_school_name:  SCHOOL_NAME,
    p_parent_email: parentEmail,
    p_student_id:   payload.student_id,
    p_category:     payload.category,
    p_subject:      payload.subject,
    p_from_name:    payload.from_name,
    p_from_label:   payload.from_label,
    p_body:         payload.body,
  });
  if (error) {
    console.error("[messages] createThread failed:", error);
    return null;
  }
  return (data as string) ?? null;
}

/** Clear the unread flag on a thread. */
export async function markThreadRead(threadId: string): Promise<void> {
  const sb = await serverClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).rpc("manhaj_mark_thread_read_public", {
    p_thread_id: threadId,
  });
  if (error) {
    console.error("[messages] markThreadRead failed:", error);
  }
}
