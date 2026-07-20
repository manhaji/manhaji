import { serverClient } from "../supabase";

/**
 * Admissions queries — re-enrollment funnel + student-applicant pipeline.
 *
 * NOTE ON TYPES: migration 020 (live on the target DB) added
 *   students.re_enrolled_on / final_enrollment_date / leaver_reason / leaver_comment
 *   applicants.parent_id / owner_admin_id / updated_at
 * but src/types/supabase.ts has not been regenerated yet, so the queries below
 * cast their results. The columns exist live — only the generated types lag.
 * Remove the casts once the types file is regenerated.
 */

export type ReEnrollParent = {
  id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
};

export type ReEnrollStudent = {
  id: string;
  full_name_en: string;
  section_code: string | null;
  grade_level: string | null;
  re_enrolled_on: string | null;
  final_enrollment_date: string | null;
  leaver_reason: string | null;
  leaver_comment: string | null;
  risk_flags: Array<{ severity: string; category: string }>;
  parent: ReEnrollParent | null;
};

type RawRosterRow = {
  id: string;
  full_name_en: string;
  re_enrolled_on: string | null;
  final_enrollment_date: string | null;
  leaver_reason: string | null;
  leaver_comment: string | null;
  sections: { code: string; grade_level: string | null } | null;
  risk_flags: Array<{ severity: string; category: string; status: string; academic_year_id: string }> | null;
  student_parents: Array<{
    is_primary: boolean | null;
    parents: { id: string; full_name: string; email: string | null; phone_e164: string | null } | null;
  }> | null;
};

/** Every non-withdrawn student with re-enrollment columns, open risk flags and primary parent contact. */
export async function getReEnrollmentRoster(academicYearId: string | null): Promise<ReEnrollStudent[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select(`
      id, full_name_en, re_enrolled_on, final_enrollment_date, leaver_reason, leaver_comment,
      sections:current_section_id ( code, grade_level ),
      risk_flags ( severity, category, status, academic_year_id ),
      student_parents ( is_primary, parents ( id, full_name, email, phone_e164 ) )
    `)
    .is("withdrawn_on", null)
    .order("full_name_en");
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawRosterRow[]).map(s => {
    const links = s.student_parents ?? [];
    const primary = links.find(l => l.is_primary && l.parents) ?? links.find(l => l.parents) ?? null;
    return {
      id: s.id,
      full_name_en: s.full_name_en,
      section_code: s.sections?.code ?? null,
      grade_level: s.sections?.grade_level ?? null,
      re_enrolled_on: s.re_enrolled_on,
      final_enrollment_date: s.final_enrollment_date,
      leaver_reason: s.leaver_reason,
      leaver_comment: s.leaver_comment,
      risk_flags: (s.risk_flags ?? [])
        .filter(f => f.status === "open" && (!academicYearId || f.academic_year_id === academicYearId))
        .map(({ severity, category }) => ({ severity, category })),
      parent: primary?.parents ?? null,
    };
  });
}

export type AdmissionApplicant = {
  id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  target_grade: string;
  stage: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  parent_id: string | null;
  parent_name: string | null;
  parent_email: string | null;
};

type RawApplicantRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  target_grade: string;
  stage: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  parent_id: string | null;
  parents: { full_name: string; email: string | null } | null;
};

/** Applicant pipeline for the admissions screen, with the linked parent (migration 020). */
export async function getApplicantsForAdmissions(academicYearId: string): Promise<AdmissionApplicant[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("applicants")
    .select(`
      id, full_name, email, phone_e164, target_grade, stage, source, notes, created_at,
      parent_id, parents:parent_id ( full_name, email )
    `)
    .eq("academic_year_id", academicYearId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawApplicantRow[]).map(a => ({
    id: a.id,
    full_name: a.full_name,
    email: a.email,
    phone_e164: a.phone_e164,
    target_grade: a.target_grade,
    stage: a.stage,
    source: a.source,
    notes: a.notes,
    created_at: a.created_at,
    parent_id: a.parent_id,
    parent_name: a.parents?.full_name ?? null,
    parent_email: a.parents?.email ?? null,
  }));
}

