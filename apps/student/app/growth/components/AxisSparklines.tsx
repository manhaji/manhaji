import type { RubricAxisScore } from "@manhaj/lib/queries/growth";

function sparkPath(history: Array<{ month: string; score: number }>, w: number, h: number, pad = 4): string {
  if (history.length < 2) return "";
  const max   = Math.max(...history.map(p => p.score));
  const min   = Math.min(...history.map(p => p.score));
  const range = max - min || 1;
  const step  = (w - pad * 2) / (history.length - 1);
  return history.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - ((p.score - min) / range) * (h - pad * 2);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export default function AxisSparklines({ scores }: { scores: RubricAxisScore[] }) {
  if (scores.length === 0) {
    return (
      <section className="gr-spark-card" aria-label="Axis sparklines">
        <header className="gr-spark-head"><h3>Each axis · last 6 months</h3></header>
        <p style={{ padding: "1rem", color: "var(--muted)" }}>No rubric data yet.</p>
      </section>
    );
  }

  return (
    <section className="gr-spark-card" aria-label="Axis sparklines">
      <header className="gr-spark-head">
        <h3>Each axis · last {Math.max(...scores.map(s => s.history.length))} months</h3>
      </header>
      <div className="gr-spark-grid">
        {scores.map(s => {
          const sixMo   = s.history[0]?.score ?? s.last_mo;
          const delta   = +(s.this_mo - sixMo).toFixed(1);
          const isFlag  = s.this_mo < 3.0 || delta < 0;
          const tone    = isFlag ? "warn" : delta > 0 ? "good" : "flat";
          const sign    = delta > 0 ? "+" : "";
          const lineColor = isFlag ? "var(--color-danger)" : "var(--color-primary)";
          const label   = s.axis_code.charAt(0).toUpperCase() + s.axis_code.slice(1);
          return (
            <article key={s.axis_code} className="gr-spark-tile">
              <div className="gr-spark-top">
                <span className="gr-spark-name">{label}</span>
                <span className={`gr-spark-delta gr-spark-${tone}`}>{sign}{delta}</span>
              </div>
              <svg viewBox="0 0 120 40" width="100%" height="40">
                <path d={sparkPath(s.history, 120, 40)} stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="gr-spark-bot">
                <span style={isFlag ? { color: "var(--color-danger)", fontWeight: 700 } : {}}>
                  now <strong>{s.this_mo.toFixed(1)}</strong>
                </span>
                <span>6mo ago {sixMo.toFixed(1)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
