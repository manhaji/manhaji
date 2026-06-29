import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getStudentTimetable, type PeriodSlot } from "@manhaj/lib/queries/timetable";
import NowCard       from "./components/NowCard";
import TodayTimeline from "./components/TodayTimeline";
import WeekView      from "./components/WeekView";

export const dynamic = "force-dynamic";

export default async function StudentSchedulePage() {
  const [studentId, academicYearId] = await Promise.all([
    getCurrentStudentId(),
    getCurrentAcademicYearId(),
  ]);

  const periods: PeriodSlot[] = studentId && academicYearId
    ? await getStudentTimetable(studentId, academicYearId)
    : [];

  return (
    <div className="container">
      <h1>My Schedule</h1>
      <p className="sub">Today + the rest of the week · what&apos;s next, where, what to bring.</p>

      <NowCard periods={periods} />
      <TodayTimeline periods={periods} />
      <WeekView periods={periods} />
    </div>
  );
}
