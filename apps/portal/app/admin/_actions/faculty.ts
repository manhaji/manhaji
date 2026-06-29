"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createTeacher(data: {
  full_name: string;
  primary_dept?: string;
  employment_status?: string;
  staffing_category_id?: string;
  email?: string;
  phone_e164?: string;
  weekly_period_cap?: number;
}) {
  const db = await serverClient();
  const { weekly_period_cap, ...teacherData } = data;
  const { data: teacher, error } = await db
    .from("teachers")
    .insert(teacherData as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (weekly_period_cap) {
    await db.from("teacher_contracts").insert({
      teacher_id: (teacher as { id: string }).id,
      weekly_period_cap,
    } as never);
  }

  revalidatePath("/admin/faculty");
  return teacher;
}

export async function updateTeacher(
  teacherId: string,
  data: Partial<{
    full_name: string;
    primary_dept: string;
    employment_status: string;
    staffing_category_id: string;
  }>,
) {
  const db = await serverClient();
  const { error } = await db.from("teachers").update(data as never).eq("id", teacherId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faculty");
}

export async function approveSickLeave(absenceId: string) {
  const db = await serverClient();
  // Flip status → approved, write approved_by + approved_at
  // Downstream: A7 substitute finder reads this to surface coverage gap
  const { error } = await db
    .from("staff_absences")
    .update({ status: "approved", approved_at: new Date().toISOString() } as never)
    .eq("id", absenceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faculty");
}

export async function rejectSickLeave(absenceId: string) {
  const db = await serverClient();
  const { error } = await db
    .from("staff_absences")
    .update({ status: "rejected" } as never)
    .eq("id", absenceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faculty");
}

export async function assignSubstituteToAbsence(
  absenceId: string,
  subTeacherId: string,
) {
  const db = await serverClient();
  // Assigns sub on the absence row; triggers T6 substitute-sheet build
  const { error } = await db
    .from("staff_absences")
    .update({ sub_teacher_id: subTeacherId } as never)
    .eq("id", absenceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faculty");
}
