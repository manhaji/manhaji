import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getHomeworkForStudent, type HomeworkRow } from "@manhaj/lib/queries/lessons";
import KpiRow          from "./components/KpiRow";
import DueSoonBanner   from "./components/DueSoonBanner";
import HomeworkList    from "./components/HomeworkList";
import CompletionTrend from "./components/CompletionTrend";

export const dynamic = "force-dynamic";

export default async function StudentHomeworkPage() {
  const studentId = await getCurrentStudentId();

  const today = new Date().toISOString().slice(0, 10);
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const threeWeeksOut = new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10);

  const homework: HomeworkRow[] = studentId
    ? await getHomeworkForStudent(studentId, fourWeeksAgo, threeWeeksOut)
    : [];

  return (
    <div className="container">
      <h1>Homework</h1>
      <p className="sub">What&apos;s due · what&apos;s in progress · what&apos;s done · AI-suggested time per task.</p>

      <KpiRow homework={homework} today={today} />
      <DueSoonBanner homework={homework} today={today} />
      <HomeworkList homework={homework} today={today} />
      <CompletionTrend homework={homework} />
    </div>
  );
}
