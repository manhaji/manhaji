"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function signPermissionSlip(
  slipId: string,
  parentId: string,
  signedName: string,
) {
  const db = await serverClient();
  // Records parent signature: who signed, displayed name, timestamp
  const { error } = await db
    .from("permission_slips")
    .update({
      slip_status: "signed",
      signed_by_parent_id: parentId,
      signed_name: signedName,
      signed_at: new Date().toISOString(),
    } as never)
    .eq("id", slipId);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/calendar");
}

export async function declinePermissionSlip(slipId: string) {
  const db = await serverClient();
  const { error } = await db
    .from("permission_slips")
    .update({ slip_status: "declined" } as never)
    .eq("id", slipId);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/calendar");
}
