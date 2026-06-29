import { getCurrentTeacherId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTeacherWithSections } from "@manhaj/lib/queries/teachers";
import { getStudentsForSections } from "@manhaj/lib/queries/students";
import { MOCK_STUDENTS } from "@manhaj/lib/mock-students";
import TeacherInputPageClient from "./TeacherInputPageClient";

export const dynamic = "force-dynamic";

const FALLBACK_SECTIONS = ["10A", "9A", "11 AS", "12 A2"];

export default async function TeacherInputPage() {
  const [teacherId, academicYearId] = await Promise.all([
    getCurrentTeacherId(),
    getCurrentAcademicYearId(),
  ]);

  const teacherSections = teacherId && academicYearId
    ? await getTeacherWithSections(teacherId, academicYearId)
    : [];

  const sectionIds = teacherSections
    .map(r => (r.sections as { id: string } | null)?.id)
    .filter((id): id is string => id != null);

  const dbStudents = sectionIds.length > 0 ? await getStudentsForSections(sectionIds) : [];

  const students = dbStudents.length > 0
    ? dbStudents.map(s => ({ id: s.id, full_name: s.full_name_en, section_code: s.section_code }))
    : MOCK_STUDENTS
        .filter(s => FALLBACK_SECTIONS.includes(s.section_code))
        .map(s => ({ id: s.id, full_name: s.full_name, section_code: s.section_code }));

  return <TeacherInputPageClient students={students} />;
}
