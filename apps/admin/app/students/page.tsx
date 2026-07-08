import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getStudentsWithRiskFlags, getStudentsForAdmin } from "@manhaj/lib/queries/students";
import AtRiskDashboardClient from "./AtRiskDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const [flaggedStudents, allStudents] = await Promise.all([
    academicYearId ? getStudentsWithRiskFlags(academicYearId).catch(() => []) : Promise.resolve([]),
    academicYearId ? getStudentsForAdmin(academicYearId).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <AtRiskDashboardClient
      flaggedStudents={flaggedStudents}
      totalStudents={allStudents.length}
    />
  );
}
