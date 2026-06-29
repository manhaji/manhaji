import type { HomeworkRow } from "@manhaj/lib/queries/lessons";

type WeekBucket = { week_label: string; on_time_pct: number };

function buildWeeklyBuckets(homework: HomeworkRow[], today: string): WeekBucket[] {
  // Build 4-week buckets going back from today
  const buckets: WeekBucket[] = [];
  for (let w = 3; w >= 0; w--) {
    const weekEnd   = new Date(Date.parse(today) - w * 7 * 86400_000);
    const weekStart = new Date(weekEnd.getTime() - 6 * 86400_000);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);
    const inWeek = homework.filter(h => h.due && h.due.slice(0, 10) >= ws && h.due.slice(0, 10) <= we);
    // Items whose due date passed are considered on-time if they're not overdue relative to the weekEnd
    const total = inWeek.length;
    const onTime = inWeek.filter(h => h.due && h.due.slice(0, 10) >= ws).length;
    buckets.push({
      week_label: `W${4 - w}`,
      on_time_pct: total > 0 ? Math.round((onTime / total) * 100) : 100,
    });
  }
  return buckets;
}

export default function CompletionTrend({ homework }: { homework: HomeworkRow[] }) {
  const today   = new Date().toISOString().slice(0, 10);
  const data    = homework.length > 0 ? buildWeeklyBuckets(homework, today) : [];
  const max     = 100;
  const w       = 56;
  const gap     = 10;
  const h       = 90;
  const baseX   = 30;

  if (data.length === 0) {
    return (
      <section className="hw-ct-card" aria-label="Completion trend">
        <header className="hw-ct-head"><h3>On-time completion · last 4 weeks</h3></header>
        <p style={{ padding: "1rem", color: "var(--muted)" }}>No data yet.</p>
      </section>
    );
  }

  return (
    <section className="hw-ct-card" aria-label="Completion trend">
      <header className="hw-ct-head">
        <h3>On-time completion · last 4 weeks</h3>
      </header>
      <svg viewBox="0 0 320 130" width="100%" height="130" role="img" aria-label="Bar chart">
        <line x1="20" y1="100" x2="310" y2="100" stroke="var(--color-border)" strokeWidth="1" />
        {data.map((c, i) => {
          const x  = baseX + i * (w + gap);
          const bh = Math.round((c.on_time_pct / max) * h);
          const y  = 100 - bh;
          return (
            <g key={c.week_label}>
              <rect x={x} y={y} width={w} height={bh} rx="3" fill="var(--color-primary)" opacity={0.7 + i * 0.1} />
              <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--color-ink)">{c.on_time_pct}%</text>
              <text x={x + w / 2} y={118} textAnchor="middle" fontSize="9" fill="var(--color-muted)">{c.week_label}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
