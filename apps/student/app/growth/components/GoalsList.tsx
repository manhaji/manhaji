import type { GoalRow } from "@manhaj/lib/queries/growth";

const STATUS_LABEL: Record<string, string> = {
  active:   "ACTIVE",
  achieved: "DONE",
  dropped:  "DROPPED",
};

function statusClass(status: string): string {
  if (status === "achieved") return "done";
  if (status === "dropped")  return "behind";
  return "on-track";
}

export default function GoalsList({ goals }: { goals: GoalRow[] }) {
  return (
    <section className="gr-goals-card" aria-label="Goals">
      <header className="gr-goals-head">
        <h3>My goals · this term</h3>
        <p className="gr-goals-sub">Set with your advisor at the start of term · updated weekly.</p>
      </header>
      {goals.length === 0 && <p style={{ padding: "1rem", color: "var(--muted)" }}>No goals set yet.</p>}
      <ul className="gr-goals-list" role="list">
        {goals.map(g => {
          const progress = g.latest_progress ?? 0;
          const cls = statusClass(g.status);
          return (
            <li key={g.id} className={`gr-goal-row gr-goal-${cls}`}>
              <span className="gr-goal-tag">{g.kind ?? "Goal"}</span>
              <div className="gr-goal-body">
                <h4>{g.title}</h4>
                {g.description && <p>{g.description}</p>}
                <div className="gr-goal-bar">
                  <span className="gr-goal-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="gr-goal-side">
                <span className={`gr-goal-chip gr-goal-chip-${cls}`}>{STATUS_LABEL[g.status] ?? g.status.toUpperCase()}</span>
                {g.last_checkin && <span className="gr-goal-when">Updated {g.last_checkin}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
