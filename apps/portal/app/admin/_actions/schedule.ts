"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertTimetableSlot(slot: {
  id?: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  bell_period_id: string;
  room_id?: string;
  source: "solver" | "human" | "patch";
  is_locked?: boolean;
}) {
  const db = await serverClient();
  // Upsert by id if editing an existing slot; insert if new
  const { error } = await db.from("timetable_slots").upsert(slot as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/schedule");
}

export async function lockTimetableSlot(slotId: string, locked: boolean) {
  const db = await serverClient();
  const { error } = await db
    .from("timetable_slots")
    .update({ is_locked: locked } as never)
    .eq("id", slotId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/schedule");
}

export async function assignSubstituteToSlot(
  slotId: string,
  absenceId: string,
  subTeacherId: string,
) {
  const db = await serverClient();
  // Creates a substitutions row for per-slot sub tracking
  const { error } = await db.from("substitutions").insert({
    slot_id: slotId,
    absence_id: absenceId,
    substitute_teacher_id: subTeacherId,
  } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/schedule");
}
