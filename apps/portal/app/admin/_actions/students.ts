"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createStudent(data: {
  full_name_en: string;
  full_name_ar?: string;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  external_ref?: string;
  section_id?: string;
  parent_id?: string;
}) {
  const db = await serverClient();
  // 1. Insert students row
  // 2. Insert student_enrollments if section_id provided
  // 3. Insert student_parents if parent_id provided
  // 4. Write audit_log
  const { data: student, error } = await db
    .from("students")
    .insert({ ...data, enrolled_on: new Date().toISOString().slice(0, 10) } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/input");
  return student;
}

export async function updateStudent(
  studentId: string,
  data: Partial<{
    full_name_en: string;
    full_name_ar: string;
    gender: string;
    date_of_birth: string;
    nationality: string;
    advisor_id: string;
  }>,
) {
  const db = await serverClient();
  const { error } = await db.from("students").update(data as never).eq("id", studentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}

export async function markStudentWithdrawn(
  studentId: string,
  withdrawn_reason: string,
) {
  const db = await serverClient();
  const { error } = await db
    .from("students")
    .update({
      withdrawn_on: new Date().toISOString().slice(0, 10),
      withdrawn_reason,
    } as never)
    .eq("id", studentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}

export async function convertApplicantToStudent(applicantId: string, sectionId: string) {
  const db = await serverClient();
  // 1. Read applicant row
  // 2. Insert students + student_enrollments
  // 3. Update applicants.converted_student_id + stage='admitted'
  // 4. Write audit_log
  const { data: applicant, error: fetchErr } = await db
    .from("applicants")
    .select("*")
    .eq("id", applicantId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { data: student, error: insertErr } = await db
    .from("students")
    .insert({ full_name_en: (applicant as never as { full_name: string }).full_name, enrolled_on: new Date().toISOString().slice(0, 10) } as never)
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  await db.from("student_enrollments").insert({ student_id: (student as { id: string }).id, section_id: sectionId } as never);
  await db.from("applicants").update({ converted_student_id: (student as { id: string }).id, stage: "accepted" } as never).eq("id", applicantId);

  revalidatePath("/admin/students");
  return student;
}
