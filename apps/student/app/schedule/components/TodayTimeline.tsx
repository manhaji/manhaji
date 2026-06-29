import type { PeriodSlot } from "@manhaj/lib/queries/timetable";

function todayDow(): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] ?? "Mon";
}

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function TodayTimeline({ periods }: { periods: PeriodSlot[] }) {
  const today = todayDow();
  const now   = nowHHMM();

  const todayPeriods = periods.filter(p => p.day === today);

  return (
    <section className="sc-tl-card" aria-label="Today timeline">
      <header className="sc-tl-head">
        <h3>Today&apos;s classes · {today}</h3>
      </header>
      <ol className="sc-tl-list">
        {todayPeriods.map(p => {
          const isNow  = p.start <= now && p.end > now;
          const isDone = p.end <= now && !isNow;
          const isBreak = !p.is_teaching;
          const cls = ["sc-tl-row"];
          if (isBreak) cls.push("sc-tl-break");
          if (isDone)  cls.push("sc-tl-done");
          if (isNow)   cls.push("sc-tl-now");
          return (
            <li key={p.period} className={cls.join(" ")}>
              <span className="sc-tl-time">{p.start}–{p.end}</span>
              <span className="sc-tl-pkey">{p.period}</span>
              <span className="sc-tl-body">
                <span className="sc-tl-subj">{p.subject ?? p.period}</span>
                {(p.teacher || p.room) && (
                  <span className="sc-tl-meta">
                    {p.teacher}{p.teacher && p.room ? " · " : ""}{p.room}
                  </span>
                )}
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
