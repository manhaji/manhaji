import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getApplicantsForYear } from "@manhaj/lib/queries/students";
import { getStudentsForAdmin } from "@manhaj/lib/queries/students";
import AdmissionsClient from "./AdmissionsClient";

export const dynamic = "force-dynamic";

export default async function AdminAdmissionsPage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const [applicants, allStudents] = await Promise.all([
    academicYearId ? getApplicantsForYear(academicYearId).catch(() => []) : Promise.resolve([]),
    academicYearId ? getStudentsForAdmin(academicYearId).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <AdmissionsClient
      applicants={applicants}
      totalEnrolled={allStudents.length}
    />
  );
}
