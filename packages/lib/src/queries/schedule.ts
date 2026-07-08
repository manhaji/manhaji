import { serverClient } from "../supabase";

export type AbsenceRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  reason: string;
  status: string;
  notes: string | null;
  sub_count: number;
  subs: { sub_id: string; sub_teacher_name: string }[];
};

export async function getTodayAbsences(): Promise<AbsenceRow[]> {
  const db = await serverClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from("staff_absences")
    .select("id, teacher_id, reason, status, reason_notes")
    .eq("starts_on", today)
    .order("created_at");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const teacherIds = [...new Set(data.map(a => a.teacher_id))];
  const absenceIds = data.map(a => a.id);

  const [{ data: teachers }, { data: subs }] = await Promise.all([
    db.from("teachers").select("id, full_name, display_name").in("id", teacherIds),
    db.from("substitutions")
      .select("id, absence_id, substitute_teacher_id, teachers:substitute_teacher_id ( full_name, display_name )")
      .in("absence_id", absenceIds),
  ]);

  const teacherMap = new Map((teachers ?? []).map(t => [t.id, t]));

  return data.map(a => {
    const t = teacherMap.get(a.teacher_id);
    const absenceSubs = (subs ?? []).filter(s => s.absence_id === a.id);
    return {
      id: a.id,
      teacher_id: a.teacher_id,
      teacher_name: t ? (t.display_name ?? t.full_name) : "Unknown",
      reason: a.reason,
      status: a.status,
      notes: a.reason_notes,
      sub_count: absenceSubs.length,
      subs: absenceSubs.map(s => {
        const st = s.teachers as { full_name: string; display_name: string | null } | null;
        return {
          sub_id: s.id,
          sub_teacher_name: st ? (st.display_name ?? st.full_name) : "Unknown",
        };
      }),
    };
  });
}

export type AbsentTeacherPeriod = {
  slot_id: string;
  period_label: string;
  start: string;
  end: string;
  subject: string | null;
  section_code: string | null;
  room_code: string | null;
  is_teaching: boolean;
  sub_teacher_name: string | null;
};

export async function getAbsentTeacherPeriods(
  teacherId: string,
  absenceId: string,
  academicYearId: string
): Promise<AbsentTeacherPeriod[]> {
  const db = await serverClient();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = days[new Date().getDay()];

  const { data: slots, error } = await db
    .from("timetable_slots")
    .select(`
      id,
      bell_periods ( period_label, starts_at, ends_at, is_teaching, day_of_week ),
      subjects ( name_en ),
      sections ( code ),
      rooms ( code )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year_id", academicYearId);
  if (error) throw new Error(error.message);

  const { data: subs } = await db
    .from("substitutions")
    .select(`slot_id, teachers:substitute_teacher_id ( full_name, display_name )`)
    .eq("absence_id", absenceId);

  const subBySlot = new Map<string, string>();
  for (const s of subs ?? []) {
    if (!s.slot_id) continue;
    const t = s.teachers as { full_name: string; display_name: string | null } | null;
    subBySlot.set(s.slot_id, t ? (t.display_name ?? t.full_name) : "Unknown");
  }

  return (slots ?? [])
    .filter(s => {
      const b = s.bell_periods as { day_of_week: string } | null;
      return b?.day_of_week === todayDay;
    })
    .map(s => {
      const b   = s.bell_periods as { period_label: string; starts_at: string; ends_at: string; is_teaching: boolean; day_of_week: string } | null;
      const sub = s.subjects as { name_en: string } | null;
      const sec = s.sections as { code: string } | null;
      const rm  = s.rooms as { code: string } | null;
      return {
        slot_id: s.id,
        period_label: b?.period_label ?? "",
        start: (b?.starts_at ?? "").slice(0, 5),
        end: (b?.ends_at ?? "").slice(0, 5),
        subject: sub?.name_en ?? null,
        section_code: sec?.code ?? null,
        room_code: rm?.code ?? null,
        is_teaching: b?.is_teaching ?? true,
        sub_teacher_name: subBySlot.get(s.id) ?? null,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export type WeekSlot = {
  day: string;
  period_label: string;
  period_number: number;
  start: string;
  end: string;
  subject: string | null;
  teacher_name: string | null;
  section_code: string | null;
};

export async function getWeekTimetableGrid(academicYearId: string): Promise<WeekSlot[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("timetable_slots")
    .select(`
      bell_periods ( period_label, period_number, day_of_week, starts_at, ends_at, is_teaching ),
      subjects ( name_en ),
      teachers ( full_name, display_name ),
      sections ( code )
    `)
    .eq("academic_year_id", academicYearId)
    .limit(300);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter(s => {
      const b = s.bell_periods as { is_teaching: boolean } | null;
      return b?.is_teaching !== false;
    })
    .map(s => {
      const b   = s.bell_periods as { period_label: string; period_number: number; day_of_week: string; starts_at: string; ends_at: string } | null;
      const sub = s.subjects as { name_en: string } | null;
      const t   = s.teachers as { full_name: string; display_name: string | null } | null;
      const sec = s.sections as { code: string } | null;
      return {
        day: b?.day_of_week ?? "",
        period_label: b?.period_label ?? "",
        period_number: b?.period_number ?? 0,
        start: (b?.starts_at ?? "").slice(0, 5),
        end: (b?.ends_at ?? "").slice(0, 5),
        subject: sub?.name_en ?? null,
        teacher_name: t ? (t.display_name ?? t.full_name) : null,
        section_code: sec?.code ?? null,
      };
    });
}
