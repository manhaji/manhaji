"use client";

import { useState } from "react";

import {
  MOCK_ACTIONS, MOCK_SLOTS, MOCK_TEACHER_LOADS, MOCK_CURRICULUM,
  scheduleKpis,
} from "@manhaj/lib/mock-schedule";
import { scheduleAdminSummary } from "@manhaj/lib/summary";

import { AiBriefingHeader } from "@manhaj/ui";
import { BreadcrumbLensBar, type Lens } from "@manhaj/ui";
import { FilterChipRow, type Chip } from "@manhaj/ui";

import TimetableGrid      from "./components/TimetableGrid";
import ActionQueue        from "./components/ActionQueue";
import TeacherLoadHeatmap from "./components/TeacherLoadHeatmap";
import RoomUtilization    from "./components/RoomUtilization";
import CurriculumCoverage from "./components/CurriculumCoverage";
import ChangeLog          from "./components/ChangeLog";
import TeacherMyWeek      from "./components/TeacherMyWeek";
import AskManhajCard      from "./components/AskManhajCard";

export default function SchedulePageClient() {
  const kpis    = scheduleKpis(MOCK_SLOTS, MOCK_ACTIONS, MOCK_TEACHER_LOADS, MOCK_CURRICULUM);
  const summary = scheduleAdminSummary(MOCK_ACTIONS, MOCK_TEACHER_LOADS, MOCK_CURRICULUM);

  const [lens, setLens]   = useState<Lens>("principal");
  const [active, setActive] = useState<string | null>(null);

  const gaps      = MOCK_ACTIONS.filter(a => a.kind === "gap").length;
  const conflicts = MOCK_ACTIONS.filter(a => a.kind === "conflict").length;

  const chips: Chip[] = [
    { key: "week",      label: "This week",               tone: "neutral", active: active === "week" },
    { key: "next",      label: "Next week",               tone: "neutral", active: active === "next" },
    { key: "unfilled",  label: `Unfilled · ${gaps}`,      tone: "warn",    active: active === "unfilled" },
    { key: "conflicts", label: `Conflicts · ${conflicts}`, tone: "bad",     active: active === "conflicts" },
    { key: "subs",      label: "Subs needed · 2",         tone: "warn",    active: active === "subs" },
    { key: "nlchange",  label: "Pending NL changes · 1",  tone: "info",    active: active === "nlchange" },
    { key: "lab",       label: "Lab schedule",            tone: "neutral", active: active === "lab" },
    { key: "gaps",      label: "Curriculum gaps",         tone: "neutral", active: active === "gaps" },
  ];

  return (
    <div className="container">
      <BreadcrumbLensBar
        steps={[
          { label: "School" },
          { label: "HS", active: true },
        ]}
        lens={lens}
        onLensChange={setLens}
      />

      <h1>Schedule</h1>
      <p className="sub">Section + teacher + room view of the weekly bell schedule · AY 2025–26</p>

      <AiBriefingHeader summary={summary} />

      <div className="sch-kpi-row">
        <div className="sch-kpi-card">
          <div className="sch-kpi-l">Periods this week</div>
          <div className="sch-kpi-v">230</div>
          <div className="sch-kpi-d">across 41 sections</div>
        </div>
        <div className="sch-kpi-card">
          <div className="sch-kpi-l">Unfilled periods</div>
          <div className={`sch-kpi-v${gaps > 0 ? " sch-kpi-warn" : ""}`}>{gaps}</div>
          <div className="sch-kpi-d">all in 10B / 11 AS</div>
        </div>
        <div className="sch-kpi-card">
          <div className="sch-kpi-l">Subs needed</div>
          <div className="sch-kpi-v sch-kpi-warn">2</div>
          <div className="sch-kpi-d">today + tomorrow</div>
        </div>
        <div className="sch-kpi-card">
          <div className="sch-kpi-l">Conflicts</div>
          <div className={`sch-kpi-v${conflicts > 0 ? " sch-kpi-bad" : ""}`}>{conflicts}</div>
          <div className="sch-kpi-d">Lab 2 · Wed P3</div>
        </div>
      </div>

      <FilterChipRow chips={chips} onToggle={k => setActive(prev => prev === k ? null : k)} />

      <AskManhajCard />
      <TimetableGrid />
      <ActionQueue />
      <TeacherLoadHeatmap />
      <RoomUtilization />
      <CurriculumCoverage />
      <ChangeLog />
      <TeacherMyWeek />
    </div>
  );
}
