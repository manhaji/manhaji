import type { ReportArchiveRow } from "@manhaj/lib/queries/reports";

const ICONS: Record<string, string> = { monthly: "📄", term: "📚" };

export default function StudentReportArchive({ reports }: { reports: ReportArchiveRow[] }) {
  const latest = reports[0] ?? null;

  return (
    <>
      {latest && (
        <section className="pr-pv-card" aria-label="Latest report preview">
          <header className="pr-pv-head">
            <span className="pr-pv-tag">Latest · {latest.generated_at ? new Date(latest.generated_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : latest.report_kind}</span>
          </header>
          <p className="pr-pv-headline">{latest.report_kind.replace("_", " ")} report</p>
          <div className="pr-pv-actions">
            {latest.storage_path && (
              <a href={latest.storage_path} target="_blank" rel="noopener noreferrer" className="pr-pv-btn primary">Open full report</a>
            )}
          </div>
        </section>
      )}

      <section className="pr-tl-card" aria-label="Reports timeline">
        <h3 className="pr-tl-group-head">All my reports · {reports.length}</h3>
        {reports.length === 0 && <p style={{ padding: "1rem", color: "var(--muted)" }}>No reports yet.</p>}
        <ul className="pr-tl-list" role="list">
          {reports.map(r => (
            <li key={r.id} className={`pr-tl-row pr-tl-row-${r.report_kind}`}>
              <span className="pr-tl-ic" aria-hidden>{ICONS[r.report_kind] ?? "📄"}</span>
              <span className="pr-tl-body">
                <span className="pr-tl-period">
                  {r.generated_at ? new Date(r.generated_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : r.scope}
                </span>
                <span className="pr-tl-headline">{r.report_kind.replace("_", " ")}</span>
              </span>
              <span className={`pr-tl-type pr-tl-type-${r.report_kind}`}>{r.report_kind.toUpperCase()}</span>
              {r.storage_path && (
                <a href={r.storage_path} target="_blank" rel="noopener noreferrer" className="pr-tl-open">Open</a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
