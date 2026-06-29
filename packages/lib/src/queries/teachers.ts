import { serverClient } from "../supabase";

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

export async function getTeachersWithLoad(academicYearId: string): Promise<TeacherWithLoad[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("teacher_contracts")
    .select(`
      weekly_period_cap, weekly_period_assigned,
      teachers ( id, full_name, display_name, primary_dept, primary_subject_text, employment_status )
    `)
    .eq("academic_year_id", academicYearId);
  if (error) throw new Error(error.message);

  return (data ?? []).map(c => {
    const t = c.teachers as {
      id: string; full_name: string; display_name: string | null;
      primary_dept: string | null; primary_subject_text: string | null; employment_status: string | null;
    } | null;
    return {
      id: t?.id ?? "",
      full_name: t?.full_name ?? "",
      display_name: t?.display_name ?? null,
      primary_dept: t?.primary_dept ?? null,
      primary_subject_text: t?.primary_subject_text ?? null,
      employment_status: t?.employment_status ?? null,
      weekly_period_cap: c.weekly_period_cap,
      weekly_period_assigned: c.weekly_period_assigned,
    };
  });
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
