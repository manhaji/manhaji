"use client";

import { useState } from "react";
import type { AbsenceRow, WeekSlot } from "@manhaj/lib/queries/schedule";
import type { CoverIndexEntry, TeacherCoverPlan } from "@manhaj/lib/queries/cover";
import TodayView from "./components/TodayView";
import MasterTimetableView from "./components/MasterTimetableView";
import CoverPlannerView from "./components/CoverPlannerView";

type Props = {
  absences: AbsenceRow[];
  weekSlots: WeekSlot[];
  coverIndex: CoverIndexEntry[];
  featuredCover: TeacherCoverPlan | null;
};

const TABS = ["Today", "Cover planner", "This week", "Master timetable", "Cover history"] as const;
type Tab = typeof TABS[number];

const TAB_TITLE: Record<Tab, string> = {
  "Today":            "Today's schedule",
  "Cover planner":    "Self-healing cover planner",
  "This week":        "This week's schedule",
  "Master timetable": "Master schedule",
  "Cover history":    "Cover history",
};

const TODAY = new Date().toLocaleDateString("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

export default function SchedulerClient({ absences, weekSlots, coverIndex, featuredCover }: Props) {
  const [tab, setTab] = useState<Tab>("Today");

  return (
    <div className="sch-page">
      <div className="sch-header">
        <div>
          <h1 className="sch-title">{TAB_TITLE[tab]}</h1>
          <p className="sch-subtitle">{TODAY} · check coverage, find substitutes, see the full school day.</p>
        </div>
      </div>

      <div className="sch-tabs-row">
        {TABS.map(t => (
          <button
            key={t}
            className={`sch-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Today" && <TodayView absences={absences} />}
      {tab === "Cover planner" && (
        featuredCover
          ? <CoverPlannerView index={coverIndex} featured={featuredCover} />
          : <div className="sch-cover-loading">Cover plans are unavailable.</div>
      )}
      {tab === "This week" && <MasterTimetableView weekSlots={weekSlots} title="This Week" />}
      {tab === "Master timetable" && <MasterTimetableView weekSlots={weekSlots} title="Master Timetable" />}
      {tab === "Cover history" && <CoverHistory />}
    </div>
  );
}

function CoverHistory() {
  const MOCK = [
    { date: "2 Jul 2026", teacher: "Ms. Nadia Salim", sub: "Mr. Khalid", periods: 3, reason: "Sick", status: "Covered" },
    { date: "28 Jun 2026", teacher: "Mr. Hassan Ali", sub: "Ms. Reem",   periods: 2, reason: "PD",   status: "Covered" },
    { date: "22 Jun 2026", teacher: "Ms. Leyla Omar", sub: "Ms. Fatima", periods: 4, reason: "Sick", status: "Covered" },
    { date: "18 Jun 2026", teacher: "Mr. Tariq",      sub: "Ms. Fatima", periods: 4, reason: "Sick", status: "Covered" },
    { date: "10 Jun 2026", teacher: "Ms. Sara Q.",    sub: "—",          periods: 1, reason: "Personal", status: "Gap" },
  ];
  return (
    <div className="sch-history">
      <table className="sch-hist-tbl">
        <thead>
          <tr>
            <th>Date</th><th>Absent teacher</th><th>Substitute</th>
            <th>Periods</th><th>Reason</th><th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {MOCK.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td className="sch-hist-name">{r.teacher}</td>
              <td>{r.sub}</td>
              <td>{r.periods}</td>
              <td>{r.reason}</td>
              <td>
                <span className={`sch-hist-chip ${r.status === "Gap" ? "gap" : "covered"}`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
