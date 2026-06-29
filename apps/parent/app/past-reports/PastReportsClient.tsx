"use client";

import type { ReportArchiveRow } from "@manhaj/lib/queries/reports";
import KpiRow            from "./components/KpiRow";
import ReportTimeline    from "./components/ReportTimeline";
import ReportPreviewCard from "./components/ReportPreviewCard";

export default function PastReportsClient({ reports }: { reports: ReportArchiveRow[] }) {
  return (
    <div className="container">
      <h1>Past Reports</h1>
      <p className="sub">Archive · AY 2025–26</p>
      <KpiRow reports={reports} />
      <ReportPreviewCard report={reports[0] ?? null} />
      <ReportTimeline reports={reports} />
    </div>
  );
}
