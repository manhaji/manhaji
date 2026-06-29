"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertAttendanceMark(data: {
  student_id: string;
  section_id: string;
  date: string;
  period: number;
  status: "present" | "absent" | "late" | "excused";
  notes?: string;
}) {
  const db = await serverClient();
  // Upsert on (student_id, section_id, date, period) unique key
  const { error } = await db
    .from("attendance_marks")
    .upsert(data as never, { onConflict: "student_id,section_id,date,period" });
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}

export async function bulkUpsertAttendance(
  marks: {
    student_id: string;
    section_id: string;
    date: string;
    period: number;
    status: "present" | "absent" | "late" | "excused";
  }[],
) {
  const db = await serverClient();
  // Batch upsert for whole-class daily submission
  const { error } = await db
    .from("attendance_marks")
    .upsert(marks as never[], { onConflict: "student_id,section_id,date,period" });
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}
