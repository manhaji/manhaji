"use client";

import { useState } from "react";

import {
  ATT_DAILY, ATT_EVENTS, ATT_DOW, ATT_PERIODS, ATT_CAUSES,
  ATT_SUBJECTS, ATT_BENCHMARK, ATT_CAL_OMAR, ATT_LESSONS,
  ATT_DRAFT_OMAR, ATT_ROLL_10A,
} from "@manhaj/lib/mock-attendance";
import type { SectionWeekRow, ChronicRow, DailyPoint } from "@manhaj/lib/mock-attendance";
import { attendanceCohortSummary } from "@manhaj/lib/summary";
import type { DailyAttendanceStat, SectionAttendanceStat, ChronicAbsenteeRow } from "@manhaj/lib/queries/attendance";

import { AiBriefingHeader } from "@manhaj/ui";
import { BreadcrumbLensBar, type Lens } from "@manhaj/ui";
import { FilterChipRow, type Chip } from "@manhaj/ui";
import { TrendChart } from "@manhaj/ui";

import DayOfWeekHeatmap        from "./components/DayOfWeekHeatmap";
import PeriodBars              from "./components/PeriodBars";
import AiCausesCards           from "./components/AiCausesCards";
import SectionHeatStrip        from "./components/SectionHeatStrip";
import SubjectCorrelation      from "./components/SubjectCorrelation";
import ChronicAbsenteesTable   from "./components/ChronicAbsenteesTable";
import BenchmarkBars           from "./components/BenchmarkBars";
import PerStudentCalendarHeat  from "./components/PerStudentCalendarHeat";
import LessonsMissedList       from "./components/LessonsMissedList";
import ReEngagementDraft       from "./components/ReEngagementDraft";
import TakeAttendanceUI        from "./components/TakeAttendanceUI";

type Props = {
  dailyTrend: DailyAttendanceStat[];
  sectionStats: SectionAttendanceStat[];
  chronicAbsentees: ChronicAbsenteeRow[];
};

function mapSectionRows(stats: SectionAttendanceStat[]): SectionWeekRow[] {
  return stats.map(s => {
    const tone = s.week_pct >= 95 ? "good" : s.week_pct >= 85 ? "watch" : "bad";
    return {
      section_code: s.section_code,
      week_pct: s.week_pct,
      days: [tone, tone, tone, tone, tone] as SectionWeekRow["days"],
    };
  });
}

function mapChronicRows(rows: ChronicAbsenteeRow[]): ChronicRow[] {
  return rows.map(r => ({
    student_id:   r.student_id,
    student_name: r.name,
    section_code: r.section_code,
    days_missed:  r.absences,
    pattern:      r.absences >= 20 ? "persistent" : "irregular",
    cause:        "unknown",
    status:       (r.absences >= 20 ? "support" : r.absences >= 15 ? "watch" : "contact") as ChronicRow["status"],
  }));
}

