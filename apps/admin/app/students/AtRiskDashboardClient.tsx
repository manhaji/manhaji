"use client";

import { useState, useMemo } from "react";
import RiskStudentCard from "./components/RiskStudentCard";

type RiskFlag = {
  id: string;
  severity: string;
  category: string;
  reason: string;
  status: string;
  created_at: string;
  owner_id: string | null;
};

type FlaggedStudent = {
  id: string;
  full_name_en: string;
  section_code: string | null;
  grade_level: string | null;
  risk_flags: RiskFlag[];
};

type Props = {
  flaggedStudents: FlaggedStudent[];
  totalStudents: number;
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

const SEVERITY_LABELS: Record<string, { label: string; sub: string; cls: string }> = {
  critical: { label: "CRITICAL RISK", sub: "Immediate action required", cls: "ars-sev-critical" },
  high:     { label: "HIGH RISK",     sub: "Act this week",             cls: "ars-sev-high" },
  medium:   { label: "MEDIUM RISK",   sub: "Monitor and message",       cls: "ars-sev-medium" },
  low:      { label: "LOW / INFORMATIONAL", sub: "Keep an eye on",      cls: "ars-sev-low" },
};

const FILTER_CHIPS = ["All", "High", "Medium", "Low", "Financial", "Academic", "Engagement"];

const MOCK_STUDENTS: FlaggedStudent[] = [
  {
    id: "m1", full_name_en: "Yousef Al-Rashidi", section_code: "10A", grade_level: "Grade 10",
    risk_flags: [{ id: "f1", severity: "high", category: "Academic", reason: "Failing 3 core subjects since March. Attendance has dropped to 61% this term. Parent contact unanswered for 3 weeks.", status: "open", created_at: new Date(Date.now() - 8 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m2", full_name_en: "Nour Al-Masri", section_code: "9B", grade_level: "Grade 9",
    risk_flags: [{ id: "f2", severity: "high", category: "Financial", reason: "Fee payment overdue by 60 days. Family has not responded to billing notices. Risk of withdrawal if unresolved.", status: "open", created_at: new Date(Date.now() - 15 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m3", full_name_en: "Layla Hassan", section_code: "8C", grade_level: "Grade 8",
    risk_flags: [{ id: "f3", severity: "medium", category: "Engagement", reason: "Three consecutive assignment skips. Teacher flagged disengaged in class. No prior incidents.", status: "open", created_at: new Date(Date.now() - 22 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m4", full_name_en: "Omar Khalid", section_code: "11A", grade_level: "Grade 11",
    risk_flags: [{ id: "f4", severity: "medium", category: "Academic", reason: "Mid-term grade dropped from B to D in Mathematics and Physics. Tutoring offered but not taken up.", status: "open", created_at: new Date(Date.now() - 5 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m5", full_name_en: "Sara Al-Farsi", section_code: "7A", grade_level: "Grade 7",
    risk_flags: [{ id: "f5", severity: "medium", category: "Engagement", reason: "Parent requested transfer inquiry last week. Student seems withdrawn. Counsellor check recommended.", status: "open", created_at: new Date(Date.now() - 3 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m6", full_name_en: "Ahmed Al-Balushi", section_code: "12B", grade_level: "Grade 12",
    risk_flags: [{ id: "f6", severity: "low", category: "Academic", reason: "Slight dip in participation score. Otherwise performing well. Flag for Term 3 check-in.", status: "open", created_at: new Date(Date.now() - 30 * 86400000).toISOString(), owner_id: null }],
  },
  {
    id: "m7", full_name_en: "Fatima Qasim", section_code: "6C", grade_level: "Grade 6",
    risk_flags: [{ id: "f7", severity: "low", category: "Engagement", reason: "Parent flagged concern about social dynamics. No academic issues. Monitor socially.", status: "open", created_at: new Date(Date.now() - 12 * 86400000).toISOString(), owner_id: null }],
  },
];

function topSeverity(flags: RiskFlag[]): string {
  for (const sev of SEVERITY_ORDER) {
    if (flags.some(f => f.severity === sev)) return sev;
  }
  return "low";
}

export default function AtRiskDashboardClient({ flaggedStudents, totalStudents }: Props) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");

  const students = flaggedStudents.length > 0 ? flaggedStudents : MOCK_STUDENTS;

  const countBySeverity = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    students.forEach(s => {
      const sev = topSeverity(s.risk_flags);
      counts[sev] = (counts[sev] ?? 0) + 1;
    });
    return counts;
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = !search ||
        s.full_name_en.toLowerCase().includes(search.toLowerCase()) ||
        (s.section_code ?? "").toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === "All") return true;
      const fLower = activeFilter.toLowerCase();
      if (["high", "medium", "low"].includes(fLower)) {
        return s.risk_flags.some(f => f.severity === fLower || (fLower === "high" && f.severity === "critical"));
      }
      return s.risk_flags.some(f => f.category.toLowerCase() === fLower);
    });
  }, [students, activeFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, FlaggedStudent[]>();
    SEVERITY_ORDER.forEach(sev => map.set(sev, []));
    filtered.forEach(s => {
      const sev = topSeverity(s.risk_flags);
      map.get(sev)!.push(s);
    });
    return map;
  }, [filtered]);

  return (
    <div className="ars-page">
      {/* Header */}
      <div className="ars-header">
        <div>
          <h1 className="ars-title">At-Risk · Retention Dashboard</h1>
          <p className="ars-subtitle">Live · {students.length} students flagged this term</p>
        </div>
        <button className="ars-export-btn">Export list ↓</button>
      </div>

      {/* KPI strip */}
      <div className="ars-kpi-strip">
        <div className="ars-kpi-card">
          <div className="ars-kpi-val">{students.length}</div>
          <div className="ars-kpi-label">Total Flagged</div>
          <div className="ars-kpi-sub">of {totalStudents || "—"} enrolled</div>
        </div>
        <div className="ars-kpi-card critical">
          <div className="ars-kpi-val">{(countBySeverity.critical ?? 0) + (countBySeverity.high ?? 0)}</div>
          <div className="ars-kpi-label">High / Critical</div>
          <div className="ars-kpi-sub">Act this week</div>
        </div>
        <div className="ars-kpi-card medium">
          <div className="ars-kpi-val">{countBySeverity.medium ?? 0}</div>
          <div className="ars-kpi-label">Medium Risk</div>
          <div className="ars-kpi-sub">Monitor and message</div>
        </div>
        <div className="ars-kpi-card low">
          <div className="ars-kpi-val">{countBySeverity.low ?? 0}</div>
          <div className="ars-kpi-label">Low / Info</div>
          <div className="ars-kpi-sub">Keep an eye on</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="ars-filter-bar">
        <div className="ars-chips">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip}
              className={`ars-chip${activeFilter === chip ? " active" : ""}`}
              onClick={() => setActiveFilter(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <input
          className="ars-search"
          placeholder="Search student or section…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grouped sections */}
      {SEVERITY_ORDER.map(sev => {
        const group = grouped.get(sev) ?? [];
        if (group.length === 0) return null;
        const meta = SEVERITY_LABELS[sev];
        return (
          <div key={sev} className="ars-section">
            <div className="ars-section-head">
              <span className={`ars-sev-badge ${meta.cls}`}>{meta.label}</span>
              <span className="ars-section-sub">{meta.sub}</span>
              <span className="ars-section-count">{group.length} student{group.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="ars-cards">
              {group.map(s => (
                <RiskStudentCard key={s.id} student={s} />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="ars-empty">No students match the current filter.</div>
      )}
    </div>
  );
}
