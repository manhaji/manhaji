import type { RubricAxisScore } from "@manhaj/lib/queries/growth";

export default function StrengthsAndGrowth({ scores }: { scores: RubricAxisScore[] }) {
  if (scores.length === 0) {
    return (
      <section className="gr-sg-row" aria-label="Strengths and growth areas">
        <div className="gr-sg-card"><p style={{ color: "var(--muted)" }}>No rubric data yet.</p></div>
      </section>
    );
  }

  const sorted     = [...scores].sort((a, b) => b.this_mo - a.this_mo);
  const strengths  = sorted.slice(0, 3);
  const growthAreas = [...scores].sort((a, b) => a.this_mo - b.this_mo).slice(0, 3);

  return (
    <section className="gr-sg-row" aria-label="Strengths and growth areas">
      <div className="gr-sg-card gr-sg-strengths">
        <h3>Strengths</h3>
        <ul role="list">
          {strengths.map(s => (
            <li key={s.axis_code}>
              <span className="gr-sg-name">{s.axis_code.charAt(0).toUpperCase() + s.axis_code.slice(1)}</span>
              <span className="gr-sg-score">{s.this_mo.toFixed(1)} / 5</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="gr-sg-card gr-sg-growth">
        <h3>Growth areas</h3>
        <ul role="list">
          {growthAreas.map(s => (
            <li key={s.axis_code}>
              <span className="gr-sg-name">{s.axis_code.charAt(0).toUpperCase() + s.axis_code.slice(1)}</span>
              <span className="gr-sg-score">{s.this_mo.toFixed(1)} / 5</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
