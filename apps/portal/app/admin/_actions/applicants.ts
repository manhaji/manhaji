"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function createApplicant(data: {
  full_name: string;
  target_grade: string;
  email?: string;
  phone_e164?: string;
  source?: string;
  notes?: string;
}) {
  const db = await serverClient();
  const { data: applicant, error } = await db
    .from("applicants")
    .insert({ ...data, stage: "new" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
  return applicant;
}

export async function updateApplicantStage(
  applicantId: string,
  stage: "new" | "review" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn",
) {
  const db = await serverClient();
  const { error } = await db
    .from("applicants")
    .update({ stage } as never)
    .eq("id", applicantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}

export async function createRiskFlag(data: {
  student_id: string;
  academic_year_id: string;
  severity: "low" | "medium" | "high";
  category: string;
  reason: string;
  owner_id?: string;
}) {
  const db = await serverClient();
  // owner defaults to students.advisor_id; RLS scopes advisors to their flags
  const { error } = await db
    .from("risk_flags")
    .insert({ ...data, status: "open" } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}

export async function resolveRiskFlag(flagId: string, resolution_notes: string) {
  const db = await serverClient();
  const { error } = await db
    .from("risk_flags")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes,
    } as never)
    .eq("id", flagId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}
