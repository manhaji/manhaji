import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getGoalStudentProfile, getStudentLatestRubricScores } from "@manhaj/lib/queries/goals";
import { getStudentTimetable } from "@manhaj/lib/queries/timetable";
import { getHomeworkForStudent } from "@manhaj/lib/queries/lessons";
import { getStudentAssessmentsThisWeek, getStudyBlocksForDate } from "@manhaj/lib/queries/studyplanner";
import StudyPlannerClient from "./StudyPlannerClient";

export const dynamic = "force-dynamic";

function getWeekRange(today: string) {
  const d   = new Date(today + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0 = Sun
  const sun = new Date(d);
  sun.setUTCDate(d.getUTCDate() - dow);
  const thu = new Date(sun);
  thu.setUTCDate(sun.getUTCDate() + 4);
  return {
    weekStart: sun.toISOString().slice(0, 10),
    weekEnd:   thu.toISOString().slice(0, 10),
  };
}

export default async function StudyPlannerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { weekStart, weekEnd } = getWeekRange(today);

  const [studentId, academicYearId] = await Promise.all([
    getCurrentStudentId().catch(() => null),
    getCurrentAcademicYearId().catch(() => null),
  ]);

  const [profile, timetable, homework, assessments, rubricScores, wrapupBlocks] = await Promise.all([
    studentId
      ? getGoalStudentProfile(studentId).catch(() => ({ studentName: "" }))
      : Promise.resolve({ studentName: "" }),
    studentId && academicYearId
      ? getStudentTimetable(studentId, academicYearId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getHomeworkForStudent(studentId, weekStart, weekEnd).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentAssessmentsThisWeek(studentId, weekStart, weekEnd).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentLatestRubricScores(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudyBlocksForDate(studentId, today).catch(() => [])
      : Promise.resolve([]),
  ]);

  const isMock = timetable.length === 0 && homework.length === 0;

  return (
    <StudyPlannerClient
      studentName={profile.studentName}
      periods={timetable}
      homework={homework}
      assessments={assessments}
      rubricScores={rubricScores}
      wrapupBlocks={wrapupBlocks}
      today={today}
      weekStart={weekStart}
      weekEnd={weekEnd}
      isMock={isMock}
    />
  );
}
