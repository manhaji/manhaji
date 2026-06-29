import type { ReportArchiveRow } from "@manhaj/lib/queries/reports";

function periodLabel(r: ReportArchiveRow): string {
  if (r.generated_at) {
    return new Date(r.generated_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  return r.scope ?? r.report_kind;
}

export default function ReportPreviewCard({ report }: { report: ReportArchiveRow | null }) {
  if (!report) {
    return (
      <section className="pr-pv-card pr-pv-empty" aria-label="Latest report preview">
        <p>No latest report.</p>
      </section>
    );
  }
  return (
    <section className="pr-pv-card" aria-label="Latest report preview">
      <header className="pr-pv-head">
        <span className="pr-pv-tag">Latest · {periodLabel(report)}</span>
        <h3>{report.student_name ?? "Student"}</h3>
      </header>
      <p className="pr-pv-headline">{report.report_kind.replace("_", " ")} report</p>
      <div className="pr-pv-actions">
        {report.storage_path
          ? <a href={report.storage_path} target="_blank" rel="noopener noreferrer" className="pr-pv-btn primary">Open full report</a>
          : <button type="button" className="pr-pv-btn primary" disabled>PDF not yet available</button>}
      </div>
    </section>
  );
}
