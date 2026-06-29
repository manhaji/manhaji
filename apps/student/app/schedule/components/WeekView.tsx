import type { PeriodSlot } from "@manhaj/lib/queries/timetable";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function todayDow(): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] ?? "Mon";
}

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function abbrev(subject: string | null): string {
  if (!subject) return "—";
  const map: Record<string, string> = {
    English: "Eng", Maths: "Mth", Mathematics: "Mth", Chemistry: "Chm",
    Biology: "Bio", Physics: "Phy", History: "His", Geography: "Geo",
    Arabic: "Ara", PE: "PE", ICT: "ICT", "MUN club": "MUN",
  };
  return map[subject] ?? subject.slice(0, 3);
}

export default function WeekView({ periods }: { periods: PeriodSlot[] }) {
  const today = todayDow();
  const now   = nowHHMM();

  const byDay: Record<string, PeriodSlot[]> = {};
  for (const day of DAYS) byDay[day] = periods.filter(p => p.day === day);

  return (
    <section className="sc-wv-card" aria-label="Week view">
      <header className="sc-wv-head">
        <h3>This week</h3>
      </header>
      <div className="sc-wv-grid">
        {DAYS.map(d => (
          <div key={d} className={`sc-wv-col ${d === today ? "sc-wv-today" : ""}`}>
            <div className="sc-wv-dow">{d}{d === today ? " · Today" : ""}</div>
            {byDay[d].map(p => {
              const isNow = d === today && p.start <= now && p.end > now;
              const cls = ["sc-wv-cell"];
              if (!p.is_teaching) cls.push("sc-wv-break");
              if (isNow)          cls.push("sc-wv-now");
              return (
                <div key={p.period} className={cls.join(" ")}>
                  <span className="sc-wv-key">{p.period}</span>
                  <span className="sc-wv-subj">{abbrev(p.subject)}</span>
                  {p.room && p.is_teaching && <span className="sc-wv-room">{p.room}</span>}
                </div>
              );
            })}
            {byDay[d].length === 0 && (
              <div className="sc-wv-cell sc-wv-break"><span className="sc-wv-subj">—</span></div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
