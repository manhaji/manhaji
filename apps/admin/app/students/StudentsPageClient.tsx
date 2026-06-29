"use client";

/**
 * Admin · Students tab.
 *
 * Phase 3.2: Added name search + section filter above the RiskRoster.
 * Both filters are live (client-side useMemo, AND semantics).
 * The filtered dataset is passed to RiskRoster and IncidentsTimeline;
 * DemographicBreakdown and other aggregate blocks that don't have per-student
 * props still show the full cohort (they are aggregate-only components).
 */

import { useState, useMemo } from "react";

import {
  MOCK_STUDENTS, MOCK_INCIDENTS, MOCK_ADMISSIONS, cohortHeat,
  type StudentStatus,
} from "@manhaj/lib/mock-students";
import { studentsCohortSummary } from "@manhaj/lib/summary";
import type { AdminStudentRow } from "@manhaj/lib/queries/students";

import { AiBriefingHeader } from "@manhaj/ui";
import { BreadcrumbLensBar, type Lens } from "@manhaj/ui";
import { FilterChipRow, type Chip } from "@manhaj/ui";

import StudentSearchFilter   from "./components/StudentSearchFilter";
import QuickSearch            from "./components/QuickSearch";
import CohortHeatmap          from "./components/CohortHeatmap";
import RiskRoster             from "./components/RiskRoster";
import IncidentsTimeline      from "./components/IncidentsTimeline";
import AdmissionsInbox        from "./components/AdmissionsInbox";
import DemographicBreakdown   from "./components/DemographicBreakdown";
import ReEnrollmentFunnel     from "./components/ReEnrollmentFunnel";
import InterventionLog        from "./components/InterventionLog";
import TeacherFeedback        from "./components/TeacherFeedback";
import PeerGroupComparison    from "./components/PeerGroupComparison";
import BulkParentComms        from "./components/BulkParentComms";

