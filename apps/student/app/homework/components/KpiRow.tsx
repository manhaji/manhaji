import type { HomeworkRow } from "@manhaj/lib/queries/lessons";

function deriveStatus(hw: HomeworkRow, today: string): "overdue" | "due-today" | "not-started" | "done" {
  if (!hw.due) return "not-started";
  const dueDate = hw.due.slice(0, 10);
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due-today";
  return "not-started";
}

export default function KpiRow({ homework, today }: { homework: HomeworkRow[]; today: string }) {
  const tomorrow = new Date(Date.parse(today) + 86400_000).toISOString().slice(0, 10);
  const overdue    = homework.filter(h => deriveStatus(h, today) === "overdue").length;
  const dueSoon    = homework.filter(h => h.due && h.due.slice(0, 10) <= tomorrow && h.due.slice(0, 10) >= today).length;
  const pending    = homework.filter(h => deriveStatus(h, today) === "not-started").length;
  const pills = [
    { label: "Overdue",       value: `${overdue}`,  tone: overdue > 0 ? "danger" : "good" },
    { label: "Due in 24h",    value: `${dueSoon}`,  tone: "warn" },
    { label: "Pending",       value: `${pending}`,  tone: "good" },
    { label: "Total assigned",value: `${homework.length}`, tone: "good" },
  ];
  return (
    <section className="hw-kpi-row" aria-label="Homework KPIs">
      {pills.map(p => (
        <div key={p.label} className={`hw-kpi hw-kpi-${p.tone}`}>
          <div className="hw-kpi-value">{p.value}</div>
          <div className="hw-kpi-label">{p.label}</div>
        </div>
      ))}
    </section>
  );
}
