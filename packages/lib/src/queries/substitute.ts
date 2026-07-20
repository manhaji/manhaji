import { serverClient } from "../supabase";
import { parseChecklist, type ChecklistItem } from "./classhub";

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
  planNotes: string | null;
  preClassChecklist: ChecklistItem[];
};

export type StudentFlag = {
  studentId: string;
  studentName: string;
  note: string;
  source: "followup" | "behaviour";
  tag: string | null;
  sectionId: string | null;
};

export type FreePeriod = {
  periodNumber: number;
  startsAt: string;
  endsAt: string;
  label: string;
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
    .select("id, section_id, topic, learning_objective, homework_description, plan_notes, pre_class_checklist")
    .in("section_id", sectionIds)
    .eq("held_on", date);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    id:                  r.id,
    sectionId:           r.section_id,
    topic:               r.topic,
    learningObjective:   r.learning_objective,
    homeworkDescription: r.homework_description,
    planNotes:           r.plan_notes,
    preClassChecklist:   parseChecklist(r.pre_class_checklist),
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
    ? await db.from("lessons").select("id, section_id").in("timetable_slot_id", slotIds).gte("held_on", from)
    : { data: [] };
  const lessonIds = (lessons ?? []).map(l => l.id);
  const lessonSectionMap = new Map((lessons ?? []).map(l => [l.id, l.section_id as string]));

  // Follow-ups: lesson-linked (this teacher's recent lessons) + section-scoped
  // (created from the Class hub pop-up, migration 020). Same rows the Class
  // hub reads/writes — one source of truth.
  const followupOrParts = [`section_id.in.(${sectionIds.join(",")})`];
  if (lessonIds.length) followupOrParts.push(`lesson_id.in.(${lessonIds.join(",")})`);

  const [followupRes, behaviourRes] = await Promise.all([
    db.from("lesson_followups")
      .select("student_id, lesson_id, section_id, title, description, tag")
      .or(followupOrParts.join(","))
      .eq("is_done", false),
    db.from("behaviour_notes")
      .select("student_id, section_id, note, kind")
      .in("section_id", sectionIds)
      .gte("observed_on", from),
  ]);

  const allStudentIds = [
    ...new Set([
      ...(followupRes.data ?? []).map(f => f.student_id).filter((id): id is string => id != null),
      ...(behaviourRes.data ?? []).map(b => b.student_id),
    ]),
  ];

  const { data: studentRows } = allStudentIds.length
    ? await db.from("students").select("id, full_name_en").in("id", allStudentIds)
    : { data: [] };
  const nameMap = new Map((studentRows ?? []).map(s => [s.id, s.full_name_en]));

  const flags: StudentFlag[] = [
    ...(followupRes.data ?? []).map(f => ({
      studentId:   f.student_id ?? `class-${f.section_id ?? f.lesson_id}`,
      studentName: f.student_id ? (nameMap.get(f.student_id) ?? "Unknown") : "Whole class",
      note:        f.description ? `${f.title} — ${f.description}` : f.title,
      source:      "followup" as const,
      tag:         f.tag ?? "FOLLOW-UP",
      sectionId:   f.section_id ?? lessonSectionMap.get(f.lesson_id ?? "") ?? null,
    })),
    ...(behaviourRes.data ?? []).map(b => ({
      studentId:   b.student_id,
      studentName: nameMap.get(b.student_id) ?? "Unknown",
      note:        b.note,
      source:      "behaviour" as const,
      tag:         b.kind === "positive" ? "RECOGNITION" : b.kind === "concern" ? "CONCERN" : null,
      sectionId:   b.section_id ?? null,
    })),
  ];
  return flags;
}

// ── Substitute coverage (My Week colour-coding) ─────────────────────────────

export type CoveringSlot = {
  slotId: string;
  day: string;
  period: string;
  sectionLabel: string;
  subjectName: string | null;
  roomCode: string | null;
  coveringFor: string;
};

/**
 * Slots this teacher covers as an accepted substitute (`substitutions` rows
 * where they are the substitute). Drives the distinct colour + "covering
 * for X" legend on My Week.
 */
export async function getCoveringAssignments(teacherId: string): Promise<CoveringSlot[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("substitutions")
    .select(`
      slot_id,
      timetable_slots (
        id,
        bell_periods ( period_label, day_of_week ),
        sections ( code, grade_level ),
        subjects ( name_en ),
        rooms ( code ),
        teachers ( full_name, display_name )
      )
    `)
    .eq("substitute_teacher_id", teacherId);
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap(row => {
    const slot = row.timetable_slots as {
      id: string;
      bell_periods: { period_label: string | null; day_of_week: string } | null;
      sections: { code: string; grade_level: string | null } | null;
      subjects: { name_en: string } | null;
      rooms: { code: string } | null;
      teachers: { full_name: string; display_name: string | null } | null;
    } | null;
    if (!slot?.bell_periods) return [];
    const sec = slot.sections;
    return [{
      slotId: slot.id,
      day: slot.bell_periods.day_of_week,
      period: slot.bell_periods.period_label ?? "",
      sectionLabel: sec ? `${sec.grade_level ?? ""} ${sec.code}`.trim() : "",
      subjectName: slot.subjects?.name_en ?? null,
      roomCode: slot.rooms?.code ?? null,
      coveringFor: slot.teachers ? (slot.teachers.display_name ?? slot.teachers.full_name) : "colleague",
    }];
  });
}

export async function getFreePeriods(academicYearId: string, date: string): Promise<FreePeriod[]> {
  const db = await serverClient();
  const dow = DAYS[new Date(date + "T00:00:00Z").getUTCDay()];

  const { data: slots } = await db
    .from("timetable_slots")
    .select("bell_period_id")
    .eq("academic_year_id", academicYearId);
  const bpIds = [...new Set((slots ?? []).map((s: { bell_period_id: string }) => s.bell_period_id).filter(Boolean))];
  if (!bpIds.length) return [];

  const { data, error } = await db
    .from("bell_periods")
    .select("period_label, period_number, starts_at, ends_at")
    .in("id", bpIds)
    .eq("day_of_week", dow)
    .eq("is_teaching", false)
    .order("period_number");
  if (error) throw new Error(error.message);

  return (data ?? []).map(r => ({
    periodNumber: r.period_number,
    startsAt:     (r.starts_at ?? "").slice(0, 5),
    endsAt:       (r.ends_at ?? "").slice(0, 5),
    label:        r.period_label ?? "",
  }));
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
