import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getRubricScoresForStudent, getGoalsForStudent } from "@manhaj/lib/queries/growth";
import RubricRadar               from "./components/RubricRadar";
import AxisSparklines            from "./components/AxisSparklines";
import StrengthsAndGrowth        from "./components/StrengthsAndGrowth";
import GoalsList                 from "./components/GoalsList";
import CurrentGrades             from "./components/CurrentGrades";
import UniversityPlacementSignal from "./components/UniversityPlacementSignal";
import ImprovementPlan           from "./components/ImprovementPlan";
import SubjectPercentiles        from "./components/SubjectPercentiles";
import MonthOverMonthDelta       from "./components/MonthOverMonthDelta";

export const dynamic = "force-dynamic";

export default async function StudentGrowthPage() {
  const [studentId, academicYearId] = await Promise.all([
    getCurrentStudentId(),
    getCurrentAcademicYearId(),
  ]);

  const [scores, goals] = await Promise.all([
    studentId ? getRubricScoresForStudent(studentId) : Promise.resolve([]),
    studentId && academicYearId ? getGoalsForStudent(studentId, academicYearId) : Promise.resolve([]),
  ]);

  return (
    <div className="container">
      <h1>My Growth</h1>
      <p className="sub">
        6-axis rubric · IGCSE subject grades · class percentiles · improvement plan ·
        university placement signal · what changed this month.
      </p>

      <RubricRadar scores={scores} />
      <AxisSparklines scores={scores} />
      <StrengthsAndGrowth scores={scores} />
      <GoalsList goals={goals} />

      <CurrentGrades />
      <UniversityPlacementSignal />
      <ImprovementPlan />
      <SubjectPercentiles />
      <MonthOverMonthDelta />
    </div>
  );
}
