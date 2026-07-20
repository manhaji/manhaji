"use client";

import { Fragment, useState } from "react";
import type { PeriodSlot } from "@manhaj/lib/queries/timetable";
import type { CoveringSlot } from "@manhaj/lib/queries/substitute";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

type Day    = typeof DAYS[number];
type Period = typeof PERIODS[number];

interface Cell {
  subject: string;
  section: string;
  room:    string;
  covering?: string;   // set when this slot is covered as a substitute ("covering for X")
}

const SWART_WEEK: Partial<Record<Period, Partial<Record<Day, Cell | undefined>>>> = {
  P1: { Tue: { subject: "History", section: "10A", room: "R210" }, Thu: { subject: "History", section: "10A", room: "R210" } },
  P2: { Mon: { subject: "Geography", section: "10A", room: "R210" }, Wed: { subject: "History", section: "10A", room: "R210", covering: "Mr Saab" }, Thu: { subject: "History", section: "10A", room: "R210" } },
  P3: { Tue: { subject: "History", section: "11 AS", room: "R210" }, Fri: { subject: "History", section: "12 A2", room: "R210" } },
  P4: { Fri: { subject: "Geography", section: "11 AS", room: "R210" } },
  P5: { Mon: { subject: "History", section: "12 A2", room: "R210" }, Wed: { subject: "MUN club", section: "10A", room: "R210" } },
  P6: { Thu: { subject: "Geography", section: "12 A2", room: "R210" }, Fri: { subject: "History", section: "11 AS", room: "R210" } },
};

const SWART_DEMO_TABS = ["Ms Swart", "Mr Saab", "Mr Salim"];

function normDay(d: string): Day {
  const map: Record<string, Day> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri",
  };
  return map[d.toLowerCase()] ?? (d as Day);
}

export type TeacherWeekTab = {
  id: string;
  name: string;
  slots: PeriodSlot[];
};

type Props = {
  /** Same-department (substitutable) teachers — logged-in teacher first. */
  tabs?: TeacherWeekTab[];
  /** Department label shown in the subtitle. */
  dept?: string;
  /** Slots the logged-in teacher covers as an accepted substitute. */
  covering?: CoveringSlot[];
};

type Grid = Partial<Record<string, Partial<Record<Day, Cell>>>>;

function buildGrid(slots: PeriodSlot[], covering: CoveringSlot[]): { grid: Grid; periods: string[]; total: number } {
  const grid: Grid = {};
  const periodSet = new Set<string>();
  const addCell = (period: string, day: Day, cell: Cell) => {
    periodSet.add(period);
    if (!grid[period]) grid[period] = {};
    grid[period]![day] = cell;
  };
  for (const s of slots) {
    if (!s.is_teaching) continue;
    addCell(s.period, normDay(s.day), {
      subject: s.subject ?? "—",
      section: s.teacher ?? "",   // teacher field holds section label in getTeacherTimetable
      room:    s.room   ?? "—",
    });
  }
  for (const c of covering) {
    addCell(c.period, normDay(c.day), {
      subject: c.subjectName ?? "—",
      section: c.sectionLabel,
      room:    c.roomCode ?? "—",
      covering: c.coveringFor,
    });
  }
  return {
    grid,
    periods: [...periodSet].sort(),
    total: slots.filter(s => s.is_teaching).length + covering.length,
  };
}

export default function TeacherMyWeek({ tabs, dept, covering = [] }: Props) {
  const hasLive = !!tabs && tabs.length > 0 && tabs.some(t => t.slots.length > 0);
  const [activeId, setActiveId] = useState<string | null>(hasLive ? tabs![0].id : null);

  let grid: Grid;
  let displayPeriods: readonly string[];
  let subtitle: string;
  let title: string;
  let activeCovering: CoveringSlot[] = [];

  if (hasLive) {
    const active = tabs!.find(t => t.id === activeId) ?? tabs![0];
    const isSelf = active.id === tabs![0].id;
    activeCovering = isSelf ? covering : [];
    const built = buildGrid(active.slots, activeCovering);
    grid = built.grid;
    displayPeriods = built.periods;
    title = isSelf ? "My week" : `${active.name} · week`;
    subtitle = `${built.total} periods this week${dept ? ` · ${dept} department` : ""}`;
  } else {
    grid = SWART_WEEK;
    displayPeriods = PERIODS;
    const total = Object.values(SWART_WEEK).reduce((acc, row) =>
      acc + Object.values(row ?? {}).filter(Boolean).length, 0);
    title = "Ms Swart · my week";
    subtitle = `History · ${total} periods this week · teacher lens`;
    activeCovering = [{ slotId: "demo", day: "Wed", period: "P2", sectionLabel: "10A", subjectName: "History", roomCode: "R210", coveringFor: "Mr Saab" }];
  }

  const activeTabId = hasLive ? (tabs!.find(t => t.id === activeId)?.id ?? tabs![0].id) : null;

  return (
    <section className="tmw-card" aria-label="My week">
      <header className="tmw-head">
        <div>
          <h3>{title}</h3>
          <p className="tmw-sub">{subtitle}</p>
        </div>
        {hasLive ? (
          <div className="tmw-toggle" role="tablist" aria-label="Substitutable colleagues — same department">
            {tabs!.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === activeTabId}
                className={`tmw-toggle-pill tmw-toggle-btn${t.id === activeTabId ? " active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="tmw-toggle">
            {SWART_DEMO_TABS.map((n, i) => (
              <span key={n} className={`tmw-toggle-pill${i === 0 ? " active" : ""}`}>{n}</span>
            ))}
          </div>
        )}
      </header>

      {activeCovering.length > 0 && (
        <div className="tmw-legend" aria-label="Substitute cover legend">
          <span className="tmw-legend-swatch" aria-hidden="true" />
          <span className="tmw-legend-text">
            Covering for {[...new Set(activeCovering.map(c => c.coveringFor))].join(", ")} — accepted substitution
          </span>
        </div>
      )}

      <div className="tmw-grid" role="grid" aria-label="Weekly timetable">
        <div className="tmw-corner" aria-hidden="true" />
        {DAYS.map(d => (
          <div key={d} className="tmw-col-head" role="columnheader">{d}</div>
        ))}

        {displayPeriods.map(p => (
          <Fragment key={p}>
            <div className="tmw-row-head" role="rowheader">{p}</div>
            {DAYS.map(d => {
              const cell = grid[p]?.[d];
              return (
                <div
                  key={`${p}-${d}`}
                  className={`tmw-cell ${cell ? "tmw-cell-filled" : "tmw-cell-free"}${cell?.covering ? " tmw-cell-covering" : ""}`}
                  role="gridcell"
                  aria-label={cell
                    ? `${cell.subject} ${cell.section} ${cell.room}${cell.covering ? ` — covering for ${cell.covering}` : ""}`
                    : "free"}
                >
                  {cell ? (
                    <>
                      <span className="tmw-subj">{cell.subject}</span>
                      <span className="tmw-meta">{cell.section} · {cell.room}</span>
                      {cell.covering && <span className="tmw-covering-chip">covering · {cell.covering}</span>}
                    </>
                  ) : (
                    <span className="tmw-free">—</span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
