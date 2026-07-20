import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getCurrentSlotForTeacher } from "@manhaj/lib/queries/attendance";
import { getEffectiveTimetableYearId } from "@manhaj/lib/queries/timetable";
import { getStudentsBySection } from "@manhaj/lib/queries/students";
import { getTeacherSectionOptions } from "@manhaj/lib/queries/classhub";
import { getRubricForSchool, getRubricCriteria, getRubricScoresForStudents } from "@manhaj/lib/queries/rubric";
import { serverClient } from "@manhaj/lib";
import RubricClient from "./RubricClient";

export const dynamic = "force-dynamic";

async function getTeacherSchoolId(teacherId: string): Promise<string | null> {
  const db = await serverClient();
  const { data } = await db.from("teachers").select("school_id").eq("id", teacherId).single();
  return data?.school_id ?? null;
}

export default async function RubricScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: sectionParam } = await searchParams;

  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // The published timetable may live in a prior academic year (demo dataset).
  const timetableYearId = academicYearId
    ? await getEffectiveTimetableYearId(academicYearId).catch(() => academicYearId)
    : null;

  const [currentSlot, sectionOptions, schoolId] = await Promise.all([
    (teacherId && timetableYearId)
      ? getCurrentSlotForTeacher(teacherId, timetableYearId).catch(() => null)
      : Promise.resolve(null),
    teacherId ? getTeacherSectionOptions(teacherId).catch(() => []) : Promise.resolve([]),
    teacherId ? getTeacherSchoolId(teacherId).catch(() => null) : Promise.resolve(null),
  ]);

  // Selected section: ?section= param → current-period section → first option.
  const selectedOption =
    sectionOptions.find(o => o.sectionId === sectionParam)
    ?? sectionOptions.find(o => o.sectionId === currentSlot?.sectionId)
    ?? sectionOptions[0]
    ?? null;

  const sectionId = selectedOption?.sectionId ?? currentSlot?.sectionId ?? null;

  const students = sectionId
    ? await getStudentsBySection(sectionId).catch(() => [])
    : [];

  const studentIds = (students ?? []).map(s => s.id);

  const rubric = schoolId
    ? await getRubricForSchool(schoolId).catch(() => null)
    : null;

  const [criteria, scores] = await Promise.all([
    rubric ? getRubricCriteria(rubric.id).catch(() => []) : Promise.resolve([]),
    (rubric && studentIds.length > 0)
      ? getRubricScoresForStudents(studentIds, rubric.id, currentMonth).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <RubricClient
      key={sectionId ?? "demo"}
      slot={currentSlot}
      students={students ?? []}
      criteria={criteria}
      scores={scores}
      rubricId={rubric?.id ?? null}
      teacherId={teacherId ?? ""}
      schoolId={schoolId ?? ""}
      currentMonth={currentMonth}
      sectionOptions={sectionOptions}
      selectedSectionId={selectedOption?.sectionId ?? null}
      selectedSubjectId={selectedOption?.subjectId ?? null}
    />
  );
}
