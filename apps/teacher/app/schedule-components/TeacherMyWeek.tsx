import type { PeriodSlot } from "@manhaj/lib/queries/timetable";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

type Day    = typeof DAYS[number];
type Period = typeof PERIODS[number];

interface Cell {
  subject: string;
  section: string;
  room:    string;
}

const SWART_WEEK: Partial<Record<Period, Partial<Record<Day, Cell | undefined>>>> = {
  P1: { Tue: { subject: "History", section: "10A", room: "R210" }, Thu: { subject: "History", section: "10A", room: "R210" } },
  P2: { Mon: { subject: "Geography", section: "10A", room: "R210" }, Wed: { subject: "History (sub)", section: "10A", room: "R210" }, Thu: { subject: "History", section: "10A", room: "R210" } },
  P3: { Tue: { subject: "History", section: "11 AS", room: "R210" }, Fri: { subject: "History", section: "12 A2", room: "R210" } },
  P4: { Fri: { subject: "Geography", section: "11 AS", room: "R210" } },
  P5: { Mon: { subject: "History", section: "12 A2", room: "R210" }, Wed: { subject: "MUN club", section: "10A", room: "R210" } },
  P6: { Thu: { subject: "Geography", section: "12 A2", room: "R210" }, Fri: { subject: "History", section: "11 AS", room: "R210" } },
};

function normDay(d: string): Day {
  const map: Record<string, Day> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri",
  };
  return map[d.toLowerCase()] ?? (d as Day);
}

type Props = { slots?: PeriodSlot[] };

export default function TeacherMyWeek({ slots }: Props) {
  let grid: Partial<Record<string, Partial<Record<Day, Cell>>>> = SWART_WEEK;
  let displayPeriods: readonly string[] = PERIODS;
  let totalPeriods: number;
  let subtitle: string;

  if (slots && slots.length > 0) {
    const liveGrid: Partial<Record<string, Partial<Record<Day, Cell>>>> = {};
    const periodSet = new Set<string>();
    for (const s of slots) {
      if (!s.is_teaching) continue;
      const day    = normDay(s.day);
      const period = s.period;
      periodSet.add(period);
      if (!liveGrid[period]) liveGrid[period] = {};
      liveGrid[period]![day] = {
        subject: s.subject ?? "—",
        section: s.teacher ?? "",   // teacher field holds section label in getTeacherTimetable
        room:    s.room   ?? "—",
      };
    }
    grid           = liveGrid;
    displayPeriods = [...periodSet].sort();
    totalPeriods   = slots.filter(s => s.is_teaching).length;
    subtitle       = `${totalPeriods} periods this week`;
  } else {
    totalPeriods = Object.values(SWART_WEEK).reduce((acc, row) =>
      acc + Object.values(row ?? {}).filter(Boolean).length, 0);
    subtitle = `History · ${totalPeriods} periods this week · teacher lens`;
  }

  return (
    <section className="tmw-card" aria-label="My week">
      <header className="tmw-head">
        <div>
          <h3>{slots && slots.length > 0 ? "My week" : "Ms Swart · my week"}</h3>
          <p className="tmw-sub">{subtitle}</p>
        </div>
        {!(slots && slots.length > 0) && (
          <div className="tmw-toggle">
            <span className="tmw-toggle-pill active">Ms Swart</span>
            <span className="tmw-toggle-pill">Mr Saab</span>
            <span className="tmw-toggle-pill">Mr Salim</span>
          </div>
        )}
      </header>

      <div className="tmw-grid" role="grid" aria-label="Weekly timetable">
        <div className="tmw-corner" aria-hidden="true" />
        {DAYS.map(d => (
          <div key={d} className="tmw-col-head" role="columnheader">{d}</div>
        ))}

        {displayPeriods.map(p => (
          <>
            <div key={`${p}-rh`} className="tmw-row-head" role="rowheader">{p}</div>
            {DAYS.map(d => {
              const cell = grid[p]?.[d];
              return (
                <div
                  key={`${p}-${d}`}
                  className={`tmw-cell ${cell ? "tmw-cell-filled" : "tmw-cell-free"}`}
                  role="gridcell"
                  aria-label={cell ? `${cell.subject} ${cell.section} ${cell.room}` : "free"}
                >
                  {cell ? (
                    <>
                      <span className="tmw-subj">{cell.subject}</span>
                      <span className="tmw-meta">{cell.section} · {cell.room}</span>
                    </>
                  ) : (
                    <span className="tmw-free">—</span>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </section>
  );
}
