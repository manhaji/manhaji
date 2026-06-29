import type { ReportArchiveRow } from "@manhaj/lib/queries/reports";

const ICONS: Record<string, string> = { monthly: "📄", term: "📚" };

function periodLabel(r: ReportArchiveRow): string {
  if (r.generated_at) {
    return new Date(r.generated_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  return r.scope ?? r.report_kind;
}

export default function ReportTimeline({ reports }: { reports: ReportArchiveRow[] }) {
  if (reports.length === 0) {
    return (
      <section className="pr-tl-card" aria-label="Reports timeline">
        <p className="pr-tl-empty">No reports for the current filter.</p>
      </section>
    );
  }

  // Group by student_id → student_name
  const byStudent = new Map<string, ReportArchiveRow[]>();
  for (const r of reports) {
    const key = r.student_id ?? "unknown";
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key)!.push(r);
  }

  return (
    <section className="pr-tl-card" aria-label="Reports timeline">
      {Array.from(byStudent.entries()).map(([studentId, rows]) => (
        <div key={studentId} className="pr-tl-group">
          <h3 className="pr-tl-group-head">{rows[0].student_name ?? "Student"}</h3>
          <ul className="pr-tl-list" role="list">
            {rows.map(r => (
              <li key={r.id} className={`pr-tl-row pr-tl-row-${r.report_kind}`}>
                <span className="pr-tl-ic" aria-hidden>{ICONS[r.report_kind] ?? "📄"}</span>
                <span className="pr-tl-body">
                  <span className="pr-tl-period">{periodLabel(r)}</span>
                  <span className="pr-tl-headline">{r.report_kind.replace("_", " ")}</span>
                </span>
                <span className={`pr-tl-type pr-tl-type-${r.report_kind}`}>{r.report_kind.toUpperCase()}</span>
                {r.storage_path
                  ? <a href={r.storage_path} target="_blank" rel="noopener noreferrer" className="pr-tl-open">Open</a>
                  : <button type="button" className="pr-tl-open" disabled>PDF pending</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
