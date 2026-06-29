import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import {
  getDailyAttendanceTrend,
  getSectionAttendanceStats,
  getChronicAbsentees,
} from "@manhaj/lib/queries/attendance";
import AttendancePageClient from "./AttendancePageClient";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const academicYearId = await getCurrentAcademicYearId();

  const today = new Date();
  const to    = today.toISOString().slice(0, 10);
  const from  = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dailyTrend, sectionStats, chronicAbsentees] = await Promise.all([
    academicYearId ? getDailyAttendanceTrend(academicYearId, from, to) : Promise.resolve([]),
    getSectionAttendanceStats(from, to),
    academicYearId ? getChronicAbsentees(academicYearId, 10) : Promise.resolve([]),
  ]);

  return (
    <AttendancePageClient
      dailyTrend={dailyTrend}
      sectionStats={sectionStats}
      chronicAbsentees={chronicAbsentees}
    />
  );
}
