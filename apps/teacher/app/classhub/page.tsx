import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getCurrentSlotForTeacher } from "@manhaj/lib/queries/attendance";
import {
  getWeekLessons,
  getNextLesson,
  getFollowupsForLessons,
  getWeekAssessments,
  getWeekAttendance,
  getWeekBehaviourNotes,
  getLatestCommDraft,
  getParentCountForSection,
} from "@manhaj/lib/queries/classhub";
import { serverClient } from "@manhaj/lib";
import ClassHubClient from "./ClassHubClient";

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

export default async function ClassHubPage() {
  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const { start: weekStart, end: weekEnd } = getWeekRange(0);

  const [currentSlot, teacherInfo] = await Promise.all([
    (teacherId && academicYearId)
      ? getCurrentSlotForTeacher(teacherId, academicYearId).catch(() => null)
      : Promise.resolve(null),
    teacherId
      ? getTeacherSchoolAndName(teacherId).catch(() => ({ schoolId: null, teacherName: "" }))
      : Promise.resolve({ schoolId: null, teacherName: "" }),
  ]);

  const sectionId = currentSlot?.sectionId ?? null;

  const [lessons, attendance, behaviourNotes, commDraft, parentCount] = await Promise.all([
    sectionId ? getWeekLessons(sectionId, weekStart, weekEnd).catch(() => [])         : Promise.resolve([]),
    sectionId ? getWeekAttendance(sectionId, weekStart, weekEnd).catch(() => ({ total: 0, present: 0, absent: [], late: [] })) : Promise.resolve({ total: 0, present: 0, absent: [], late: [] }),
    sectionId ? getWeekBehaviourNotes(sectionId, weekStart, weekEnd).catch(() => [])  : Promise.resolve([]),
    teacherId ? getLatestCommDraft(teacherId).catch(() => null)                        : Promise.resolve(null),
    sectionId ? getParentCountForSection(sectionId).catch(() => 0)                    : Promise.resolve(0),
  ]);

  const lessonIds = lessons.map(l => l.id);

  const [followups, assessmentData, nextLesson] = await Promise.all([
    lessonIds.length > 0 ? getFollowupsForLessons(lessonIds).catch(() => []) : Promise.resolve([]),
    sectionId ? getWeekAssessments(sectionId, weekStart, weekEnd).catch(() => ({ assessments: [], results: [] })) : Promise.resolve({ assessments: [], results: [] }),
    sectionId ? getNextLesson(sectionId, weekEnd).catch(() => null)          : Promise.resolve(null),
  ]);

  return (
    <ClassHubClient
      slot={currentSlot}
      lessons={lessons}
      followups={followups}
      assessments={assessmentData.assessments}
      assessmentResults={assessmentData.results}
      attendanceStats={attendance}
      behaviourNotes={behaviourNotes}
      nextLesson={nextLesson}
      commDraft={commDraft}
      teacherName={teacherInfo.teacherName}
      teacherId={teacherId ?? ""}
      schoolId={teacherInfo.schoolId ?? ""}
      parentCount={parentCount}
      weekStart={weekStart}
      weekEnd={weekEnd}
      today={today}
    />
  );
}
