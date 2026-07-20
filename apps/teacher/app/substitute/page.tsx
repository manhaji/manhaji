import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getEffectiveTimetableYearId } from "@manhaj/lib/queries/timetable";
import {
  getTeacherDaySchedule,
  getLessonsForSections,
  getStudentFlagsForSections,
  getSubstituteSheet,
  getFreePeriods,
} from "@manhaj/lib/queries/substitute";
import { serverClient } from "@manhaj/lib";
import SubstituteClient from "./SubstituteClient";

export const dynamic = "force-dynamic";

async function getTeacherInfo(teacherId: string) {
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

export default async function SubstitutePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: qDate } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const forDate = qDate ?? today;

  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const teacherInfo = teacherId
    ? await getTeacherInfo(teacherId).catch(() => ({ schoolId: null, teacherName: "" }))
    : { schoolId: null, teacherName: "" };

  // The published timetable may live in a prior academic year (demo dataset).
  const timetableYearId = academicYearId
    ? await getEffectiveTimetableYearId(academicYearId).catch(() => academicYearId)
    : null;

  const slots = (teacherId && timetableYearId)
    ? await getTeacherDaySchedule(teacherId, timetableYearId, forDate).catch(() => [])
    : [];

  const sectionIds = [...new Set(slots.map(s => s.sectionId))];
  const weekStart  = new Date(new Date(forDate).getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const [lessons, flags, sheet, freePeriods] = await Promise.all([
    sectionIds.length ? getLessonsForSections(sectionIds, forDate).catch(() => [])             : Promise.resolve([]),
    (sectionIds.length && teacherId) ? getStudentFlagsForSections(sectionIds, teacherId, weekStart).catch(() => []) : Promise.resolve([]),
    teacherId ? getSubstituteSheet(teacherId, forDate).catch(() => null)                       : Promise.resolve(null),
    timetableYearId ? getFreePeriods(timetableYearId, forDate).catch(() => [])                : Promise.resolve([]),
  ]);

  return (
    <SubstituteClient
      slots={slots}
      lessons={lessons}
      flags={flags}
      sheet={sheet}
      freePeriods={freePeriods}
      teacherName={teacherInfo.teacherName}
      teacherId={teacherId ?? ""}
      forDate={forDate}
      today={today}
    />
  );
}
