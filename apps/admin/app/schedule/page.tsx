import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTodayAbsences } from "@manhaj/lib/queries/schedule";
import { getWeekTimetableGrid } from "@manhaj/lib/queries/schedule";
import SchedulerClient from "./SchedulerClient";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const [absences, weekSlots] = await Promise.all([
    getTodayAbsences().catch(() => []),
    academicYearId ? getWeekTimetableGrid(academicYearId).catch(() => []) : Promise.resolve([]),
  ]);

  return <SchedulerClient absences={absences} weekSlots={weekSlots} />;
}
