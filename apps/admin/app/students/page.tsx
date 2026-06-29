import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getStudentsForAdmin } from "@manhaj/lib/queries/students";
import StudentsPageClient from "./StudentsPageClient";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const academicYearId = await getCurrentAcademicYearId();
  const dbStudents = academicYearId ? await getStudentsForAdmin(academicYearId) : [];
  return <StudentsPageClient dbStudents={dbStudents} />;
}
