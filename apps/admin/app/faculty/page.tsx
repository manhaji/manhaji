import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTeachersWithLoad } from "@manhaj/lib/queries/teachers";
import FacultyPageClient from "./FacultyPageClient";

export const dynamic = "force-dynamic";

export default async function AdminFacultyPage() {
  const academicYearId = await getCurrentAcademicYearId();
  const teachers = academicYearId ? await getTeachersWithLoad(academicYearId) : [];
  return <FacultyPageClient teachers={teachers} />;
}
