import { serverClient } from "../supabase";

export type AdminStudentRow = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  external_ref: string | null;
  current_section_id: string | null;
  section_code: string | null;
  grade_level: string | null;
  advisor_id: string | null;
  withdrawn_on: string | null;
  risk_flags: Array<{ id: string; severity: string; category: string; status: string }>;
};

export async function getStudentsForAdmin(academicYearId: string): Promise<AdminStudentRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select(`
      id, full_name_en, full_name_ar, gender, date_of_birth, external_ref,
      current_section_id, advisor_id, withdrawn_on,
      sections:current_section_id ( code, grade_level ),
      risk_flags ( id, severity, category, status, academic_year_id )
    `)
    .is("withdrawn_on", null)
    .order("full_name_en");
  if (error) throw new Error(error.message);

  return (data ?? []).map(s => {
    const sec   = s.sections as { code: string; grade_level: string } | null;
    const flags = (s.risk_flags as Array<{ id: string; severity: string; category: string; status: string; academic_year_id: string }> | null) ?? [];
    return {
      id: s.id,
      full_name_en: s.full_name_en,
      full_name_ar: s.full_name_ar,
      gender: s.gender,
      date_of_birth: s.date_of_birth,
      external_ref: s.external_ref,
      current_section_id: s.current_section_id,
      section_code: sec?.code ?? null,
      grade_level: sec?.grade_level ?? null,
      advisor_id: s.advisor_id,
      withdrawn_on: s.withdrawn_on,
      risk_flags: flags
        .filter(f => f.academic_year_id === academicYearId)
        .map(({ id, severity, category, status }) => ({ id, severity, category, status })),
    };
  });
}

export type TeacherSectionStudentRow = {
  id: string;
  full_name_en: string;
  section_code: string;
  grade_level: string | null;
  risk_flags: Array<{ severity: string; category: string }>;
};

export async function getStudentsForSections(sectionIds: string[]): Promise<TeacherSectionStudentRow[]> {
  if (sectionIds.length === 0) return [];
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select(`
      id, full_name_en,
      sections:current_section_id ( code, grade_level ),
      risk_flags ( severity, category )
    `)
    .in("current_section_id", sectionIds)
    .is("withdrawn_on", null)
    .order("full_name_en");
  if (error) throw new Error(error.message);

  return (data ?? []).map(s => {
    const sec   = s.sections as { code: string; grade_level: string } | null;
    const flags = (s.risk_flags as Array<{ severity: string; category: string }> | null) ?? [];
    return {
      id: s.id,
      full_name_en: s.full_name_en,
      section_code: sec?.code ?? "—",
      grade_level: sec?.grade_level ?? null,
      risk_flags: flags,
    };
  });
}

export async function getApplicantsForYear(academicYearId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("applicants")
    .select("id, full_name, email, phone_e164, target_grade, stage, source, notes, created_at")
    .eq("academic_year_id", academicYearId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBehaviourNotes(studentIds?: string[], limit = 200) {
  const db = await serverClient();
  let q = db
    .from("behaviour_notes")
    .select(`
      id, student_id, observed_on, kind, note,
      students ( full_name_en, sections:current_section_id ( code ) ),
      teachers ( full_name )
    `)
    .order("observed_on", { ascending: false })
    .limit(limit);
  if (studentIds?.length) q = q.in("student_id", studentIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentsBySection(sectionId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select("id, full_name_en, full_name_ar, gender, date_of_birth, external_ref")
    .eq("current_section_id", sectionId)
    .is("withdrawn_on", null)
    .order("full_name_en");
  if (error) throw new Error(error.message);
  return data;
}

export async function getStudentWithEnrollment(studentId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select(`
      *,
      student_enrollments (
        section_id,
        sections ( name, grade )
      )
    `)
    .eq("id", studentId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type StudentProfile = {
  full_name_en: string;
  current_section_id: string | null;
  section_code: string | null;
  grade_level: string | null;
};

export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const db = await serverClient();
  const { data } = await db
    .from("students")
    .select("full_name_en, current_section_id, sections:current_section_id ( code, grade_level )")
    .eq("id", studentId)
    .single();
  if (!data) return null;
  const sec = data.sections as { code: string; grade_level: string } | null;
  return {
    full_name_en: data.full_name_en,
    current_section_id: data.current_section_id,
    section_code: sec?.code ?? null,
    grade_level: sec?.grade_level ?? null,
  };
}

export async function getStudentsWithRiskFlags(academicYearId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("students")
    .select(`
      id, full_name_en,
      sections:current_section_id ( code, grade_level ),
      risk_flags!inner (
        id, severity, category, reason, status, created_at, owner_id
      )
    `)
    .eq("risk_flags.academic_year_id", academicYearId)
    .eq("risk_flags.status", "open");
  if (error) throw new Error(error.message);
  return (data ?? []).map(s => {
    const sec   = s.sections as { code: string; grade_level: string } | null;
    const flags = s.risk_flags as Array<{
      id: string; severity: string; category: string; reason: string;
      status: string; created_at: string; owner_id: string | null;
    }>;
    return {
      id: s.id,
      full_name_en: s.full_name_en,
      section_code: sec?.code ?? null,
      grade_level:  sec?.grade_level ?? null,
      risk_flags: flags,
    };
  });
}
