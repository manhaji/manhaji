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

export type DowAttendanceRow = {
  week_label: string;
  mon: number; tue: number; wed: number; thu: number; fri: number;
};

export type PeriodAttendanceRow = { period: number; pct: number };

export type SubjectAbsenceRow = { subject: string; hours_missed: number };

export type BenchmarkAttendanceRow = { label: string; pct: number; tone: "us" | "neutral" | "target" };

export async function getAttendancePatterns(from: string, to: string): Promise<{
  dow: DowAttendanceRow[];
  byPeriod: PeriodAttendanceRow[];
}> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("marked_on, status, bell_periods ( period_number, is_teaching )")
    .gte("marked_on", from)
    .lte("marked_on", to);
  if (error) throw new Error(error.message);

  const dowCells = new Map<string, { total: number; present: number }>();
  const weekOrder: string[] = [];
  const periodCells = new Map<number, { total: number; present: number }>();
  const DOW_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

  for (const row of data ?? []) {
    const d = new Date(row.marked_on + "T00:00:00Z");
    const utcDay = d.getUTCDay();
    if (utcDay === 0 || utcDay === 6) continue;
    const monday = new Date(d.getTime() - (utcDay - 1) * 86400000);
    const wl = `W/c ${monday.getUTCDate()} ${monday.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
    const dowKey = DOW_KEYS[utcDay];
    const cellKey = `${wl}|${dowKey}`;
    const dc = dowCells.get(cellKey) ?? { total: 0, present: 0 };
    dc.total++;
    if (row.status === "present" || row.status === "late") dc.present++;
    dowCells.set(cellKey, dc);
    if (!weekOrder.includes(wl)) weekOrder.push(wl);

    const bp = row.bell_periods as { period_number: number | null; is_teaching: boolean | null } | null;
    if (bp?.period_number && bp.is_teaching !== false) {
      const pc = periodCells.get(bp.period_number) ?? { total: 0, present: 0 };
      pc.total++;
      if (row.status === "present" || row.status === "late") pc.present++;
      periodCells.set(bp.period_number, pc);
    }
  }

  const toPct = (c: { total: number; present: number } | undefined) =>
    c && c.total > 0 ? Math.round((c.present / c.total) * 1000) / 10 : 0;

  const dow = weekOrder.map(wl => ({
    week_label: wl,
    mon: toPct(dowCells.get(`${wl}|mon`)),
    tue: toPct(dowCells.get(`${wl}|tue`)),
    wed: toPct(dowCells.get(`${wl}|wed`)),
    thu: toPct(dowCells.get(`${wl}|thu`)),
    fri: toPct(dowCells.get(`${wl}|fri`)),
  }));

  const byPeriod = Array.from(periodCells.entries())
    .map(([period, c]) => ({ period, pct: toPct(c) }))
    .sort((a, b) => a.period - b.period);

  return { dow, byPeriod };
}

export async function getSubjectAbsences(from: string, to: string): Promise<SubjectAbsenceRow[]> {
  const db = await serverClient();
  const [{ data: marks, error: markErr }, { data: slots, error: slotErr }] = await Promise.all([
    db.from("attendance_marks")
      .select("section_id, bell_period_id")
      .eq("status", "absent")
      .gte("marked_on", from)
      .lte("marked_on", to),
    db.from("timetable_slots")
      .select("section_id, bell_period_id, subjects ( name_en )")
      .not("subject_id", "is", null),
  ]);
  if (markErr) throw new Error(markErr.message);
  if (slotErr) throw new Error(slotErr.message);

  const lookup = new Map<string, string>();
  for (const s of slots ?? []) {
    const sub = s.subjects as { name_en: string } | null;
    if (sub?.name_en && s.section_id && s.bell_period_id) {
      lookup.set(`${s.section_id}|${s.bell_period_id}`, sub.name_en);
    }
  }

  const bySubject = new Map<string, number>();
  for (const m of marks ?? []) {
    if (!m.section_id || !m.bell_period_id) continue;
    const subj = lookup.get(`${m.section_id}|${m.bell_period_id}`);
    if (!subj) continue;
    bySubject.set(subj, (bySubject.get(subj) ?? 0) + 1);
  }

  return Array.from(bySubject.entries())
    .map(([subject, count]) => ({ subject, hours_missed: count }))
    .sort((a, b) => b.hours_missed - a.hours_missed)
    .slice(0, 10);
}

export async function getAttendanceBenchmarks(from: string, to: string): Promise<BenchmarkAttendanceRow[]> {
  const durationMs = new Date(to).getTime() - new Date(from).getTime();
  const prevTo   = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(from).getTime() - durationMs - 86400000).toISOString().slice(0, 10);

  const db = await serverClient();
  const [{ data: curr }, { data: prev }] = await Promise.all([
    db.from("attendance_marks").select("status").gte("marked_on", from).lte("marked_on", to),
    db.from("attendance_marks").select("status").gte("marked_on", prevFrom).lte("marked_on", prevTo),
  ]);

  const avgPct = (rows: { status: string }[] | null) => {
    if (!rows?.length) return 0;
    const present = rows.filter(r => r.status === "present" || r.status === "late").length;
    return Math.round((present / rows.length) * 1000) / 10;
  };

  const currentPct = avgPct(curr);
  const prevPct    = avgPct(prev);
  const result: BenchmarkAttendanceRow[] = [{ label: "This period", pct: currentPct, tone: "us" }];
  if (prevPct > 0) result.push({ label: "Previous period", pct: prevPct, tone: "neutral" });
  result.push({ label: "Target (95%)", pct: 95.0, tone: "target" });
  return result;
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

export type TeacherAttendanceResult = {
  avgPct: number;
  trend: Array<{ date: string; pct: number }>;
};

export async function getTeacherSectionAttendance(
  sectionIds: string[],
  from: string,
  to: string,
): Promise<TeacherAttendanceResult> {
  if (sectionIds.length === 0) return { avgPct: 0, trend: [] };
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("marked_on, status")
    .in("section_id", sectionIds)
    .gte("marked_on", from)
    .lte("marked_on", to)
    .order("marked_on");
  if (error) throw new Error(error.message);

  const byDate = new Map<string, { total: number; present: number }>();
  let grandTotal = 0;
  let grandPresent = 0;
  for (const row of data ?? []) {
    const d = byDate.get(row.marked_on) ?? { total: 0, present: 0 };
    d.total++;
    grandTotal++;
    if (row.status === "present" || row.status === "late") { d.present++; grandPresent++; }
    byDate.set(row.marked_on, d);
  }

  const trend = Array.from(byDate.entries()).map(([date, { total, present }]) => ({
    date: date.slice(5),   // "MM-DD"
    pct: total > 0 ? Math.round((present / total) * 100) : 0,
  }));

  return {
    avgPct: grandTotal > 0 ? Math.round((grandPresent / grandTotal) * 100) : 0,
    trend,
  };
}

// ── One-Tap Attendance ──────────────────────────────────────────────────────

export type RollCallMark = {
  student_id: string;
  status: string;
  reason: string | null;
  notes: string | null;
};

export async function getAttendanceForPeriod(
  sectionId: string,
  date: string,
  bellPeriodId: string,
): Promise<RollCallMark[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("student_id, status, reason, notes")
    .eq("section_id", sectionId)
    .eq("marked_on", date)
    .eq("bell_period_id", bellPeriodId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    student_id: r.student_id,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
  }));
}

export async function getYesterdayAttendanceForSection(
  sectionId: string,
  date: string,               // yesterday's date (YYYY-MM-DD)
): Promise<RollCallMark[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("attendance_marks")
    .select("student_id, status, reason, notes")
    .eq("section_id", sectionId)
    .eq("marked_on", date);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    student_id: r.student_id,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
  }));
}

export type CurrentSlotInfo = {
  slotId: string;
  sectionId: string;
  sectionCode: string;
  gradeLevel: string | null;
  subjectName: string | null;
  roomCode: string | null;
  bellPeriodId: string;
  periodLabel: string;
  periodNumber: number;
  startsAt: string;
  endsAt: string;
  isNow: boolean;
};

export async function getCurrentSlotForTeacher(
  teacherId: string,
  academicYearId: string,
): Promise<CurrentSlotInfo | null> {
  const db = await serverClient();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = days[new Date().getDay()];
  const nowHHMM = new Date().toTimeString().slice(0, 5);

  const { data, error } = await db
    .from("timetable_slots")
    .select(`
      id, section_id,
      bell_periods ( id, period_label, period_number, starts_at, ends_at, day_of_week, is_teaching ),
      subjects ( name_en ),
      sections ( code, grade_level ),
      rooms ( code )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year_id", academicYearId);
  if (error) throw new Error(error.message);

  const todaySlots = (data ?? []).filter(s => {
    const b = s.bell_periods as { day_of_week: string; is_teaching: boolean | null } | null;
    return b?.day_of_week === todayDay && b?.is_teaching !== false;
  });

  const toSlotInfo = (s: typeof todaySlots[number], isNow: boolean): CurrentSlotInfo => {
    const b   = s.bell_periods as { id: string; period_label: string | null; period_number: number; starts_at: string; ends_at: string } | null;
    const sub = s.subjects as { name_en: string } | null;
    const sec = s.sections as { code: string; grade_level: string | null } | null;
    const rm  = s.rooms as { code: string } | null;
    return {
      slotId: s.id,
      sectionId: s.section_id,
      sectionCode: sec?.code ?? "",
      gradeLevel: sec?.grade_level ?? null,
      subjectName: sub?.name_en ?? null,
      roomCode: rm?.code ?? null,
      bellPeriodId: b?.id ?? "",
      periodLabel: b?.period_label ?? "",
      periodNumber: b?.period_number ?? 0,
      startsAt: (b?.starts_at ?? "").slice(0, 5),
      endsAt: (b?.ends_at ?? "").slice(0, 5),
      isNow,
    };
  };

  const current = todaySlots.find(s => {
    const b = s.bell_periods as { starts_at: string; ends_at: string } | null;
    if (!b) return false;
    const start = (b.starts_at as string).slice(0, 5);
    const end   = (b.ends_at as string).slice(0, 5);
    return nowHHMM >= start && nowHHMM < end;
  });
  if (current) return toSlotInfo(current, true);

  const fallback = todaySlots.sort((a, b) => {
    const ba = a.bell_periods as { period_number: number } | null;
    const bb = b.bell_periods as { period_number: number } | null;
    return (ba?.period_number ?? 0) - (bb?.period_number ?? 0);
  })[0];
  return fallback ? toSlotInfo(fallback, false) : null;
}