export default function StudentsPageClient({ dbStudents }: { dbStudents: AdminStudentRow[] }) {
  // Use DB students if available, fall back to mock for demo
  const students   = dbStudents.length > 0
    ? dbStudents.map(s => ({
        id: s.id,
        full_name: s.full_name_en,
        section_code: s.section_code ?? "—",
        grade_band: (s.grade_level?.startsWith("1") ? "HS" : "MS") as "HS" | "MS",
        status: (s.risk_flags.some(f => f.severity === "high") ? "support"
          : s.risk_flags.some(f => f.severity === "medium") ? "watch"
          : "good") as StudentStatus,
        rubric: { analytical: 0, creative: 0, oral: 0, written: 0, participation: 0, homework: 0 },
        rubric_avg: 0,
        attendance: 0,
        risk_score: 0,
        flags: s.risk_flags.map(f => f.category),
      }))
    : MOCK_STUDENTS;
  const incidents  = MOCK_INCIDENTS;
  const admissions = MOCK_ADMISSIONS;
  const summary    = studentsCohortSummary(students, incidents, admissions);
  const cohort     = cohortHeat(students);

  const [lens, setLens] = useState<Lens>("principal");
  const [active, setActive] = useState<string | null>(null);

  // Search + section filter state (Phase 3.2)
  const [searchValue, setSearchValue]   = useState("");
  const [sectionValue, setSectionValue] = useState("");

  // Derive unique section codes from enrolled students (sorted)
  const sectionOptions = useMemo(() => {
    const codes = new Set(
      students
        .filter(s => s.status !== "admission-pending" && s.section_code !== "—")
        .map(s => s.section_code)
    );
    return [...codes].sort((a, b) => a.localeCompare(b));
  }, [students]);

  // Enrolled base set
  const enrolled = students.filter(s => s.status !== "admission-pending");

  // Apply name search + section filter (AND semantics)
  const filteredStudents = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return enrolled.filter(s => {
      const matchesName    = q === "" || s.full_name.toLowerCase().includes(q);
      const matchesSection = sectionValue === "" || s.section_code === sectionValue;
      return matchesName && matchesSection;
    });
  }, [enrolled, searchValue, sectionValue]);

  // Filter incidents to match filtered students
  const filteredIncidents = useMemo(() => {
    if (searchValue === "" && sectionValue === "") return incidents;
    const ids = new Set(filteredStudents.map(s => s.id));
    return incidents.filter(i => ids.has(i.student_id));
  }, [filteredStudents, incidents, searchValue, sectionValue]);

  const total       = enrolled.length;
  const rubricAvg   = (enrolled.reduce((s, x) => s + x.rubric_avg, 0) / total).toFixed(1);
  const renewing    = enrolled.filter(s => s.status === "renewal-pending").length;
  const attAvg      = (enrolled.reduce((s, x) => s + x.attendance, 0) / total).toFixed(1);

  const chips: Chip[] = [
    { key: "flagged",   label: `Flagged · ${enrolled.filter(s => s.status === "support" || s.status === "watch").length}`, tone: "warn",    active: active === "flagged" },
    { key: "renewal",   label: `Renewal pending · ${renewing}`,                                                              tone: "bad",     active: active === "renewal" },
    { key: "admission", label: `Admissions · ${admissions.filter(a => a.status === "review").length}`,                       tone: "info",    active: active === "admission" },
    { key: "honor",     label: `Honor roll · ${enrolled.filter(s => s.status === "honor").length}`,                          tone: "good",    active: active === "honor" },
    { key: "chronic",   label: `Chronic absentee · ${enrolled.filter(s => s.flags.includes("chronic-absentee")).length}`,    tone: "neutral", active: active === "chronic" },
    { key: "fee",       label: `Fee overdue · 0`,                                                                            tone: "neutral", active: active === "fee" },
    { key: "new",       label: `New this term · 0`,                                                                          tone: "neutral", active: active === "new" },
    { key: "eal",       label: `EAL · ${enrolled.filter(s => s.flags.includes("eal")).length}`,                              tone: "neutral", active: active === "eal" },
    { key: "ieap",      label: `IEP · ${enrolled.filter(s => s.flags.includes("ieap")).length}`,                             tone: "neutral", active: active === "ieap" },
  ];

  const isFiltered = searchValue !== "" || sectionValue !== "";

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

      <AiBriefingHeader summary={summary} />

      <div className="stu-stat-row">
        <div className="stu-stat-card"><div className="stu-stat-l">Enrolled</div><div className="stu-stat-v">{total}</div><div className="stu-stat-d">across {new Set(enrolled.map(s => s.section_code)).size} sections</div></div>
        <div className="stu-stat-card"><div className="stu-stat-l">Rubric avg</div><div className="stu-stat-v">{rubricAvg}</div><div className="stu-stat-d">composite</div></div>
        <div className="stu-stat-card"><div className="stu-stat-l">Renewal rate</div><div className="stu-stat-v">{Math.round(100 * (1 - renewing / total))}<span className="stu-stat-suffix">%</span></div><div className="stu-stat-d">{renewing} pending</div></div>
        <div className="stu-stat-card"><div className="stu-stat-l">Avg attendance</div><div className="stu-stat-v">{attAvg}<span className="stu-stat-suffix">%</span></div><div className="stu-stat-d">{enrolled.filter(s => s.flags.includes("chronic-absentee")).length} chronic</div></div>
      </div>

      <FilterChipRow chips={chips} onToggle={k => setActive(prev => prev === k ? null : k)} />

      {/* Name search + section filter (Phase 3.2) */}
      <StudentSearchFilter
        searchValue={searchValue}
        sectionValue={sectionValue}
        onSearchChange={setSearchValue}
        onSectionChange={setSectionValue}
        sections={sectionOptions}
      />

      <QuickSearch />
      <CohortHeatmap rows={cohort} />
      <DemographicBreakdown />
      <ReEnrollmentFunnel />

      {/* RiskRoster respects the live filter */}
      <RiskRoster
        students={filteredStudents}
        emptyMessage="No students match the current filter."
      />

      {/* IncidentsTimeline scoped to filtered students when a filter is active */}
      <IncidentsTimeline incidents={isFiltered ? filteredIncidents : incidents} />

      <InterventionLog />
      <TeacherFeedback />
      <PeerGroupComparison />
      <AdmissionsInbox rows={admissions} />
      <BulkParentComms />
    </div>
  );
}
