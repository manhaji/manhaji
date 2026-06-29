import type { HomeworkRow } from "@manhaj/lib/queries/lessons";

type Status = "overdue" | "due-today" | "not-started" | "done";

const STATUS_LABEL: Record<Status, string> = {
  "overdue":     "OVERDUE",
  "due-today":   "DUE TODAY",
  "not-started": "PENDING",
  "done":        "DONE",
};

function deriveStatus(hw: HomeworkRow, today: string): Status {
  if (!hw.due) return "not-started";
  const dueDate = hw.due.slice(0, 10);
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due-today";
  return "not-started";
}

function relativeDue(due: string | null, today: string): string {
  if (!due) return "No due date";
  const d = due.slice(0, 10);
  const diff = Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);
  if (diff < 0)  return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export default function HomeworkList({ homework, today }: { homework: HomeworkRow[]; today: string }) {
  const groups: Array<{ key: Status; label: string; items: HomeworkRow[] }> = [
    { key: "overdue",     label: "Overdue",      items: [] },
    { key: "due-today",   label: "Due today",    items: [] },
    { key: "not-started", label: "Not started",  items: [] },
  ];

  for (const hw of homework) {
    const s = deriveStatus(hw, today);
    const g = groups.find(g => g.key === s);
    if (g) g.items.push(hw);
  }

  const nonEmpty = groups.filter(g => g.items.length > 0);

  return (
    <section className="hw-list-card" aria-label="Homework list">
      <header className="hw-list-head">
        <h3>To do · {homework.length} items</h3>
      </header>
      {nonEmpty.length === 0 && <p style={{ padding: "1rem", color: "var(--muted)" }}>No pending homework.</p>}
      {nonEmpty.map(g => (
        <div key={g.key} className={`hw-group hw-group-${g.key}`}>
          <div className="hw-group-label">{g.label} · {g.items.length}</div>
          <ul className="hw-group-list" role="list">
            {g.items.map(h => (
              <li key={h.id} className={`hw-row hw-row-${g.key}`}>
                <span className="hw-row-subj">{h.subject}</span>
                <span className="hw-row-body">
                  <span className="hw-row-title">{h.title}</span>
                </span>
                <span className="hw-row-due">{relativeDue(h.due, today)}</span>
                <span className={`hw-row-status hw-row-status-${g.key}`}>{STATUS_LABEL[g.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
