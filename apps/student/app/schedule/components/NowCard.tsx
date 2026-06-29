import type { PeriodSlot } from "@manhaj/lib/queries/timetable";

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function todayDow(): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] ?? "Mon";
}

export default function NowCard({ periods }: { periods: PeriodSlot[] }) {
  const today = todayDow();
  const now   = nowHHMM();
  const todayTeaching = periods.filter(p => p.day === today && p.is_teaching);

  const current = todayTeaching.find(p => p.start <= now && p.end > now);
  const next    = todayTeaching.find(p => p.start > now);

  if (!current) {
    return (
      <section className="sc-now-card sc-now-empty" aria-label="Right now">
        <h3>No class right now</h3>
        <p>{next
          ? `Next: ${next.subject ?? "—"} · starts ${next.start}`
          : "You're outside school hours. Next class begins tomorrow at 08:00."}</p>
      </section>
    );
  }

  const nowMs  = Date.parse(`1970-01-01T${now}:00`);
  const endMs  = Date.parse(`1970-01-01T${current.end}:00`);
  const minutes_left = Math.max(0, Math.round((endMs - nowMs) / 60000));

  return (
    <section className="sc-now-card" aria-label="Right now">
      <div className="sc-now-head">
        <span className="sc-now-tag">Right now · {current.period}</span>
        <span className="sc-now-time">{minutes_left} min left</span>
      </div>
      <h3 className="sc-now-title">{current.subject ?? "—"}</h3>
      <p className="sc-now-meta">
        {current.teacher && <>· {current.teacher} </>}
        {current.room && <>· {current.room} </>}
        · {current.start}–{current.end}
      </p>
      {next && (
        <div className="sc-now-next">
          <span className="sc-now-next-label">Next up</span>
          <span>{next.period} · {next.subject ?? "—"}{next.room ? ` · ${next.room}` : ""} · starts {next.start}</span>
        </div>
      )}
    </section>
  );
}
