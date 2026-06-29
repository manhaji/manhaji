import type { HomeworkRow } from "@manhaj/lib/queries/lessons";

function relativeDue(due: string | null, today: string): string {
  if (!due) return "No due date";
  const d = due.slice(0, 10);
  const diff = Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);
  if (diff < 0)  return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `in ${diff}d`;
}

export default function DueSoonBanner({ homework, today }: { homework: HomeworkRow[]; today: string }) {
  // Pick the most urgent: first overdue, then earliest due-today/soon
  const overdue = homework.filter(h => h.due && h.due.slice(0, 10) < today);
  const upcoming = homework.filter(h => h.due && h.due.slice(0, 10) >= today);
  const item = overdue[0] ?? upcoming[0] ?? null;

  if (!item) {
    return (
      <section className="hw-due-card hw-due-empty" aria-label="Up next">
        <p><strong>You&apos;re all caught up.</strong> No pending homework.</p>
      </section>
    );
  }

  const isOverdue = item.due && item.due.slice(0, 10) < today;
  const status = isOverdue ? "overdue" : "due-today";

  return (
    <section className={`hw-due-card hw-due-${status}`} aria-label="Most urgent homework">
      <div className="hw-due-head">
        <span className="hw-due-tag">{item.subject}</span>
        <span className="hw-due-status">
          {isOverdue ? `OVERDUE · ${relativeDue(item.due, today)}` : `Due ${relativeDue(item.due, today)}`}
        </span>
      </div>
      <h3 className="hw-due-title">{item.title}</h3>
      <div className="hw-due-actions">
        <button type="button" className="hw-due-btn primary">Mark done</button>
      </div>
    </section>
  );
}
