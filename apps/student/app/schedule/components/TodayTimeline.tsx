import type { PeriodSlot } from "@manhaj/lib/queries/timetable";
import type { HomeworkRow } from "@manhaj/lib/queries/lessons";

function todayDow(): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] ?? "Mon";
}

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

type Props = {
  periods: PeriodSlot[];
  /** Teacher-assigned homework (from lessons). Matched to today's classes by subject. */
  homework?: HomeworkRow[];
  today?: string;
};

export default function TodayTimeline({ periods, homework = [], today }: Props) {
  const dow = todayDow();
  const now = nowHHMM();
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  const todayPeriods = periods.filter(p => p.day === dow);

  // Homework due today, grouped by subject so we can hang it on the matching class.
  const dueBySubject = new Map<string, HomeworkRow[]>();
  for (const h of homework) {
    if (h.due !== todayStr) continue;
    const key = (h.subject ?? "").toLowerCase();
    const list = dueBySubject.get(key) ?? [];
    list.push(h);
    dueBySubject.set(key, list);
  }

  return (
    <section className="sc-tl-card" aria-label="Today timeline">
      <header className="sc-tl-head">
        <h3>Today&apos;s classes · {dow}</h3>
        <p className="sc-tl-sub">What to bring and what&apos;s due, class by class.</p>
      </header>
      <ol className="sc-tl-list">
        {todayPeriods.map(p => {
          const isNow   = p.start <= now && p.end > now;
          const isDone  = p.end <= now && !isNow;
          const isBreak = !p.is_teaching;
          const cls = ["sc-tl-row"];
          if (isBreak) cls.push("sc-tl-break");
          if (isDone)  cls.push("sc-tl-done");
          if (isNow)   cls.push("sc-tl-now");

          const subjKey = (p.subject ?? "").toLowerCase();
          const dueHere = p.is_teaching ? (dueBySubject.get(subjKey) ?? []) : [];
          const bring   = p.is_teaching ? (p.bring ?? null) : null;

          return (
            <li key={`${p.day}-${p.period}`} className={cls.join(" ")}>
              <span className="sc-tl-time">{p.start}–{p.end}</span>
              <span className="sc-tl-pkey">{p.period}</span>
              <span className="sc-tl-body">
                <span className="sc-tl-subj">
                  {p.subject ?? p.period}{isNow ? " · now" : ""}
                </span>
                {(p.teacher || p.room) && (
                  <span className="sc-tl-meta">
                    {p.teacher}{p.teacher && p.room ? " · " : ""}{p.room}
                  </span>
                )}
                {bring && bring.length > 0 && (
                  <span className="sc-tl-bring">
                    <b>Bring:</b> {bring.join(", ")}
                  </span>
                )}
                {dueHere.map(h => (
                  <span key={h.id} className="sc-tl-due">
                    <b>Due today:</b> {h.title}
                  </span>
                ))}
              </span>
              {isDone && <span className="sc-tl-check">✓</span>}
              {isNow  && <span className="sc-tl-pill">NOW</span>}
            </li>
          );
        })}
        {todayPeriods.length === 0 && (
          <li className="sc-tl-row"><span className="sc-tl-body">No classes today.</span></li>
        )}
      </ol>
    </section>
  );
}
