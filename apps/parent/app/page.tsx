import { getCurrentParentId } from "@manhaj/lib/queries/auth";
import { getParentChildren, getAttendanceForStudents } from "@manhaj/lib/queries/parents";
import { getHomeworkForSection, getLessonsForSection } from "@manhaj/lib/queries/lessons";
import { getInvoicesForParent } from "@manhaj/lib/queries/invoices";
import { getUpcomingActivitySlipsForStudent } from "@manhaj/lib/queries/permissionslip";
import {
  getBehaviourEventsForStudent,
  getAssessmentResultsForStudent,
  getWeeklyDigestDraft,
  getTeacherRecognitionForStudent,
} from "@manhaj/lib/queries/weeklydigest";
import WeeklyDigestClient from "./WeeklyDigestClient";

export const dynamic = "force-dynamic";

function getWeekRange(today: Date) {
  const dow = today.getUTCDay(); // 0=Sun
  const sun = new Date(today);
  sun.setUTCDate(today.getUTCDate() - dow);
  const thu = new Date(sun);
  thu.setUTCDate(sun.getUTCDate() + 4);
  return {
    weekStart: sun.toISOString().slice(0, 10),
    weekEnd: thu.toISOString().slice(0, 10),
  };
}

export default async function ParentDashboard() {
  const today = new Date();
  const { weekStart, weekEnd } = getWeekRange(today);
  const todayStr = today.toISOString().slice(0, 10);

  const nextWeekStart = new Date(today);
  nextWeekStart.setUTCDate(today.getUTCDate() + (7 - today.getUTCDay()));
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setUTCDate(nextWeekStart.getUTCDate() + 4);
  const nextStart = nextWeekStart.toISOString().slice(0, 10);
  const nextEnd = nextWeekEnd.toISOString().slice(0, 10);

  const parentId = await getCurrentParentId().catch(() => null);

  const children = parentId
    ? await getParentChildren(parentId).catch(() => [])
    : [];

  const invoices = parentId
    ? await getInvoicesForParent(parentId).catch(() => [])
    : [];

  const studentIds = children.map(c => c.student_id);

  const attendance = studentIds.length
    ? await getAttendanceForStudents(studentIds, weekStart, weekEnd).catch(() => [])
    : [];

  // Per-child detailed data — all fetched in parallel for the first child initially
  const childData = await Promise.all(
    children.map(async child => {
      const sectionId = child.section_id;
      const studentId = child.student_id;

      const [lessons, homework, behaviourEvents, assessmentResults, digestDraft, recognition, nextLessons, slips] =
        await Promise.all([
          sectionId
            ? getLessonsForSection(sectionId, weekStart, weekEnd).catch(() => [])
            : Promise.resolve([]),
          sectionId
            ? getHomeworkForSection(sectionId, weekStart, weekEnd).catch(() => [])
            : Promise.resolve([]),
          getBehaviourEventsForStudent(studentId, weekStart, weekEnd).catch(() => []),
          getAssessmentResultsForStudent(studentId, weekStart, weekEnd).catch(() => []),
          getWeeklyDigestDraft(studentId).catch(() => null),
          getTeacherRecognitionForStudent(studentId, weekStart, weekEnd).catch(() => null),
          sectionId
            ? getLessonsForSection(sectionId, nextStart, nextEnd).catch(() => [])
            : Promise.resolve([]),
          sectionId
            ? getUpcomingActivitySlipsForStudent(studentId, sectionId, todayStr).catch(() => [])
            : Promise.resolve([]),
        ]);

      const att = attendance.find(a => a.student_id === studentId);
      const topResult = [...assessmentResults].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0] ?? null;
      const positiveNotes = behaviourEvents.filter(e => e.kind === "positive").length;
      const pendingSlips = slips.filter(s => s.status === "not_started" || s.status === "draft");

      return {
        child,
        att,
        lessons,
        homework,
        behaviourEvents,
        assessmentResults,
        digestDraft,
        recognition,
        nextLessons,
        pendingSlips,
        topResult,
        homeworkCount: homework.length,
        positiveNotes,
      };
    }),
  );

  const unpaidInvoices = invoices.filter(i => i.status !== "paid");
  const isMock = children.length === 0;

  return (
    <WeeklyDigestClient
      kids={children}
      childData={childData}
      unpaidInvoices={unpaidInvoices}
      weekStart={weekStart}
      weekEnd={weekEnd}
      todayStr={todayStr}
      isMock={isMock}
    />
  );
}
