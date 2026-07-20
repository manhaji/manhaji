"use server";

/**
 * Admissions server actions — Sprint 1.5 wiring.
 *
 * Real DB writes via the RLS-scoped serverClient (no service role). Every
 * write verifies a row actually changed (`.select("id")`) so an RLS miss
 * surfaces as an error instead of a silent no-op.
 *
 * Payload casts (`as never`) follow the existing convention in
 * apps/portal/app/admin/_actions/applicants.ts: migration 020 columns are
 * live but types/supabase.ts has not been regenerated yet.
 */

import { revalidatePath } from "next/cache";
import { serverClient } from "@manhaj/lib/supabase";
import { getRetentionSummary, type RetentionSummary } from "@manhaj/lib/queries/admissions";

const VALID_LEAVER_REASONS = ["graduating", "relocating", "fees", "dissatisfaction", "other"];
const VALID_STAGES = ["new", "review", "interview", "offer", "accepted", "rejected", "withdrawn"];

type Result = { ok: true } | { ok: false; error: string };

/**
 * Confirm-No-Re-enrollment: writes final_enrollment_date (end of the current
 * academic year), leaver_reason and leaver_comment on the student row.
 */
export async function confirmNoReEnrollmentAction(
  studentId: string,
  reason: string,
  comment: string,
): Promise<Result> {
  if (!studentId) return { ok: false, error: "Missing student." };
  if (!VALID_LEAVER_REASONS.includes(reason)) {
    return { ok: false, error: "Please pick a leaver reason." };
  }

  const db = await serverClient();

  // Final enrollment date = last day of the current academic year.
  const { data: ay } = await db
    .from("academic_years")
    .select("ends_on")
    .eq("is_current", true)
    .maybeSingle();
  const finalDate = ay?.ends_on ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from("students")
    .update({
      final_enrollment_date: finalDate,
      leaver_reason: reason,
      leaver_comment: comment.trim() || null,
    } as never)
    .eq("id", studentId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "No student row was updated — check you are signed in with school access." };
  }

  revalidatePath("/attendance");
  return { ok: true };
}

export type SaveApplicantInput = {
  id?: string; // present = edit existing applicant
  full_name: string;
  target_grade: string;
  stage: string;
  source?: string;
  notes?: string;
  parent_id?: string | null;
  new_parent?: { full_name: string; email?: string; phone_e164?: string } | null;
};

/**
 * Create or update an applicant. Optionally creates a new parent row first
 * (the "add new parent" inline option) and links it via applicants.parent_id.
 */
export async function saveApplicantAction(input: SaveApplicantInput): Promise<Result> {
  const fullName = (input.full_name ?? "").trim();
  const targetGrade = (input.target_grade ?? "").trim();
  if (!fullName) return { ok: false, error: "Applicant name is required." };
  if (!targetGrade) return { ok: false, error: "Target grade is required." };
  if (!VALID_STAGES.includes(input.stage)) return { ok: false, error: "Invalid pipeline stage." };

  const db = await serverClient();

  // school_id + academic_year_id come from the current academic year row.
  const { data: ay, error: ayError } = await db
    .from("academic_years")
    .select("id, school_id")
    .eq("is_current", true)
    .maybeSingle();
  if (ayError) return { ok: false, error: ayError.message };
  if (!ay) return { ok: false, error: "Could not resolve the current academic year — are you signed in?" };

  // Inline "add new parent" — create the parent row first.
  let parentId = input.parent_id ?? null;
  if (input.new_parent) {
    const parentName = input.new_parent.full_name.trim();
    if (!parentName) return { ok: false, error: "New parent name is required." };
    const { data: parent, error: parentError } = await db
      .from("parents")
      .insert({
        school_id: ay.school_id,
        full_name: parentName,
        email: input.new_parent.email?.trim() || null,
        phone_e164: input.new_parent.phone_e164?.trim() || null,
      } as never)
      .select("id")
      .single();
    if (parentError) return { ok: false, error: `Could not create parent: ${parentError.message}` };
    parentId = (parent as { id: string }).id;
  }

  const fields = {
    full_name: fullName,
    target_grade: targetGrade,
    stage: input.stage,
    source: input.source?.trim() || null,
    notes: input.notes?.trim() || null,
    parent_id: parentId,
  };

  if (input.id) {
    const { data, error } = await db
      .from("applicants")
      .update({ ...fields, updated_at: new Date().toISOString() } as never)
      .eq("id", input.id)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: "No applicant row was updated — check you are signed in with school access." };
    }
  } else {
    const { error } = await db
      .from("applicants")
      .insert({
        ...fields,
        school_id: ay.school_id,
        academic_year_id: ay.id,
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/attendance");
  return { ok: true };
}

/** Fetch the data-plug retention summary for one student (called when the pop-up opens). */
export async function fetchRetentionSummaryAction(
  studentId: string,
): Promise<{ ok: true; summary: RetentionSummary } | { ok: false; error: string }> {
  if (!studentId) return { ok: false, error: "Missing student." };
  try {
    const summary = await getRetentionSummary(studentId);
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load the retention summary." };
  }
}
