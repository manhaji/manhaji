import Link from "next/link";
import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getStudentTimetable, type PeriodSlot } from "@manhaj/lib/queries/timetable";
import { getHomeworkForStudent, type HomeworkRow } from "@manhaj/lib/queries/lessons";
import { MOCK_PERIODS, type StudentPeriod } from "@manhaj/lib/mock-student-schedule";
import NowCard       from "./components/NowCard";
import TodayTimeline from "./components/TodayTimeline";
import WeekView      from "./components/WeekView";

export const dynamic = "force-dynamic";

function mockToPeriodSlots(mock: StudentPeriod[]): PeriodSlot[] {
  return mock.map(p => ({
    id: null,
    period: p.period,
    day: p.day,
    start: p.start,
    end: p.end,
    subject: p.subject,
    subject_code: null,
    teacher: p.teacher ?? null,
    room: p.room ?? null,
    is_teaching: !p.state,
    bring: p.bring ?? null,
  }));
}

export default async function StudentSchedulePage() {
  const [studentId, academicYearId] = await Promise.all([
    getCurrentStudentId().catch(() => null),
    getCurrentAcademicYearId().catch(() => null),
  ]);

  const dbPeriods: PeriodSlot[] = studentId && academicYearId
    ? await getStudentTimetable(studentId, academicYearId).catch(() => [])
    : [];

  const periods = dbPeriods.length > 0 ? dbPeriods : mockToPeriodSlots(MOCK_PERIODS);

  // Homework tied to teacher-assigned lessons (OR demo). Window: today ± a week.
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const from  = new Date(now.getTime() - 7  * 86400000).toISOString().slice(0, 10);
  const to    = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const homework: HomeworkRow[] = studentId
    ? await getHomeworkForStudent(studentId, from, to).catch(() => [])
    : [];

  return (
    <div className="container">
      <Link href="/student" className="back-link">← Back to dashboard</Link>
      <h1>My Schedule</h1>
      <p className="sub">Today + the rest of the week · what&apos;s next, where, what to bring, what&apos;s due.</p>

      <NowCard periods={periods} />
      <TodayTimeline periods={periods} homework={homework} today={today} />
      <WeekView periods={periods} />
    </div>
  );
}
