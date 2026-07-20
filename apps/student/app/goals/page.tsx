import { getCurrentStudentId } from "@manhaj/lib/queries/auth";
import {
  getGoalStudentProfile,
  getStudentLatestRubricScores,
  getStudentGoals,
  getLatestReflection,
} from "@manhaj/lib/queries/goals";
import GoalsClient from "./GoalsClient";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const studentId = await getCurrentStudentId().catch(() => null);

  const [profile, rubricScores, goals, reflection] = await Promise.all([
    studentId
      ? getGoalStudentProfile(studentId).catch(() => ({ studentName: "" }))
      : Promise.resolve({ studentName: "" }),
    studentId
      ? getStudentLatestRubricScores(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getStudentGoals(studentId).catch(() => [])
      : Promise.resolve([]),
    studentId
      ? getLatestReflection(studentId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <GoalsClient
      live={studentId !== null}
      studentName={profile.studentName}
      rubricScores={rubricScores}
      goals={goals}
      savedReflection={reflection}
    />
  );
}