export type ParentOption = {
  id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
};

/** All parents for the searchable dropdown in the Add-applicant pop-up (~840 rows). */
export async function getParentOptions(): Promise<ParentOption[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("parents")
    .select("id, full_name, email, phone_e164")
    .order("full_name")
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type RetentionSummary = {
  student: {
    id: string;
    name: string;
    section_code: string | null;
    grade_level: string | null;
    re_enrolled_on: string | null;
    final_enrollment_date: string | null;
    leaver_reason: string | null;
  };
  parent: ReEnrollParent | null;
  /** Attendance over the last 90 days; null when no marks exist. */
  attendance: { pct: number; absences: number; lates: number; marks: number } | null;
  riskFlags: Array<{ severity: string; category: string; reason: string }>;
  /** Fee snapshot; null when the invoices query fails, zero counts when simply no invoices. */
  fees: { invoices: number; unpaid: number; overdue: number; owedAed: number } | null;
};

type RawSummaryStudent = {
  id: string;
  full_name_en: string;
  re_enrolled_on: string | null;
  final_enrollment_date: string | null;
  leaver_reason: string | null;
  sections: { code: string; grade_level: string | null } | null;
  risk_flags: Array<{ severity: string; category: string; reason: string; status: string }> | null;
  student_parents: Array<{
    is_primary: boolean | null;
    parents: { id: string; full_name: string; email: string | null; phone_e164: string | null } | null;
  }> | null;
};

/** Data-plug retention summary for one family/student (no AI). */
export async function getRetentionSummary(studentId: string): Promise<RetentionSummary> {
  const db = await serverClient();
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const [studentRes, marksRes, invoicesRes] = await Promise.all([
    db.from("students")
      .select(`
        id, full_name_en, re_enrolled_on, final_enrollment_date, leaver_reason,
        sections:current_section_id ( code, grade_level ),
        risk_flags ( severity, category, reason, status ),
        student_parents ( is_primary, parents ( id, full_name, email, phone_e164 ) )
      `)
      .eq("id", studentId)
      .single(),
    db.from("attendance_marks")
      .select("status")
      .eq("student_id", studentId)
      .gte("marked_on", from),
    db.from("invoices")
      .select("status, amount_owed_aed")
      .eq("student_id", studentId),
  ]);

  if (studentRes.error) throw new Error(studentRes.error.message);
  const s = studentRes.data as unknown as RawSummaryStudent;

  const links = s.student_parents ?? [];
  const primary = links.find(l => l.is_primary && l.parents) ?? links.find(l => l.parents) ?? null;

  let attendance: RetentionSummary["attendance"] = null;
  if (!marksRes.error && (marksRes.data ?? []).length > 0) {
    const marks = marksRes.data ?? [];
    const present = marks.filter(m => m.status === "present" || m.status === "late").length;
    attendance = {
      pct: Math.round((present / marks.length) * 100),
      absences: marks.filter(m => m.status === "absent").length,
      lates: marks.filter(m => m.status === "late").length,
      marks: marks.length,
    };
  }

  let fees: RetentionSummary["fees"] = null;
  if (!invoicesRes.error) {
    const inv = invoicesRes.data ?? [];
    const open = inv.filter(i => i.status === "unpaid" || i.status === "overdue" || i.status === "partial");
    fees = {
      invoices: inv.length,
      unpaid: open.length,
      overdue: inv.filter(i => i.status === "overdue").length,
      owedAed: open.reduce((sum, i) => sum + Number(i.amount_owed_aed ?? 0), 0),
    };
  }

  return {
    student: {
      id: s.id,
      name: s.full_name_en,
      section_code: s.sections?.code ?? null,
      grade_level: s.sections?.grade_level ?? null,
      re_enrolled_on: s.re_enrolled_on,
      final_enrollment_date: s.final_enrollment_date,
      leaver_reason: s.leaver_reason,
    },
    parent: primary?.parents ?? null,
    attendance,
    riskFlags: (s.risk_flags ?? [])
      .filter(f => f.status === "open")
      .map(({ severity, category, reason }) => ({ severity, category, reason })),
    fees,
  };
}
