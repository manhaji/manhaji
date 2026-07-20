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

export type TeacherDayLoad = {
  teacher_id: string;
  full_name: string;
  by_day: Record<string, number>;
  total: number;
};

/**
 * The current academic year may not yet have a published timetable (in the demo
 * dataset the timetable lives in the prior year). Resolve the academic year that
 * actually holds the most teacher-assigned slots so per-teacher load reflects the
 * real timetable rather than an empty current year.
 */
/**
 * Public wrapper around resolveTimetableYearId: given the current academic
 * year, return the year that actually holds the published teacher timetable
 * (falls back to the given year when no slots exist anywhere). Teacher-facing
 * pages use this so My Week / one-tap attendance / class hub read the real
 * timetable even while the current year's timetable is unpublished.
 */
export async function getEffectiveTimetableYearId(preferredYearId: string): Promise<string> {
  const db = await serverClient();
  return resolveTimetableYearId(db, preferredYearId);
}

async function resolveTimetableYearId(
  db: Awaited<ReturnType<typeof serverClient>>,
  preferredYearId: string,
): Promise<string> {
  const { data } = await db
    .from("timetable_slots")
    .select("academic_year_id")
    .not("teacher_id", "is", null);
  if (!data || data.length === 0) return preferredYearId;
  const counts = new Map<string, number>();
  for (const row of data) {
    const ay = row.academic_year_id;
    if (ay) counts.set(ay, (counts.get(ay) ?? 0) + 1);
  }
  let best = preferredYearId;
  let bestN = counts.get(preferredYearId) ?? 0;
  for (const [ay, n] of counts) {
    if (n > bestN) { best = ay; bestN = n; }
  }
  return best;
}

export async function getTeacherDailyLoads(academicYearId: string): Promise<TeacherDayLoad[]> {
  const db = await serverClient();
  const yearId = await resolveTimetableYearId(db, academicYearId);
  const { data, error } = await db
    .from("timetable_slots")
    .select(`
      teacher_id,
      teachers ( full_name ),
      bell_periods ( day_of_week, is_teaching )
    `)
    .eq("academic_year_id", yearId)
    .not("teacher_id", "is", null);
  if (error) throw new Error(error.message);

  const byTeacher = new Map<string, { full_name: string; by_day: Record<string, number> }>();
  for (const row of data ?? []) {
    if (!row.teacher_id) continue;
    const t = row.teachers as { full_name: string } | null;
    const b = row.bell_periods as { day_of_week: string; is_teaching: boolean | null } | null;
    if (!t || !b?.day_of_week || b.is_teaching === false) continue;
    const entry = byTeacher.get(row.teacher_id) ?? { full_name: t.full_name, by_day: {} };
    entry.by_day[b.day_of_week] = (entry.by_day[b.day_of_week] ?? 0) + 1;
    byTeacher.set(row.teacher_id, entry);
  }

  return Array.from(byTeacher.entries())
    .map(([teacher_id, { full_name, by_day }]) => ({
      teacher_id,
      full_name,
      by_day,
      total: Object.values(by_day).reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => b.total - a.total);
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

export type RoomUtilRow = { code: string; pct: number };

export async function getRoomUtilization(academicYearId: string): Promise<RoomUtilRow[]> {
  const db = await serverClient();
  const [{ data: slots, error: sErr }, { data: bells, error: bErr }] = await Promise.all([
    db.from("timetable_slots")
      .select("room_id, rooms ( code )")
      .eq("academic_year_id", academicYearId)
      .not("room_id", "is", null),
    db.from("bell_periods")
      .select("id")
      .eq("academic_year_id", academicYearId)
      .eq("is_teaching", true),
  ]);
  if (sErr) throw new Error(sErr.message);
  if (bErr) throw new Error(bErr.message);

  const totalPeriods = bells?.length ?? 1;
  const byRoom = new Map<string, { code: string; count: number }>();
  for (const s of slots ?? []) {
    if (!s.room_id) continue;
    const rm = s.rooms as { code: string } | null;
    if (!rm?.code) continue;
    const r = byRoom.get(s.room_id) ?? { code: rm.code, count: 0 };
    r.count++;
    byRoom.set(s.room_id, r);
  }
  return Array.from(byRoom.values())
    .map(r => ({ code: r.code, pct: Math.min(100, Math.round((r.count / totalPeriods) * 100)) }))
    .sort((a, b) => b.pct - a.pct);
}
