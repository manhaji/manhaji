import { serverClient } from "../supabase";
import { getTeacherDailyLoads } from "./timetable";

export type TeacherWithLoad = {
  id: string;
  full_name: string;
  display_name: string | null;
  primary_dept: string | null;
  primary_subject_text: string | null;
  employment_status: string | null;
  weekly_period_cap: number | null;
  weekly_period_assigned: number | null;
};

/**
 * Derive a department label from the free-text `primary_subject_text` column.
 *
 * `teachers.primary_dept` is NULL for every row in the demo dataset, so the
 * Faculty page derives the department in code from the raw subject string that
 * was imported from the staffing workbook (e.g. "ENGLISH", "COORDINATOR(7-12)
 * CHEM", "Business/ECO"). Rules are ordered by priority and matched on
 * word boundaries against the upper-cased text. Unrecognised non-empty values
 * fall back to "Other"; blank/null values fall back to "Unassigned".
 *
 * The subject->department groupings mirror the ETL `SUBJECT_CATALOG`
 * (etl/parse_workbook.py) rolled up into human-readable department names.
 */
const DEPARTMENT_RULES: { dept: string; test: RegExp }[] = [
  { dept: "Mathematics",         test: /\b(MATH|MATHS|MS)\b/ },
  { dept: "Sciences",            test: /\b(SCIENCE|SC|CHEM|CHEMISTRY|BIO|BIOLOGY|PHY|PHYSICS)\b/ },
  { dept: "English",             test: /\bENGLISH\b/ },
  { dept: "Arabic",              test: /\bARABIC\b/ },
  { dept: "French",              test: /\bFRENCH\b/ },
  { dept: "Islamic Studies",     test: /\bISLAMIC\b/ },
  { dept: "Humanities",          test: /\b(SSA|SSE|SOCIAL|BUSINESS|ECO|ECONOMICS|HISTORY|GEOGRAPH\w*|CIVIC\w*)\b/ },
  { dept: "Physical Education",  test: /\bPE\b/ },
  { dept: "Arts",                test: /\b(ART|MUSIC)\b/ },
  { dept: "ICT",                 test: /\b(IT|ICT)\b/ },
];

export function deriveDepartment(primarySubjectText: string | null | undefined): string {
  const raw = (primarySubjectText ?? "").trim();
  if (!raw) return "Unassigned";
  const upper = raw.toUpperCase();
  for (const { dept, test } of DEPARTMENT_RULES) {
    if (test.test(upper)) return dept;
  }
  return "Other";
}

export async function getTeachersWithLoad(academicYearId: string): Promise<TeacherWithLoad[]> {
  const db = await serverClient();

  // Read the roster from `teachers` (all 105) rather than `teacher_contracts`
  // (which only covers ~69 and caps the roster). Contracts are left-joined in
  // code for the weekly cap; per-teacher load comes from the timetable.
  const [teachersRes, contractsRes, loads] = await Promise.all([
    db
      .from("teachers")
      .select("id, full_name, display_name, primary_dept, primary_subject_text, employment_status")
      .order("full_name"),
    db
      .from("teacher_contracts")
      .select("teacher_id, weekly_period_cap")
      .eq("academic_year_id", academicYearId),
    getTeacherDailyLoads(academicYearId).catch(() => []),
  ]);
  if (teachersRes.error) throw new Error(teachersRes.error.message);
  if (contractsRes.error) throw new Error(contractsRes.error.message);

  const capByTeacher = new Map<string, number>();
  for (const c of contractsRes.data ?? []) {
    if (c.teacher_id != null) capByTeacher.set(c.teacher_id, c.weekly_period_cap);
  }
  const loadByTeacher = new Map<string, number>();
  for (const l of loads) loadByTeacher.set(l.teacher_id, l.total);

  return (teachersRes.data ?? []).map(t => ({
    id: t.id,
    full_name: t.full_name,
    display_name: t.display_name,
    // primary_dept is NULL across the dataset; derive from the raw subject text.
    primary_dept: t.primary_dept ?? deriveDepartment(t.primary_subject_text),
    primary_subject_text: t.primary_subject_text,
    employment_status: t.employment_status,
    weekly_period_cap: capByTeacher.get(t.id) ?? null,
    weekly_period_assigned: loadByTeacher.get(t.id) ?? 0,
  }));
}

export async function getTeacherName(teacherId: string): Promise<string> {
  const db = await serverClient();
  const { data } = await db
    .from("teachers")
    .select("full_name, display_name")
    .eq("id", teacherId)
    .single();
  return data?.display_name ?? data?.full_name ?? "";
}

export type DeptColleague = {
  id: string;
  name: string;
  dept: string;
};

/**
 * Same-department colleagues for a teacher — the substitutable set shown as
 * tabs on My Week. Uses `primary_dept` where set (backfilled real depts,
 * migration 018) and falls back to deriving from `primary_subject_text`.
 * The teacher themself is returned first.
 */
export async function getDeptColleagues(teacherId: string): Promise<DeptColleague[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("teachers")
    .select("id, full_name, display_name, primary_dept, primary_subject_text, employment_status")
    .order("full_name");
  if (error) throw new Error(error.message);

  const all = (data ?? []).map(t => ({
    id: t.id,
    name: t.display_name ?? t.full_name,
    dept: t.primary_dept ?? deriveDepartment(t.primary_subject_text),
    active: t.employment_status !== "inactive" && t.employment_status !== "left",
  }));

  const self = all.find(t => t.id === teacherId);
  if (!self) return [];

  const colleagues = all.filter(
    t => t.id !== teacherId && t.active && t.dept === self.dept && t.dept !== "Unassigned",
  );
  return [
    { id: self.id, name: self.name, dept: self.dept },
    ...colleagues.map(({ id, name, dept }) => ({ id, name, dept })),
  ];
}

export async function getAllTeachers() {
  const db = await serverClient();
  const { data, error } = await db
    .from("teachers")
    .select("id, full_name, display_name, primary_dept, primary_subject_text, employment_status, email, hire_date")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPendingAbsences() {
  const db = await serverClient();
  const { data, error } = await db
    .from("staff_absences")
    .select(`
      id, reason, reason_notes, starts_on, ends_on, status, created_at,
      teachers ( id, full_name, primary_dept )
    `)
    .eq("status", "pending")
    .order("starts_on");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApprovedAbsencesNeedingCoverage(date: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("staff_absences")
    .select(`
      id, starts_on, ends_on,
      teachers ( id, full_name ),
      substitutions ( id, substitute_teacher_id )
    `)
    .eq("status", "approved")
    .lte("starts_on", date)
    .gte("ends_on", date)
    .is("substitutions.substitute_teacher_id", null);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTeacherWithSections(teacherId: string, academicYearId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("teacher_section_subject")
    .select(`
      weekly_periods,
      sections ( id, code, grade_level, label ),
      subjects ( id, name_en, code )
    `)
    .eq("teacher_id", teacherId);
  if (error) throw new Error(error.message);
  // Filter to sections in the given academic year
  return (data ?? []).filter(row => {
    const sec = row.sections as { id: string } | null;
    return sec?.id != null;
  });
}
