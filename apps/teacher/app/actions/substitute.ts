"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function acknowledgeSheet(sheetId: string) {
  const db = await serverClient();
  const { error } = await db
    .from("substitute_sheets")
    .update({ ack_at: new Date().toISOString() })
    .eq("id", sheetId);
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/substitute");
}
