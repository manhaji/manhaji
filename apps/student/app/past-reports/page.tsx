import { getCurrentStudentId } from "@manhaj/lib/queries/auth";
import { getReportArchive } from "@manhaj/lib/queries/reports";
import StudentReportArchive from "./components/StudentReportArchive";

export const dynamic = "force-dynamic";

export default async function StudentPastReportsPage() {
  const studentId = await getCurrentStudentId();
  const reports = studentId
    ? await getReportArchive({ studentId })
    : [];

  return (
    <div className="container">
      <h1>Past Reports</h1>
      <p className="sub">AY 2025–26</p>
      <StudentReportArchive reports={reports} />
    </div>
  );
}
