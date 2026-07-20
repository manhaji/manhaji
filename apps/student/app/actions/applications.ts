"use server";

/**
 * Server actions — Application tracker (Sprint 1.5).
 * Writes: applications (+ university_id from migration 020),
 * student_test_scores, booking_requests. All RLS-scoped to the signed-in
 * student; without a session they return { ok: false } and the client keeps
 * a local demo copy — the "OR" pattern.
 */

import { revalidatePath } from "next/cache";
import { serverClient } from "@manhaj/lib/supabase";
import { getStudentCounselor, type UniversityAppStatus } from "@manhaj/lib/queries/applications";

type StudentCtx = { studentId: string; schoolId: string };

async function resolveStudentCtx(): Promise<StudentCtx | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: student } = await db
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();
  if (!student) return null;
  return { studentId: student.id, schoolId: student.school_id };
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ── Add university application ───────────────────────────────────────────────

export type AddApplicationInput = {
  universityId: string | null;   // null → free-text entry
  universityName: string;
  country: string;
  program: string;
  status: UniversityAppStatus;
  deadline?: string;             // YYYY-MM-DD
};

export async function addApplicationAction(input: AddApplicationInput): Promise<ActionResult<{ id: string }>> {
  const name = (input.universityName ?? "").trim();
  if (!name) return { ok: false, error: "Pick a university first." };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const db = await serverClient();
  // university_id landed in migration 020 — not in the generated types yet.
  const row = {
    school_id:       ctx.schoolId,
    student_id:      ctx.studentId,
    university_id:   input.universityId,
    university_name: name,
    country:         input.country || null,
    course:          input.program?.trim() || null,
    status:          input.status,
    deadline:        input.deadline || null,
  };
  const { data, error } = await db
    .from("applications")
    .insert(row as never)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/application-tracker");
  return { ok: true, data: { id: data.id } };
}

// ── Test scores ──────────────────────────────────────────────────────────────

export type AddTestScoreInput = {
  testName: string;
  scoreRaw: string;
  takenOn?: string;   // YYYY-MM-DD
  notes?: string;
};

export async function addTestScoreAction(input: AddTestScoreInput): Promise<ActionResult<{ id: string }>> {
  const testName = (input.testName ?? "").trim();
  const scoreRaw = (input.scoreRaw ?? "").trim();
  if (!testName || !scoreRaw) return { ok: false, error: "Enter the test and your score." };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const numeric = Number.parseFloat(scoreRaw.replace(/[^\d.]/g, ""));
  const db = await serverClient();
  const { data, error } = await db
    .from("student_test_scores")
    .insert({
      school_id:     ctx.schoolId,
      student_id:    ctx.studentId,
      test_name:     testName,
      score_raw:     scoreRaw,
      score_numeric: Number.isFinite(numeric) ? numeric : null,
      taken_on:      input.takenOn || null,
      notes:         input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/application-tracker");
  return { ok: true, data: { id: data.id } };
}

// ── Counselor 1:1 booking request (request-based; calendar sync = Phase 2) ──

export type RequestBookingInput = {
  startIso: string;   // requested slot start (ISO datetime)
  endIso?: string;
  note?: string;
};

export async function requestBookingAction(input: RequestBookingInput): Promise<ActionResult<{ id: string }>> {
  if (!input.startIso) return { ok: false, error: "Pick a time slot first." };

  const ctx = await resolveStudentCtx();
  if (!ctx) return { ok: false, error: "not_signed_in" };

  const counselor = await getStudentCounselor(ctx.studentId);
  if (!counselor?.id) return { ok: false, error: "no_counselor" };

  const db = await serverClient();
  // Table added in migration 020 — not in the generated types yet.
  const row = {
    school_id:       ctx.schoolId,
    student_id:      ctx.studentId,
    counselor_id:    counselor.id,
    requested_start: input.startIso,
    requested_end:   input.endIso ?? null,
    status:          "pending",
    note:            input.note?.trim() || null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("booking_requests")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: (error as { message: string }).message };

  revalidatePath("/student/application-tracker");
  return { ok: true, data: { id: (data as { id: string }).id } };
}
