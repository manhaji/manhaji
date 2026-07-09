import { serverClient } from "../supabase";

export type DaySlot = {
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
};

export type SlotLesson = {
  id: string;
  sectionId: string;
  topic: string | null;
  learningObjective: string | null;
  homeworkDescription: string | null;
};

export type StudentFlag = {
  studentId: string;
  studentName: string;
  note: string;
  source: "followup" | "behaviour";
  tag: string | null;
};

export type SubSheetRow = {
  id: string;
  ack_at: string | null;
  sub_teacher_id: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function getTeacherDaySchedule(
  teacherId: string,
  academicYearId: string,
  date: string,
): Promise<DaySlot[]> {
  const db = await serverClient();
  const dow = DAYS[new Date(date + "T00:00:00Z").getUTCDay()];

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

  return (data ?? [])
    .filter(s => {
      const b = s.bell_periods as { day_of_week: string; is_teaching: boolean | null } | null;
      return b?.day_of_week === dow && b?.is_teaching !== false;
    })
    .map(s => {
      const b   = s.bell_periods as { id: string; period_label: string | null; period_number: number; starts_at: string; ends_at: string } | null;
      const sub = s.subjects as { name_en: string } | null;
      const sec = s.sections as { code: string; grade_level: string | null } | null;
      const rm  = s.rooms as { code: string } | null;
      return {
        slotId:       s.id,
        sectionId:    s.section_id,
        sectionCode:  sec?.code ?? "",
        gradeLevel:   sec?.grade_level ?? null,
        subjectName:  sub?.name_en ?? null,
        roomCode:     rm?.code ?? null,
        bellPeriodId: b?.id ?? "",
        periodLabel:  b?.period_label ?? "",
        periodNumber: b?.period_number ?? 0,
        startsAt:     (b?.starts_at ?? "").slice(0, 5),
        endsAt:       (b?.ends_at ?? "").slice(0, 5),
      };
    })
    .sort((a, b) => a.periodNumber - b.periodNumber);
}

export async function getLessonsForSections(sectionIds: string[], date: string): Promise<SlotLesson[]> {
  if (!sectionIds.length) return [];
  const db = await serverClient();
  const { data, error } = await db
    .from("lessons")
    .select("id, section_id, topic, learning_objective, homework_description")
    .in("section_id", sectionIds)
    .eq("held_on", date);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    id:                  r.id,
    sectionId:           r.section_id,
    topic:               r.topic,
    learningObjective:   r.learning_objective,
    homeworkDescription: r.homework_description,
  }));
}

export async function getStudentFlagsForSections(
  sectionIds: string[],
  teacherId: string,
  from: string,
): Promise<StudentFlag[]> {
  if (!sectionIds.length) return [];
  const db = await serverClient();

  // Lesson followups with student_id = student-specific notes for the sub
  const { data: slots } = await db
    .from("timetable_slots")
    .select("id")
    .in("section_id", sectionIds)
    .eq("teacher_id", teacherId);
  const slotIds = (slots ?? []).map(s => s.id);

  const { data: lessons } = slotIds.length
    ? await db.from("lessons").select("id").in("timetable_slot_id", slotIds).gte("held_on", from)
    : { data: [] };
  const lessonIds = (lessons ?? []).map(l => l.id);

  const [followupRes, behaviourRes] = await Promise.all([
    lessonIds.length
      ? db.from("lesson_followups")
          .select("student_id, title, description, tag")
          .in("lesson_id", lessonIds)
          .not("student_id", "is", null)
          .eq("is_done", false)
      : Promise.resolve({ data: [] }),
    db.from("behaviour_notes")
      .select("student_id, note, kind")
      .in("section_id", sectionIds)
      .gte("observed_on", from),
  ]);

  const allStudentIds = [
    ...new Set([
      ...(followupRes.data ?? []).map(f => f.student_id as string),
      ...(behaviourRes.data ?? []).map(b => b.student_id),
    ]),
  ];

  if (!allStudentIds.length) return [];

  const { data: studentRows } = await db
    .from("students")
    .select("id, full_name_en")
    .in("id", allStudentIds);
  const nameMap = new Map((studentRows ?? []).map(s => [s.id, s.full_name_en]));

  const flags: StudentFlag[] = [
    ...(followupRes.data ?? []).map(f => ({
      studentId:   f.student_id as string,
      studentName: nameMap.get(f.student_id as string) ?? "Unknown",
      note:        f.description ?? f.title,
      source:      "followup" as const,
      tag:         f.tag,
    })),
    ...(behaviourRes.data ?? []).map(b => ({
      studentId:   b.student_id,
      studentName: nameMap.get(b.student_id) ?? "Unknown",
      note:        b.note,
      source:      "behaviour" as const,
      tag:         b.kind === "positive" ? "RECOGNITION" : b.kind === "concern" ? "CONCERN" : null,
    })),
  ];
  return flags;
}

export async function getSubstituteSheet(teacherId: string, date: string): Promise<SubSheetRow | null> {
  const db = await serverClient();
  const { data: absence } = await db
    .from("staff_absences")
    .select("id")
    .eq("teacher_id", teacherId)
    .lte("starts_on", date)
    .gte("ends_on", date)
    .limit(1)
    .maybeSingle();
  if (!absence) return null;

  const { data: sheet } = await db
    .from("substitute_sheets")
    .select("id, ack_at, sub_teacher_id")
    .eq("staff_absence_id", absence.id)
    .eq("for_date", date)
    .maybeSingle();
  return sheet ?? null;
}
