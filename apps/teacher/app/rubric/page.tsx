import { getCurrentAcademicYearId, getCurrentTeacherId } from "@manhaj/lib/queries/auth";
import { getCurrentSlotForTeacher } from "@manhaj/lib/queries/attendance";
import { getStudentsBySection } from "@manhaj/lib/queries/students";
import { getRubricForSchool, getRubricCriteria, getRubricScoresForStudents } from "@manhaj/lib/queries/rubric";
import { serverClient } from "@manhaj/lib";
import RubricClient from "./RubricClient";

export const dynamic = "force-dynamic";

async function getTeacherSchoolId(teacherId: string): Promise<string | null> {
  const db = await serverClient();
  const { data } = await db.from("teachers").select("school_id").eq("id", teacherId).single();
  return data?.school_id ?? null;
}

export default async function RubricScoringPage() {
  const [academicYearId, teacherId] = await Promise.all([
    getCurrentAcademicYearId().catch(() => null),
    getCurrentTeacherId().catch(() => null),
  ]);

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const currentSlot = (teacherId && academicYearId)
    ? await getCurrentSlotForTeacher(teacherId, academicYearId).catch(() => null)
    : null;

  const sectionId = currentSlot?.sectionId ?? null;

  const schoolId = teacherId
    ? await getTeacherSchoolId(teacherId).catch(() => null)
    : null;

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
      slot={currentSlot}
      students={students ?? []}
      criteria={criteria}
      scores={scores}
      rubricId={rubric?.id ?? null}
      teacherId={teacherId ?? ""}
      schoolId={schoolId ?? ""}
      currentMonth={currentMonth}
    />
  );
}
