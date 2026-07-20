import { getCurrentStudentId } from "@manhaj/lib/queries/auth";
import { getGoalStudentProfile } from "@manhaj/lib/queries/goals";
import {
  getStudentUniversityApps,
  getStudentCounselor,
  getUniversities,
  getStudentTestScores,
  getStudentMasterDocs,
  getStudentBookingRequest,
} from "@manhaj/lib/queries/applications";
import ApplicationTrackerClient from "./ApplicationTrackerClient";

export const dynamic = "force-dynamic";

export default async function ApplicationTrackerPage() {
  const studentId = await getCurrentStudentId().catch(() => null);

  const [profile, apps, counselor, universities, testScores, masterDocs, booking] = await Promise.all([
    studentId
      ? getGoalStudentProfile(studentId).catch(() => ({ studentName: "" }))
      : Promise.resolve({ studentName: "" }),
    studentId
      ? getStudentUniversityApps(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentCounselor(studentId).catch(() => null)
      : Promise.resolve(null),
    getUniversities().catch(() => []),
    studentId
      ? getStudentTestScores(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentMasterDocs(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentBookingRequest(studentId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <ApplicationTrackerClient
      live={studentId !== null}
      studentName={profile.studentName}
      apps={apps}
      universities={universities}
      testScores={testScores}
      masterDocs={masterDocs}
      booking={booking}
      counselor={counselor}
    />
  );
}
