"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createCommDraft(data: {
  template_id: string;
  student_id: string;
  parent_id: string;
  slot_values?: Record<string, string>;
}) {
  const db = await serverClient();
  // Claude fills slots from the template; draft stored for principal review
  const { data: draft, error } = await db
    .from("comm_drafts")
    .insert({ ...data, status: "draft" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reports");
  return draft;
}

export async function sendCommDraft(draftId: string) {
  const db = await serverClient();
  // 1. Check consent_records + section.is_mapped
  // 2. Send via Resend → get sent_message_id
  // 3. Update comm_drafts.status='sent', sent_at, sent_message_id
  // 4. Insert report_archive row with retention clock
  // 5. Write audit_log(action='approve_report')
  const { error } = await db
    .from("comm_drafts")
    .update({ status: "sent", sent_at: new Date().toISOString() } as never)
    .eq("id", draftId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reports");
}

export async function archiveReport(data: {
  report_kind: string;
  scope: string;
  scope_ref_id?: string;
  student_id?: string;
  parent_id?: string;
  storage_path: string;
  sent_at?: string;
  delete_after?: string;
}) {
  const db = await serverClient();
  const { error } = await db.from("report_archive").insert(data as never);
  if (error) throw new Error(error.message);
}

export async function saveSectionMapping(
  sectionId: string,
  mappedBy: string,
) {
  const db = await serverClient();
  const { error } = await db
    .from("sections")
    .update({
      is_mapped: true,
      mapped_at: new Date().toISOString(),
      mapped_by: mappedBy,
    } as never)
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/section-mapping");
}
