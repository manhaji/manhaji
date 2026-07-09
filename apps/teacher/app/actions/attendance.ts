"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function saveAttendanceMark(data: {
  student_id: string;
  section_id: string;
  bell_period_id: string;
  school_id: string;
  teacher_id: string;
  marked_on: string;
  status: "present" | "absent" | "late" | "excused" | "unknown";
  reason?: string | null;
  notes?: string | null;
}) {
  const db = await serverClient();
  const { error } = await db
    .from("attendance_marks")
    .upsert(
      {
        student_id:          data.student_id,
        section_id:          data.section_id,
        bell_period_id:      data.bell_period_id,
        school_id:           data.school_id,
        marked_by_teacher_id: data.teacher_id,
        marked_on:           data.marked_on,
        status:              data.status,
        reason:              data.reason ?? null,
        notes:               data.notes ?? null,
      },
      { onConflict: "student_id,marked_on,bell_period_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/attendance");
}

export async function bulkSaveAttendance(marks: {
  student_id: string;
  section_id: string;
  bell_period_id: string;
  school_id: string;
  teacher_id: string;
  marked_on: string;
  status: "present" | "absent" | "late" | "excused" | "unknown";
  reason?: string | null;
  notes?: string | null;
}[]) {
  if (marks.length === 0) return;
  const db = await serverClient();
  const { error } = await db
    .from("attendance_marks")
    .upsert(
      marks.map(m => ({
        student_id:           m.student_id,
        section_id:           m.section_id,
        bell_period_id:       m.bell_period_id,
        school_id:            m.school_id,
        marked_by_teacher_id: m.teacher_id,
        marked_on:            m.marked_on,
        status:               m.status,
        reason:               m.reason ?? null,
        notes:                m.notes ?? null,
      })),
      { onConflict: "student_id,marked_on,bell_period_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/attendance");
}
