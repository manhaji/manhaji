import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import {
  getApplicantsForAdmissions,
  getParentOptions,
  getReEnrollmentRoster,
} from "@manhaj/lib/queries/admissions";
import AdmissionsClient from "./AdmissionsClient";

export const dynamic = "force-dynamic";

export default async function AdminAdmissionsPage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const [applicants, roster, parentOptions] = await Promise.all([
    academicYearId
      ? getApplicantsForAdmissions(academicYearId).catch(() => [])
      : Promise.resolve([]),
    getReEnrollmentRoster(academicYearId).catch(() => []),
    getParentOptions().catch(() => []),
  ]);

  return (
    <AdmissionsClient
      applicants={applicants}
      roster={roster}
      parentOptions={parentOptions}
    />
  );
}