export default function AttendancePageClient({ dailyTrend, sectionStats, chronicAbsentees }: Props) {
  const hasRealData = dailyTrend.length > 0;

  // KPI computations from real data
  const last5 = dailyTrend.slice(-5);
  const weekPct = last5.length > 0
    ? Math.round(last5.reduce((s, d) => s + d.pct, 0) / last5.length * 10) / 10
    : 0;
  const chronicCount = chronicAbsentees.length;

  // Build KPI object for summary + chips (fall back to mock if no real data)
  const attKpis = hasRealData
    ? { this_week_pct: weekPct, chronic_count: chronicCount, late_today_count: 0, sub_coverage: 0 }
    : { this_week_pct: weekPct || 94.2, chronic_count: chronicCount, late_today_count: 0, sub_coverage: 0 };

  // Map DB data to component-expected shapes
  const trendPoints: DailyPoint[] = hasRealData ? dailyTrend : ATT_DAILY;
  const sectionRows: SectionWeekRow[] = sectionStats.length > 0 ? mapSectionRows(sectionStats) : [];
  const chronicRows: ChronicRow[] = chronicAbsentees.length > 0 ? mapChronicRows(chronicAbsentees) : [];

  const summary = attendanceCohortSummary(ATT_DAILY, ATT_CAUSES, sectionRows.length > 0 ? sectionRows : [], chronicRows, attKpis);

  const [lens, setLens] = useState<Lens>("principal");
  const [active, setActive] = useState<string | null>(null);

  const chips: Chip[] = [
    { key: "today",     label: "Today",                                              tone: "neutral", active: active === "today" },
    { key: "week",      label: "This week",                                          tone: "neutral", active: active === "week"  },
    { key: "month",     label: "This month",                                         tone: "neutral", active: active === "month" },
    { key: "chronic",   label: `Chronic · ${attKpis.chronic_count}`,                 tone: "warn",    active: active === "chronic" },
    { key: "late",      label: `Late · ${attKpis.late_today_count}`,                 tone: "warn",    active: active === "late" },
    { key: "unexcused", label: "Unexcused · 7",                                      tone: "bad",     active: active === "unexcused" },
    { key: "medical",   label: "Medical · 12",                                       tone: "info",    active: active === "medical" },
    { key: "religious", label: "Religious / cultural · 3",                           tone: "neutral", active: active === "religious" },
    { key: "transport", label: "Transport · 2",                                      tone: "neutral", active: active === "transport" },
  ];

  return (
    <div className={`container att-page lens-${lens}`}>
      <BreadcrumbLensBar
        steps={[{ label: "School" }, { label: "HS", active: true }]}
        lens={lens}
        onLensChange={setLens}
      />

      <AiBriefingHeader summary={summary} />

      <div className="att-kpi-row">
        <div className="att-kpi-card"><div className="att-kpi-l">This week</div><div className="att-kpi-v">{attKpis.this_week_pct.toFixed(1)}<span className="att-kpi-suffix">%</span></div><div className="att-kpi-d">— flat vs last</div></div>
        <div className="att-kpi-card"><div className="att-kpi-l">Chronic absentees</div><div className="att-kpi-v att-kpi-bad">{attKpis.chronic_count}</div><div className="att-kpi-d">▲ +2 since April</div></div>
        <div className="att-kpi-card"><div className="att-kpi-l">Late arrivals today</div><div className="att-kpi-v att-kpi-warn">{attKpis.late_today_count}</div><div className="att-kpi-d">across 8 sections</div></div>
        <div className="att-kpi-card"><div className="att-kpi-l">Sub coverage needed</div><div className="att-kpi-v att-kpi-warn">{attKpis.sub_coverage}</div><div className="att-kpi-d">today + tomorrow</div></div>
      </div>

      <FilterChipRow chips={chips} onToggle={k => setActive(prev => prev === k ? null : k)} />

      <div className="att-block-cohort-only">
        <TrendChart points={trendPoints} markers={ATT_EVENTS} target={95} title="Attendance trend · last 30 school days" />
      </div>
      <DayOfWeekHeatmap rows={ATT_DOW} />
      <PeriodBars rows={ATT_PERIODS} />
      <AiCausesCards rows={ATT_CAUSES} />
      <SectionHeatStrip rows={sectionRows.length > 0 ? sectionRows : []} />
      <SubjectCorrelation rows={ATT_SUBJECTS} />
      <ChronicAbsenteesTable rows={chronicRows.length > 0 ? chronicRows : []} />
      <BenchmarkBars rows={ATT_BENCHMARK} />

      <PerStudentCalendarHeat weeks={ATT_CAL_OMAR} studentName="Omar Saadi" sectionCode="11 AS" />
      <LessonsMissedList rows={ATT_LESSONS} studentName="Omar" />
      <ReEngagementDraft draft={ATT_DRAFT_OMAR} />

      <TakeAttendanceUI rows={ATT_ROLL_10A} sectionCode="10A" />
    </div>
  );
}
