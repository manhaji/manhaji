"use client";

import { useState } from "react";

import {
  MOCK_TEACHERS,
  MOCK_DEPARTMENTS,
  MOCK_ONBOARDING_PIPELINE,
} from "@manhaj/lib/mock-faculty";
import { facultyAdminSummary } from "@manhaj/lib/summary";
import type { TeacherWithLoad } from "@manhaj/lib/queries/teachers";
import type { TeacherDayLoad } from "@manhaj/lib/queries/timetable";

import { AiBriefingHeader } from "@manhaj/ui";
import { BreadcrumbLensBar, type Lens } from "@manhaj/ui";
import { FilterChipRow, type Chip } from "@manhaj/ui";

import DepartmentBreakdown  from "./components/DepartmentBreakdown";
import FacultyRoster        from "./components/FacultyRoster";
import ContractsDashboard   from "./components/ContractsDashboard";
import OnboardingFunnel     from "./components/OnboardingFunnel";
import PerformanceComposite from "./components/PerformanceComposite";
import FacultyAskManhaj     from "./components/FacultyAskManhaj";
export default function FacultyPageClient({ teachers, loads }: { teachers: TeacherWithLoad[]; loads: TeacherDayLoad[] }) {
  const source = teachers.length > 0 ? teachers : null;

  const total = source ? source.length : MOCK_TEACHERS.length;
  const overCapacity = source
    ? source.filter(t => (t.weekly_period_assigned ?? 0) > (t.weekly_period_cap ?? 28)).length
    : MOCK_TEACHERS.filter(t => t.status === "over").length;
  const avgUtil = source
    ? Math.round(
        source.reduce((sum, t) => sum + ((t.weekly_period_assigned ?? 0) / (t.weekly_period_cap ?? 28)) * 100, 0) / (source.length || 1)
      )
    : 78;
  const vacancies = 0;

  const summary = facultyAdminSummary(MOCK_TEACHERS, MOCK_DEPARTMENTS, MOCK_ONBOARDING_PIPELINE);

  const [lens, setLens]   = useState<Lens>("principal");
  const [active, setActive] = useState<string | null>(null);

  const chips: Chip[] = [
    { key: "all",        label: "All departments",                          tone: "neutral", active: active === "all" },
    { key: "math",       label: "Mathematics",                              tone: "neutral", active: active === "math" },
    { key: "sciences",   label: "Sciences",                                 tone: "neutral", active: active === "sciences" },
    { key: "languages",  label: "Languages",                                tone: "neutral", active: active === "languages" },
    { key: "humanities", label: "Humanities",                               tone: "neutral", active: active === "humanities" },
    { key: "arts",       label: "Arts",                                     tone: "neutral", active: active === "arts" },
    { key: "pe",         label: "PE",                                       tone: "neutral", active: active === "pe" },
    { key: "primary",    label: "Primary",                                  tone: "neutral", active: active === "primary" },
    { key: "kg",         label: "KG",                                       tone: "neutral", active: active === "kg" },
    { key: "over",       label: `Over capacity · ${overCapacity}`,          tone: "bad",     active: active === "over" },
    { key: "contracts",  label: `Contracts due · 0`,                        tone: "warn",    active: active === "contracts" },
  ];

  return (
    <div className="container">
      <BreadcrumbLensBar
        steps={[
          { label: "School" },
          { label: "All staff", active: true },
        ]}
        lens={lens}
        onLensChange={setLens}
      />

      <h1>Faculty</h1>
      <p className="sub">
        Teacher load · contracts · hiring pipeline · dept performance · AY 2025–26
      </p>

      <AiBriefingHeader summary={summary} />

      <div className="fac-kpi-row">
        <div className="fac-kpi-card">
          <div className="fac-kpi-l">Total teachers</div>
          <div className="fac-kpi-v">{total}</div>
          <div className="fac-kpi-d">across 9 departments</div>
        </div>
        <div className="fac-kpi-card">
          <div className="fac-kpi-l">Over capacity</div>
          <div className={`fac-kpi-v${overCapacity > 0 ? " fac-kpi-bad" : " fac-kpi-good"}`}>
            {overCapacity}
          </div>
          <div className="fac-kpi-d">
            {overCapacity > 0 ? "needs redistribution" : "all within cap"}
          </div>
        </div>
        <div className="fac-kpi-card">
          <div className="fac-kpi-l">Vacancies</div>
          <div className={`fac-kpi-v${vacancies > 0 ? " fac-kpi-warn" : ""}`}>
            {vacancies}
          </div>
          <div className="fac-kpi-d">open roles this cycle</div>
        </div>
        <div className="fac-kpi-card">
          <div className="fac-kpi-l">Avg load utilisation</div>
          <div className={`fac-kpi-v${avgUtil >= 85 ? " fac-kpi-good" : avgUtil < 70 ? " fac-kpi-warn" : ""}`}>
            {avgUtil}%
          </div>
          <div className="fac-kpi-d">of 28-period cap</div>
        </div>
      </div>

      <FilterChipRow chips={chips} onToggle={k => setActive(prev => prev === k ? null : k)} />

      <DepartmentBreakdown teachers={source ?? undefined} />
      <FacultyRoster teachers={source ?? undefined} />

      <ContractsDashboard />
      <OnboardingFunnel />
      <PerformanceComposite />
      <FacultyAskManhaj />
    </div>
  );
}
