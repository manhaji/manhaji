"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function addUniversityApplication(data: {
  university_name: string;
  course: string;
  country?: string;
  intake_year?: number;
  intake_term?: string;
  deadline?: string;
  notes?: string;
}) {
  const db = await serverClient();
  // student_id resolved from RLS; status defaults to 'researching'
  const { data: application, error } = await db
    .from("applications")
    .insert({ ...data, status: "researching" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
  return application;
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "researching" | "in_progress" | "submitted" | "interview" | "admitted" | "rejected" | "withdrawn",
) {
  const db = await serverClient();
  const { error } = await db
    .from("applications")
    .update({ status } as never)
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
}

export async function addApplicationGrade(data: {
  application_id?: string;
  subject: string;
  value: string;
  grade_type?: string;
  notes?: string;
}) {
  const db = await serverClient();
  // application_id nullable — grade may apply across all applications
  const { error } = await db.from("application_grades").insert(data as never);
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
}

export async function upsertPersonalStatementDraft(data: {
  id?: string;
  application_id: string;
  body: string;
  word_count?: number;
}) {
  const db = await serverClient();
  const { data: draft, error } = await db
    .from("personal_statements")
    .upsert(data as never, { onConflict: data.id ? "id" : "application_id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/student/growth");
  return draft;
}
