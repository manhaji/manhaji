import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTodayAbsences } from "@manhaj/lib/queries/schedule";
import { getWeekTimetableGrid } from "@manhaj/lib/queries/schedule";
import {
  getCoverIndex,
  getCoverPlan,
  FEATURED_COVER_TEACHER,
  type CoverIndexEntry,
  type TeacherCoverPlan,
} from "@manhaj/lib/queries/cover";
import SchedulerClient from "./SchedulerClient";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const [absences, weekSlots] = await Promise.all([
    getTodayAbsences().catch(() => []),
    academicYearId ? getWeekTimetableGrid(academicYearId).catch(() => []) : Promise.resolve([]),
  ]);

  // Cover plans are read server-side from the pre-computed JSON. Only the
  // lightweight index + the featured teacher's plan are sent to the client;
  // other teachers load on demand via a server action.
  let coverIndex: CoverIndexEntry[] = [];
  let featuredCover: TeacherCoverPlan | null = null;
  try {
    coverIndex = getCoverIndex();
    featuredCover =
      getCoverPlan(FEATURED_COVER_TEACHER) ??
      (coverIndex[0] ? getCoverPlan(coverIndex[0].teacher) : null);
  } catch {
    coverIndex = [];
    featuredCover = null;
  }

  return (
    <SchedulerClient
      absences={absences}
      weekSlots={weekSlots}
      coverIndex={coverIndex}
      featuredCover={featuredCover}
    />
  );
}
