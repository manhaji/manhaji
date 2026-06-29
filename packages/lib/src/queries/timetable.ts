import { serverClient } from "../supabase";

export type PeriodSlot = {
  id: string | null;
  period: string;
  day: string;
  start: string;
  end: string;
  subject: string | null;
  subject_code: string | null;
  teacher: string | null;
  room: string | null;
  is_teaching: boolean;
};

export async function getStudentTimetable(studentId: string, academicYearId: string): Promise<PeriodSlot[]> {
  const db = await serverClient();

  // Get student's section
  const { data: student } = await db
    .from("students")
    .select("current_section_id")
    .eq("id", studentId)
    .single();
  if (!student?.current_section_id) return [];

  return getTimetableForSection(student.current_section_id, academicYearId);
}

export async function getTimetableForSection(sectionId: string, academicYearId: string): Promise<PeriodSlot[]> {
  const db = await serverClient();

  // Get all bell periods for this academic year (includes breaks/lunch)
  const { data: bells, error: bellErr } = await db
    .from("bell_periods")
    .select("id, period_label, day_of_week, starts_at, ends_at, is_teaching")
    .eq("academic_year_id", academicYearId)
    .order("day_of_week")
    .order("period_number");
  if (bellErr) throw new Error(bellErr.message);

  // Get timetable slots for this section
  const { data: slots, error: slotErr } = await db
    .from("timetable_slots")
    .select(`
      id, bell_period_id,
      subjects ( name_en, code ),
      teachers ( display_name, full_name ),
      rooms ( code )
    `)
    .eq("section_id", sectionId)
    .eq("academic_year_id", academicYearId);
  if (slotErr) throw new Error(slotErr.message);

  // Index slots by bell_period_id for fast lookup
  const slotByBell = new Map<string, typeof slots[number]>();
  for (const s of slots ?? []) slotByBell.set(s.bell_period_id, s);

  return (bells ?? []).map(b => {
    const slot = slotByBell.get(b.id);
    const sub = slot?.subjects as { name_en: string; code: string } | null;
    const tch = slot?.teachers as { display_name: string | null; full_name: string } | null;
    const rm  = slot?.rooms as { code: string } | null;
    return {
      id: slot?.id ?? null,
      period: b.period_label ?? `P${b.id}`,
      day: b.day_of_week,
      start: (b.starts_at as string).slice(0, 5),
      end: (b.ends_at as string).slice(0, 5),
      subject: sub?.name_en ?? null,
      subject_code: sub?.code ?? null,
      teacher: tch ? (tch.display_name ?? tch.full_name) : null,
      room: rm?.code ?? null,
      is_teaching: b.is_teaching ?? true,
    };
  });
}

export async function getTeacherTimetable(teacherId: string, academicYearId: string): Promise<PeriodSlot[]> {
  const db = await serverClient();

  const { data: slots, error } = await db
    .from("timetable_slots")
    .select(`
      id, bell_period_id, section_id,
      bell_periods ( period_label, day_of_week, starts_at, ends_at, is_teaching ),
      subjects ( name_en, code ),
      sections ( code, grade_level ),
      rooms ( code )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year_id", academicYearId);
  if (error) throw new Error(error.message);

  return (slots ?? []).map(s => {
    const b   = s.bell_periods as { period_label: string; day_of_week: string; starts_at: string; ends_at: string; is_teaching: boolean } | null;
    const sub = s.subjects as { name_en: string; code: string } | null;
    const sec = s.sections as { code: string; grade_level: string } | null;
    const rm  = s.rooms as { code: string } | null;
    return {
      id: s.id,
      period: b?.period_label ?? "",
      day: b?.day_of_week ?? "",
      start: (b?.starts_at ?? "").slice(0, 5),
      end: (b?.ends_at ?? "").slice(0, 5),
      subject: sub?.name_en ?? null,
      subject_code: sub?.code ?? null,
      teacher: sec ? `${sec.grade_level} ${sec.code}` : null,
      room: rm?.code ?? null,
      is_teaching: b?.is_teaching ?? true,
    };
  });
}

export async function getSchoolTimetable(academicYearId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("timetable_slots")
    .select(`
      id, section_id, is_locked, source,
      bell_periods ( period_label, day_of_week, starts_at, ends_at ),
      subjects ( name_en, code ),
      teachers ( id, full_name ),
      sections ( code, grade_level ),
      rooms ( code )
    `)
    .eq("academic_year_id", academicYearId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
