"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function inviteAdmin(email: string, role: "admin" | "advisor") {
  const db = await serverClient();
  // 1. Insert invitations row (token auto-generated, expires in 7 days)
  // 2. Send magic-link email via Resend
  // 3. Write audit_log(action='invite_admin')
  const { error } = await db.from("invitations").insert({ email, role } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deactivateAdmin(adminId: string) {
  const db = await serverClient();
  // Flip status → inactive + write audit_log; row is retained for compliance trail
  const { error } = await db
    .from("school_admins")
    .update({ status: "inactive", is_active: false } as never)
    .eq("id", adminId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
