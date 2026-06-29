import type { ReportArchiveRow } from "@manhaj/lib/queries/reports";

export default function KpiRow({ reports }: { reports: ReportArchiveRow[] }) {
  const monthly = reports.filter(r => r.report_kind === "monthly").length;
  const term    = reports.filter(r => r.report_kind === "term").length;
  const pills = [
    { label: "Total reports", value: `${reports.length}`, tone: "good" },
    { label: "Monthly",        value: `${monthly}`,         tone: "good" },
    { label: "Term",           value: `${term}`,            tone: "good" },
  ];
  return (
    <section className="pr-kpi-row" aria-label="Archive KPIs">
      {pills.map(p => (
        <div key={p.label} className={`pr-kpi pr-kpi-${p.tone}`}>
          <div className="pr-kpi-value">{p.value}</div>
          <div className="pr-kpi-label">{p.label}</div>
        </div>
      ))}
    </section>
  );
}
