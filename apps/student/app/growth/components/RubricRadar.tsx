import type { RubricAxisScore } from "@manhaj/lib/queries/growth";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = SIZE / 2 - 32;

function polyPoints(scores: number[], n: number): string {
  return scores.map((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (s / 5) * MAX_R;
    return `${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`;
  }).join(" ");
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RubricRadar({ scores }: { scores: RubricAxisScore[] }) {
  if (scores.length === 0) {
    return (
      <section className="gr-radar-card" aria-label="6-axis rubric radar">
        <header className="gr-radar-head"><h3>Rubric this month vs last</h3></header>
        <p style={{ padding: "1rem", color: "var(--muted)" }}>No rubric scores yet.</p>
      </section>
    );
  }

  const axes     = scores.map(s => ({ key: s.axis_code, label: titleCase(s.axis_code) }));
  const thisMo   = scores.map(s => s.this_mo);
  const lastMo   = scores.map(s => s.last_mo);
  const gridRings = [1, 2, 3, 4, 5].map(v => (v / 5) * MAX_R);

  return (
    <section className="gr-radar-card" aria-label="6-axis rubric radar">
      <header className="gr-radar-head">
        <div>
          <h3>Rubric this month vs last</h3>
          <div className="gr-radar-sub">Coloured area = this month · grey dashed = last month.</div>
        </div>
        <div className="gr-radar-legend">
          <span className="gr-radar-sw gr-radar-sw-this" /> This
          <span className="gr-radar-sw gr-radar-sw-last" /> Last
        </div>
      </header>

      <div className="gr-rubric-row">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", maxWidth: "280px", height: "auto" }} role="img" aria-label="Radar chart">
          {gridRings.map((r, i) => (
            <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
          ))}
          {axes.map((a, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
            const x  = CX + MAX_R * Math.cos(angle);
            const y  = CY + MAX_R * Math.sin(angle);
            const lx = CX + (MAX_R + 20) * Math.cos(angle);
            const ly = CY + (MAX_R + 20) * Math.sin(angle);
            const isLow = scores[i].this_mo < 3.0;
            return (
              <g key={a.key}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold"
                  fill={isLow ? "var(--color-danger)" : "var(--color-ink)"}>
                  {a.label}
                </text>
              </g>
            );
          })}
          <polygon points={polyPoints(lastMo, axes.length)} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
          <polygon points={polyPoints(thisMo, axes.length)} fill="var(--color-primary)" fillOpacity="0.22" stroke="var(--color-primary)" strokeWidth="2.5" />
          {thisMo.map((s, i) => {
            const angle = (Math.PI * 2 * i) / thisMo.length - Math.PI / 2;
            const r = (s / 5) * MAX_R;
            return <circle key={i} cx={CX + r * Math.cos(angle)} cy={CY + r * Math.sin(angle)} r="3" fill="var(--color-primary)" />;
          })}
        </svg>

        <div className="gr-axis-list" aria-label="Axis scores">
          {scores.map(s => {
            const delta = +(s.this_mo - s.last_mo).toFixed(1);
            const pct   = Math.round((s.this_mo / 5) * 100);
            const isFlag = s.this_mo < 3.0;
            const toneClass = delta > 0 ? "up" : delta < 0 ? "dn" : "flat";
            const trendArrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
            const sign = delta > 0 ? "+" : "";
            return (
              <div key={s.axis_code} className="gr-axis-row">
                <span className="gr-axis-nm">{titleCase(s.axis_code)}</span>
                <div className="gr-axis-bar">
                  <div className={`gr-axis-fill${isFlag ? " gr-axis-fill-flag" : ""}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`gr-axis-v${isFlag ? " gr-axis-v-flag" : ""}`}>{s.this_mo.toFixed(1)} / 5</span>
                <span className={`gr-axis-trend ${toneClass}`}>{trendArrow} {sign}{Math.abs(delta).toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
