import type { WeekSlot } from "@manhaj/lib/queries/schedule";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"];
const MOCK_PERIODS = [
  { period: "P1", start: "08:00", end: "09:00" },
  { period: "P2", start: "09:00", end: "09:45" },
  { period: "P3", start: "09:45", end: "10:30" },
  { period: "P4", start: "10:45", end: "11:30" },
  { period: "P5", start: "12:45", end: "13:30" },
  { period: "P6", start: "13:30", end: "14:15" },
];

const MOCK_GRID: Record<string, Record<string, { subject: string; teacher: string; flag?: string }>> = {
  P1: {
    Sun: { subject: "Maths", teacher: "Ms. Fatima (sub)" , flag: "sub" },
    Mon: { subject: "Arabic", teacher: "Mr. Sam" },
    Tue: { subject: "English", teacher: "Ms. Reem" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "Maths", teacher: "Ms. Fatima" },
  },
  P2: {
    Sun: { subject: "Maths", teacher: "Ms. Fatima (sub)", flag: "sub" },
    Mon: { subject: "Maths", teacher: "Ms. Tariq" },
    Tue: { subject: "PE", teacher: "Coach Sara" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "English", teacher: "Ms. Reem" },
  },
  P3: {
    Sun: { subject: "Maths", teacher: "Ms. Fatima (sub)", flag: "sub" },
    Mon: { subject: "English", teacher: "Ms. Reem" },
    Tue: { subject: "English", teacher: "Ms. Reem" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "Arabic", teacher: "Mr. Maryam" },
  },
  P4: {
    Sun: { subject: "Lunch · 45 min", teacher: "", flag: "break" },
    Mon: { subject: "Lunch · 45 min", teacher: "", flag: "break" },
    Tue: { subject: "Lunch · 45 min", teacher: "", flag: "break" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "Lunch · 45 min", teacher: "", flag: "break" },
  },
  P5: {
    Sun: { subject: "Maths G6C", teacher: "Ms. Fatima (sub)", flag: "sub" },
    Mon: { subject: "Free", teacher: "" },
    Tue: { subject: "Arabic", teacher: "Mr. Maryam" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "Maths · TEST", teacher: "Ms. Fatima" },
  },
  P6: {
    Sun: { subject: "Free", teacher: "" },
    Mon: { subject: "Free", teacher: "" },
    Tue: { subject: "Free", teacher: "" },
    Wed: { subject: "Field trip", teacher: "" },
    Thu: { subject: "English", teacher: "Coach Sara" },
  },
};

export default function MasterTimetableView({
  weekSlots,
  title,
}: {
  weekSlots: WeekSlot[];
  title: string;
}) {
  // Build grid from DB data if available; fall back to mock
  const hasData = weekSlots.length > 0;

  // Group DB slots by day+period for the grid
  type Cell = { subject: string; teacher: string; section?: string; flag?: string };
  const dbGrid: Record<string, Record<string, Cell[]>> = {};
  if (hasData) {
    for (const s of weekSlots) {
      if (!DAYS.includes(s.day)) continue;
      if (!dbGrid[s.period_label]) dbGrid[s.period_label] = {};
      if (!dbGrid[s.period_label][s.day]) dbGrid[s.period_label][s.day] = [];
      dbGrid[s.period_label][s.day].push({
        subject: s.subject ?? "—",
        teacher: s.teacher_name ?? "",
        section: s.section_code ?? undefined,
      });
    }
  }

  const allPeriods = hasData
    ? [...new Set(weekSlots.map(s => s.period_label))].sort()
    : MOCK_PERIODS.map(p => p.period);

  return (
    <div className="sch-timetable">
      <div className="sch-timetable-head">
        <span className="sch-timetable-title">MASTER TIMETABLE · {title.toUpperCase()}</span>
        <div className="sch-timetable-controls">
          <span className="sch-timetable-hint">G5B · Sun → Thu · class-view default · switch to teacher view</span>
          <button className="sch-timetable-btn">Plan next week →</button>
        </div>
      </div>

      <div className="sch-grid-wrap">
        <table className="sch-grid">
          <thead>
            <tr>
              <th className="sch-grid-corner"></th>
              {DAYS.map((d, i) => (
                <th key={d} className="sch-grid-day">
                  <span className="sch-day-name">{d.toUpperCase()}</span>
                  <span className="sch-day-num">{i + 1}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(hasData ? allPeriods : MOCK_PERIODS.map(p => p.period)).map(period => (
              <tr key={period}>
                <td className="sch-grid-period-label">
                  <span className="sch-period-name">{period}</span>
                  {!hasData && (
                    <span className="sch-period-time">
                      {MOCK_PERIODS.find(p => p.period === period)?.start}
                    </span>
                  )}
                </td>
                {DAYS.map(day => {
                  if (hasData) {
                    const cells = dbGrid[period]?.[day] ?? [];
                    return (
                      <td key={day} className="sch-grid-cell">
                        {cells.slice(0, 2).map((c, i) => (
                          <div key={i} className="sch-cell-entry">
                            <div className="sch-cell-subject">{c.subject}</div>
                            {c.teacher && <div className="sch-cell-teacher">{c.teacher}</div>}
                          </div>
                        ))}
                        {cells.length > 2 && (
                          <div className="sch-cell-more">+{cells.length - 2} more</div>
                        )}
                        {cells.length === 0 && <div className="sch-cell-empty">—</div>}
                      </td>
                    );
                  }
                  const cell = MOCK_GRID[period]?.[day];
                  return (
                    <td key={day} className={`sch-grid-cell${cell?.flag === "sub" ? " sub" : cell?.flag === "break" ? " break" : ""}`}>
                      {cell ? (
                        <div className="sch-cell-entry">
                          <div className={`sch-cell-subject${cell.flag === "sub" ? " flagged" : ""}`}>{cell.subject}</div>
                          {cell.teacher && <div className="sch-cell-teacher">{cell.teacher}</div>}
                        </div>
                      ) : (
                        <div className="sch-cell-empty">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sch-plan-row">
        <div className="sch-plan-banner">
          <span className="sch-plan-avatar">M</span>
          <span className="sch-plan-text">
            Plan next week&rsquo;s timetable · bring up the constraint solver to draft week of Sun 7 June · 1 known absence (Mr. Khalid · conference) · auto-suggestions ready.
          </span>
          <button className="sch-footer-btn primary">Plan next week →</button>
        </div>
      </div>
    </div>
  );
}
