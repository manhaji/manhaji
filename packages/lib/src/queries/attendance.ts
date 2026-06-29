import { serverClient } from "../supabase";

export type DailyAttendanceStat = {
  date: string;
  pct: number;
  total: number;
  present: number;
};

export type SectionAttendanceStat = {
  section_id: string;
  section_code: string;
  week_pct: number;
  total_marks: number;
  absent_count: number;
};

export async function getDailyAttendanceTrend(academicYearId: string, from: string, to: string): Promise<DailyAttendanceStat[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("marked_on, status")
    .gte("marked_on", from)
    .lte("marked_on", to)
    .order("marked_on");
  if (error) throw new Error(error.message);

  // Aggregate by date
  const byDate = new Map<string, { total: number; present: number }>();
  for (const row of data ?? []) {
    const d = byDate.get(row.marked_on) ?? { total: 0, present: 0 };
    d.total++;
    if (row.status === "present" || row.status === "late") d.present++;
    byDate.set(row.marked_on, d);
  }
  return Array.from(byDate.entries()).map(([date, { total, present }]) => ({
    date,
    pct: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0,
    total,
    present,
  }));
}

export async function getSectionAttendanceStats(from: string, to: string): Promise<SectionAttendanceStat[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select(`
      section_id, status,
      sections ( code )
    `)
    .gte("marked_on", from)
    .lte("marked_on", to);
  if (error) throw new Error(error.message);

  const bySection = new Map<string, { code: string; total: number; absent: number }>();
  for (const row of data ?? []) {
    if (!row.section_id) continue;
    const sec = row.sections as { code: string } | null;
    const d = bySection.get(row.section_id) ?? { code: sec?.code ?? row.section_id, total: 0, absent: 0 };
    d.total++;
    if (row.status === "absent") d.absent++;
    bySection.set(row.section_id, d);
  }
  return Array.from(bySection.entries()).map(([section_id, { code, total, absent }]) => ({
    section_id,
    section_code: code,
    week_pct: total > 0 ? Math.round(((total - absent) / total) * 100 * 10) / 10 : 0,
    total_marks: total,
    absent_count: absent,
  }));
}

export type ChronicAbsenteeRow = {
  student_id: string;
  name: string;
  absences: number;
  section_code: string;
};

export async function getChronicAbsentees(academicYearId: string, threshold = 10): Promise<ChronicAbsenteeRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select(`
      student_id, section_id, status,
      students ( id, full_name_en ),
      sections ( code )
    `)
    .eq("status", "absent");
  if (error) throw new Error(error.message);

  const byStudent = new Map<string, { name: string; absences: number; section_code: string }>();
  for (const row of data ?? []) {
    const stu = row.students as { id: string; full_name_en: string } | null;
    const sec = row.sections as { code: string } | null;
    if (!stu) continue;
    const d = byStudent.get(row.student_id) ?? { name: stu.full_name_en, absences: 0, section_code: sec?.code ?? "—" };
    d.absences++;
    byStudent.set(row.student_id, d);
  }
  return Array.from(byStudent.entries())
    .filter(([, d]) => d.absences >= threshold)
    .map(([student_id, { name, absences, section_code }]) => ({ student_id, name, absences, section_code }))
    .sort((a, b) => b.absences - a.absences);
}

export async function getAttendanceForSection(
  sectionId: string,
  date: string,
  bellPeriodId: string,
) {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("student_id, status, notes")
    .eq("section_id", sectionId)
    .eq("marked_on", date)
    .eq("bell_period_id", bellPeriodId);
  if (error) throw new Error(error.message);
  return data;
}

export async function getAttendanceSummaryForStudent(
  studentId: string,
  from: string,
  to: string,
) {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("date, period, status")
    .eq("student_id", studentId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw new Error(error.message);
  return data;
}

export async function getAbsencesRequiringCoverage(sectionId: string, date: string) {
  const db = await serverClient();
  // Used by substitute-sheet builder to find uncovered absent slots
  const { data, error } = await db
    .from("timetable_slots")
    .select(`
      id, bell_period_id, subject_id, teacher_id,
      substitutions ( substitute_teacher_id )
    `)
    .eq("section_id", sectionId)
    .is("substitutions.substitute_teacher_id", null);
  if (error) throw new Error(error.message);
  return data;
}
