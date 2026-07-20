import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getCurrentSlotForTeacher } from "@manhaj/lib/queries/attendance";
import { getEffectiveTimetableYearId } from "@manhaj/lib/queries/timetable";
import { getStudentsBySection } from "@manhaj/lib/queries/students";
import {
  getWeekLessons,
  getNextLesson,
  getFollowupsForSection,
  getWeekAssessments,
  getWeekAttendance,
  getWeekBehaviourNotes,
  getLatestCommDraft,
  getParentCountForSection,
  getTeacherSectionOptions,
} from "@manhaj/lib/queries/classhub";
import { serverClient } from "@manhaj/lib";
import ClassHubClient, { type WeekView } from "./ClassHubClient";

export const dynamic = "force-dynamic";

async function getTeacherSchoolAndName(teacherId: string): Promise<{ schoolId: string | null; teacherName: string }> {
  const db = await serverClient();
  const { data } = await db
    .from("teachers")
    .select("school_id, full_name, display_name")
    .eq("id", teacherId)
    .single();
  return {
    schoolId:    data?.school_id ?? null,
    teacherName: data?.display_name ?? data?.full_name ?? "",
  };
}

function getWeekRange(offsetWeeks = 0): { start: string; end: string } {
  const today = new Date();
  const dow = today.getDay();
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today.getTime() + (daysToMon + offsetWeeks * 7) * 86400000);
  const friday  = new Date(monday.getTime() + 4 * 86400000);
  return {
    start: monday.toISOString().slice(0, 10),
    end:   friday.toISOString().slice(0, 10),
  };
}

export default async function ClassHubPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; week?: string }>;
}) {
  const { section: sectionParam, week: weekParam } = await searchParams;
  const weekView: WeekView = weekParam === "last" ? "last" : weekParam === "next" ? "next" : "this";
  const weekOffset = weekView === "last" ? -1 : weekView === "next" ? 1 : 0;

  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const { start: weekStart, end: weekEnd } = getWeekRange(weekOffset);
  const { start: nextWeekStart, end: nextWeekEnd } = getWeekRange(1);

  // The published timetable may live in a prior academic year (demo dataset).
  const timetableYearId = academicYearId
    ? await getEffectiveTimetableYearId(academicYearId).catch(() => academicYearId)
    : null;

  const [currentSlot, teacherInfo, sectionOptions] = await Promise.all([
    (teacherId && timetableYearId)
      ? getCurrentSlotForTeacher(teacherId, timetableYearId).catch(() => null)
      : Promise.resolve(null),
    teacherId
      ? getTeacherSchoolAndName(teacherId).catch(() => ({ schoolId: null, teacherName: "" }))
      : Promise.resolve({ schoolId: null, teacherName: "" }),
    teacherId ? getTeacherSectionOptions(teacherId).catch(() => []) : Promise.resolve([]),
  ]);

  // Section selector drives the whole page: ?section= → current period → first option.
  const selectedOption =
    sectionOptions.find(o => o.sectionId === sectionParam)
    ?? sectionOptions.find(o => o.sectionId === currentSlot?.sectionId)
    ?? sectionOptions[0]
    ?? null;

  const sectionId = selectedOption?.sectionId ?? currentSlot?.sectionId ?? null;

  const [lessons, attendance, behaviourNotes, commDraft, parentCount, sectionStudents, nextWeekLessons] = await Promise.all([
    sectionId ? getWeekLessons(sectionId, weekStart, weekEnd).catch(() => [])         : Promise.resolve([]),
    sectionId ? getWeekAttendance(sectionId, weekStart, weekEnd).catch(() => ({ total: 0, present: 0, absent: [], late: [] })) : Promise.resolve({ total: 0, present: 0, absent: [], late: [] }),
    sectionId ? getWeekBehaviourNotes(sectionId, weekStart, weekEnd).catch(() => [])  : Promise.resolve([]),
    teacherId ? getLatestCommDraft(teacherId).catch(() => null)                        : Promise.resolve(null),
    sectionId ? getParentCountForSection(sectionId).catch(() => 0)                    : Promise.resolve(0),
    sectionId ? getStudentsBySection(sectionId).catch(() => [])                       : Promise.resolve([]),
    sectionId ? getWeekLessons(sectionId, nextWeekStart, nextWeekEnd).catch(() => []) : Promise.resolve([]),
  ]);

  const lessonIds = lessons.map(l => l.id);

  const [followups, assessmentData, nextLesson] = await Promise.all([
    sectionId ? getFollowupsForSection(sectionId, lessonIds).catch(() => []) : Promise.resolve([]),
    sectionId ? getWeekAssessments(sectionId, weekStart, weekEnd).catch(() => ({ assessments: [], results: [] })) : Promise.resolve({ assessments: [], results: [] }),
    sectionId ? getNextLesson(sectionId, today).catch(() => null)            : Promise.resolve(null),
  ]);

  return (
    <ClassHubClient
      key={`${sectionId ?? "demo"}-${weekView}`}
      slot={currentSlot}
      lessons={lessons}
      followups={followups}
      assessments={assessmentData.assessments}
      assessmentResults={assessmentData.results}
      attendanceStats={attendance}
      behaviourNotes={behaviourNotes}
      nextLesson={nextLesson}
      nextWeekLesson={nextWeekLessons[0] ?? null}
      nextWeekStart={nextWeekStart}
      commDraft={commDraft}
      teacherName={teacherInfo.teacherName}
      teacherId={teacherId ?? ""}
      schoolId={teacherInfo.schoolId ?? ""}
      parentCount={parentCount}
      weekStart={weekStart}
      weekEnd={weekEnd}
      today={today}
      weekView={weekView}
      sectionOptions={sectionOptions}
      selectedSectionId={selectedOption?.sectionId ?? null}
      selectedSubjectId={selectedOption?.subjectId ?? null}
      sectionStudents={(sectionStudents ?? []).map(s => ({ id: s.id, name: s.full_name_en }))}
    />
  );
}
