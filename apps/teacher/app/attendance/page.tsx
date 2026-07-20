import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getCurrentSlotForTeacher, getAttendanceForPeriod, getYesterdayAttendanceForSection } from "@manhaj/lib/queries/attendance";
import { getEffectiveTimetableYearId } from "@manhaj/lib/queries/timetable";
import { getStudentsBySection } from "@manhaj/lib/queries/students";
import { serverClient } from "@manhaj/lib";
import OneTapClient from "./OneTapClient";

export const dynamic = "force-dynamic";

async function getTeacherSchoolId(teacherId: string): Promise<string | null> {
  const db = await serverClient();
  const { data } = await db.from("teachers").select("school_id").eq("id", teacherId).single();
  return data?.school_id ?? null;
}

function getAttendanceDateRange() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return { today, yesterday };
}

export default async function OneTapAttendancePage() {
  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const { today, yesterday } = getAttendanceDateRange();

  // The published timetable may live in a prior academic year (demo dataset).
  const timetableYearId = academicYearId
    ? await getEffectiveTimetableYearId(academicYearId).catch(() => academicYearId)
    : null;

  const currentSlot = (teacherId && timetableYearId)
    ? await getCurrentSlotForTeacher(teacherId, timetableYearId).catch(() => null)
    : null;

  const sectionId = currentSlot?.sectionId ?? null;

  const [students, todayMarks, yesterdayMarks, schoolId] = await Promise.all([
    sectionId ? getStudentsBySection(sectionId).catch(() => []) : Promise.resolve([]),
    (sectionId && currentSlot?.bellPeriodId)
      ? getAttendanceForPeriod(sectionId, today, currentSlot.bellPeriodId).catch(() => [])
      : Promise.resolve([]),
    sectionId
      ? getYesterdayAttendanceForSection(sectionId, yesterday).catch(() => [])
      : Promise.resolve([]),
    teacherId ? getTeacherSchoolId(teacherId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <OneTapClient
      slot={currentSlot}
      students={students ?? []}
      todayMarks={todayMarks}
      yesterdayMarks={yesterdayMarks}
      teacherId={teacherId ?? ""}
      schoolId={schoolId ?? ""}
      today={today}
    />
  );
}
