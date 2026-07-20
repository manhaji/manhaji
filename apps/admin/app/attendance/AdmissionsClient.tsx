"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdmissionApplicant,
  ParentOption,
  ReEnrollStudent,
  RetentionSummary,
} from "@manhaj/lib/queries/admissions";
import {
  AVATAR_BG,
  LEAVER_REASONS,
  LEAVER_REASON_LABEL,
  MOCK_APPLICANTS,
  PIPELINE_STAGES,
  RISK_COLOR,
  STAGE_COLOR,
  STAGE_LABEL,
  daysInStage,
  initials,
  isDemoApplicant,
  retentionCallMailto,
  riskScore,
} from "./admissions-shared";
import RetentionSummaryModal, { type SummaryTarget } from "./RetentionSummaryModal";
import ConfirmLeaveModal, { type ConfirmLeaveTarget } from "./ConfirmLeaveModal";
import ApplicantModal from "./ApplicantModal";

type Props = {
  applicants: AdmissionApplicant[];
  roster: ReEnrollStudent[];
  parentOptions: ParentOption[];
};

// ── Demo fallbacks (standing rule: DB-first, demo when empty) ──────────────
const DEMO = {
  enrolled: 612,
  reEnrolledPct: 0.884,
  pending: 47,
  leaving: 18,
};

const MOCK_FAMILIES = [
  { id: "demo-f1", name: "Al Hamdan Family", grade: "G5", detail: "G5 · attendance slipping this term · 2 unanswered school comms", risk: "HIGH RISK",        color: "#C53030" },
  { id: "demo-f2", name: "Maya Al-Lawati",   grade: "G9", detail: "G9 · fees 90 days overdue · payment plan discussed in March",   risk: "FEES RISK",        color: "#C05621" },
  { id: "demo-f3", name: "Aisha Al-Balushi", grade: "G7", detail: "G7 · 3 years at the school · competitor open-day visit reported", risk: "COMPETITION RISK", color: "#975A16" },
  { id: "demo-f4", name: "Sara Al-Said",     grade: "G1", detail: "G1 · 7 years at the school · no negative signals",              risk: "LOW RISK",         color: "#276749" },
  { id: "demo-f5", name: "Omar Al-Habsi",    grade: "G6", detail: "G6 · father positive at PTO last week",                          risk: "LOW RISK",         color: "#2C5282" },
];

function demoSummaryFor(index: number, id: string, name: string, grade: string): RetentionSummary {
  const flavours: Array<Pick<RetentionSummary, "attendance" | "riskFlags" | "fees">> = [
    {
      attendance: { pct: 84, absences: 9, lates: 4, marks: 78 },
      riskFlags: [{ severity: "high", category: "attendance", reason: "Attendance dropped below 85% this term." }],
      fees: { invoices: 3, unpaid: 0, overdue: 0, owedAed: 0 },
    },
    {
      attendance: { pct: 93, absences: 3, lates: 2, marks: 80 },
      riskFlags: [{ severity: "medium", category: "financial", reason: "Term-2 invoice 90 days overdue." }],
      fees: { invoices: 3, unpaid: 1, overdue: 1, owedAed: 5400 },
    },
    {
      attendance: { pct: 96, absences: 2, lates: 1, marks: 81 },
      riskFlags: [{ severity: "medium", category: "retention", reason: "Family reported visiting a competitor open day." }],
      fees: { invoices: 3, unpaid: 0, overdue: 0, owedAed: 0 },
    },
  ];
  const f = flavours[index % flavours.length];
  return {
    student: { id, name, section_code: null, grade_level: grade, re_enrolled_on: null, final_enrollment_date: null, leaver_reason: null },
    parent: null,
    ...f,
  };
}

const MOCK_LEAVING = [
  { label: "Graduating",      count: 12, color: "#BEE3F8", note: "all G12 leavers · university destinations confirmed" },
  { label: "Relocating",      count: 4,  color: "#FEEBC8", note: "1 to KSA · 1 to Canada · 1 to Australia · 1 other" },
  { label: "Fees",            count: 2,  color: "#FED7D7", note: "both flagged in exit interview" },
  { label: "Dissatisfaction", count: 0,  color: "#EDF2F7", note: "" },
];

const MOCK_STAGE_SUB: Record<string, string> = {
  new: "91 this month",
  review: "first visit",
  interview: "in 18 days",
  offer: "4 expiring",
  accepted: "4 decisions pending",
};
const MOCK_STAGE_COUNT: Record<string, number> = { new: 142, review: 84, interview: 61, offer: 38, accepted: 31 };

const NEEDS_THIS_WEEK = [
  {
    icon: "🔴",
    title: "3 High-risk re-enrolment families",
    desc: "Sharif, Maya, Sara — living any of these today. After today 1990 SMS · 13:00.",
    actions: [{ label: "Open list", primary: true }],
  },
  {
    icon: "✉️",
    title: "42 routine re-enrolment reminders",
    desc: "Pre-fill by default nudges · G6B · G6B · their names, 12 days to deadline · friendly tone, first-name basis.",
    actions: [{ label: "Preview", primary: false }, { label: "Send all", primary: true }],
  },
  {
    icon: "🟡",
    title: "3 new inquiries unanswered > 48h",
    desc: "Industry benchmark is 24h. Faster response consistently with all 3 on the class founding top for the admissions trialling tool.",
    actions: [{ label: "Open list", primary: true }],
  },
  {
    icon: "📋",
    title: "11 assessments overdue (now)",
    desc: "Won't fall out of stage · no other negative signals · no other negative signals · you need item.",
    actions: [{ label: "Preview", primary: false }, { label: "Send", primary: true }],
  },
  {
    icon: "⏳",
    title: "5 offers awaiting decision (now)",
    desc: "Accepted but not enroled · 31 offer(s) sent · offers sent · offers won't lapse this week. Currently so fast as G3 (G).",
    actions: [{ label: "Preview", primary: false }, { label: "Send all", primary: true }],
  },
  {
    icon: "📊",
    title: "Plan replacement capacity",
    desc: "18 confirmed leavers this year · 22 new enrolments so far · class sizes all within cap. Currently so fast as G3 (G).",
    actions: [{ label: "Forward list", primary: true }],
  },
];

const PENDING_PREVIEW_COUNT = 6;

function exportCsv(rows: AdmissionApplicant[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Applicant", "Target grade", "Stage", "Days in stage", "Source", "Parent", "Parent email", "Applicant email", "Phone", "Notes", "Created"];
  const lines = rows.map(a => [
    a.full_name,
    a.target_grade,
    STAGE_LABEL[a.stage] ?? a.stage,
    daysInStage(a.created_at),
    a.source ?? "",
    a.parent_name ?? "",
    a.parent_email ?? "",
    a.email ?? "",
    a.phone_e164 ?? "",
    a.notes ?? "",
    a.created_at.slice(0, 10),
  ].map(esc).join(","));
  const blob = new Blob(["﻿" + [header.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdmissionsClient({ applicants, roster, parentOptions }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);
  const [summaryTarget, setSummaryTarget] = useState<SummaryTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmLeaveTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorApplicant, setEditorApplicant] = useState<AdmissionApplicant | null>(null);
  // Optimistic overlay so a confirmed leaver updates instantly while the route revalidates.
  const [localLeavers, setLocalLeavers] = useState<Record<string, { reason: string; comment: string }>>({});

  // ── Re-enrollment funnel from the real columns (migration 020) ───────────
  const effectiveRoster = useMemo<ReEnrollStudent[]>(
    () => roster.map(s => localLeavers[s.id]
      ? { ...s, final_enrollment_date: new Date().toISOString().slice(0, 10), leaver_reason: localLeavers[s.id].reason, leaver_comment: localLeavers[s.id].comment }
      : s),
    [roster, localLeavers],
  );

  const leavers    = useMemo(() => effectiveRoster.filter(s => s.final_enrollment_date), [effectiveRoster]);
  const reEnrolled = useMemo(() => effectiveRoster.filter(s => !s.final_enrollment_date && s.re_enrolled_on), [effectiveRoster]);
  const pending    = useMemo(
    () => effectiveRoster
      .filter(s => !s.final_enrollment_date && !s.re_enrolled_on)
      .sort((a, b) =>
        riskScore(b.risk_flags) - riskScore(a.risk_flags) ||
        b.risk_flags.length - a.risk_flags.length ||
        a.full_name_en.localeCompare(b.full_name_en)),
    [effectiveRoster],
  );
  const hasRoster = roster.length > 0;
  // Standing OR rule: while no family has any decision recorded, KPI numbers fall back to demo.
  const hasSignal = leavers.length > 0 || reEnrolled.length > 0;

  const enrolledNow = hasRoster ? effectiveRoster.filter(s => !s.final_enrollment_date).length : DEMO.enrolled;
  const kpiReEnrolled = hasSignal ? reEnrolled.length : Math.round(enrolledNow * DEMO.reEnrolledPct);
  const kpiPending    = hasSignal ? pending.length : DEMO.pending;
  const kpiLeaving    = hasSignal ? leavers.length : DEMO.leaving;
  const reEnrolledPctLabel = hasSignal && effectiveRoster.length > 0
    ? `${Math.round((reEnrolled.length / effectiveRoster.length) * 1000) / 10}% of current students`
    : "88.4% · same time last year — +12.6%";

  // Confirmed-leaving breakdown: real leaver_reason grouping OR demo bars.
  const leavingBars = useMemo(() => {
    if (leavers.length === 0) return MOCK_LEAVING;
    const counts = new Map<string, number>();
    leavers.forEach(s => {
      const key = LEAVER_REASON_LABEL[s.leaver_reason ?? ""] ?? "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const colors: Record<string, string> = { Graduating: "#BEE3F8", Relocating: "#FEEBC8", Fees: "#FED7D7", Dissatisfaction: "#FBB6CE", Other: "#EDF2F7" };
    return LEAVER_REASONS.map(r => ({
      label: r.label,
      count: counts.get(r.label) ?? 0,
      color: colors[r.label] ?? "#EDF2F7",
      note: "",
    }));
  }, [leavers]);
  const maxLeavingBar = Math.max(1, ...leavingBars.map(r => r.count));

  // ── Applicant pipeline (real rows OR demo while the table is empty) ──────
  const rows = applicants.length > 0 ? applicants : MOCK_APPLICANTS;
  const demoPipeline = applicants.length === 0;

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(a => { counts[a.stage] = (counts[a.stage] ?? 0) + 1; });
    return counts;
  }, [rows]);

  const filteredApplicants = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(a => {
      const matchSearch = !q ||
        a.full_name.toLowerCase().includes(q) ||
        (a.parent_name ?? "").toLowerCase().includes(q) ||
        (a.target_grade ?? "").toLowerCase().includes(q) ||
        (a.source ?? "").toLowerCase().includes(q);
      const matchStage = stageFilter === "All stages" || a.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [rows, search, stageFilter]);

  const expandedRows = expandedStage ? rows.filter(a => a.stage === expandedStage) : [];

  const visiblePending = showAllPending ? pending : pending.slice(0, PENDING_PREVIEW_COUNT);

  function openEditor(applicant: AdmissionApplicant | null) {
    setEditorApplicant(applicant);
    setEditorOpen(true);
  }

  function gradeLabelFor(s: ReEnrollStudent): string | null {
    return s.grade_level ?? s.section_code;
  }

  function pendingDetail(s: ReEnrollStudent): string {
    const bits = [
      [s.grade_level, s.section_code].filter(Boolean).join(" · ") || "no section",
      s.parent ? `parent: ${s.parent.full_name}` : "no parent linked",
    ];
    if (s.risk_flags.length > 0) {
      bits.push(`flags: ${[...new Set(s.risk_flags.map(f => f.category))].join(", ")}`);
    }
    return bits.join(" · ");
  }

  function topRisk(s: ReEnrollStudent): { label: string; color: string } | null {
    if (s.risk_flags.length === 0) return null;
    const top = [...s.risk_flags].sort((a, b) => riskScore([b]) - riskScore([a]))[0];
    return { label: `${top.category} · ${top.severity}`.toUpperCase(), color: RISK_COLOR[top.severity] ?? "#4A5568" };
  }

  return (
    <div className="adm-page">
      {/* Header */}
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Admissions</h1>
          <p className="adm-subtitle">
            Keeping our current students for 2026/27, and bringing in the new ones.
            Combined view for the principal and admissions office.
          </p>
        </div>
        <button className="adm-header-btn">Admissions · Adm. Sales ↗</button>
      </div>

      {/* AI Banner */}
      <div className="adm-banner">
        <div className="adm-banner-avatar">M</div>
        <div className="adm-banner-body">
          <div className="adm-banner-text">
            Re-enrolment is at 88% with 12 days left — 3 points behind last year at the same point.
            47 families haven&rsquo;t decided yet · 3 are flagged high risk on the retention dashboard.
            The new applicant pipeline is healthy (142 active) but Q7 conversion is lagging.
            The new class is shaping up well — projected 51 (grade) · coached in 3 days.
          </div>
        </div>
      </div>

      {/* KPI strip — students.re_enrolled_on / final_enrollment_date, demo while all null */}
      <div className="adm-kpi-strip">
        <div className="adm-kpi-card">
          <div className="adm-kpi-val">{enrolledNow}</div>
          <div className="adm-kpi-label">Currently enrolled</div>
          <div className="adm-kpi-sub">2026/27 academic year · all grades</div>
        </div>
        <div className="adm-kpi-card good">
          <div className="adm-kpi-val">{kpiReEnrolled}</div>
          <div className="adm-kpi-label">Re-enrolled for 2026/27</div>
          <div className="adm-kpi-sub">{reEnrolledPctLabel}</div>
        </div>
        <div className="adm-kpi-card warn">
          <div className="adm-kpi-val">{kpiPending}</div>
          <div className="adm-kpi-label">Not yet decided</div>
          <div className="adm-kpi-sub">{hasSignal ? "families still to confirm" : "7 days to deadline · 3 high risk"}</div>
        </div>
        <div className="adm-kpi-card bad">
          <div className="adm-kpi-val">{kpiLeaving}</div>
          <div className="adm-kpi-label">Confirmed leaving</div>
          <div className="adm-kpi-sub">
            {hasSignal
              ? leavingBars.filter(b => b.count > 0).map(b => `${b.count} ${b.label.toLowerCase()}`).join(" · ") || "—"
              : "5/7 pending · 4 sibling · 5 other"}
          </div>
        </div>
      </div>

      {/* Needs you this week — directly below the summary tiles (Sprint 1.5) */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">NEEDS YOU THIS WEEK</span>
          <span className="adm-section-hint">88% re-enrolled · 1 new · leave comments at each page</span>
        </div>
        <div className="adm-needs-grid">
          {NEEDS_THIS_WEEK.map(n => (
            <div key={n.title} className="adm-needs-card">
              <div className="adm-needs-icon">{n.icon}</div>
              <div className="adm-needs-title">{n.title}</div>
              <div className="adm-needs-desc">{n.desc}</div>
              <div className="adm-needs-actions">
                {n.actions.map(a => (
                  <button key={a.label} className={`adm-action-btn${a.primary ? " primary" : ""}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Re-enrolment — pending families */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">RE-ENROLMENT — FAMILIES WHO HAVEN&rsquo;T DECIDED</span>
          <span className="adm-section-hint">
            {hasRoster
              ? `${pending.length} pending${hasSignal ? "" : " · no decisions recorded yet"} · sorted by risk`
              : "47 pending · 12 days to deadline · sorted by risk"}
          </span>
        </div>

        {hasRoster && visiblePending.map((s, i) => {
          const risk = topRisk(s);
          return (
            <div key={s.id} className="adm-family-row">
              <div className="adm-family-avatar" style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}>
                {initials(s.full_name_en)}
              </div>
              <div className="adm-family-body">
                <div className="adm-family-name">{s.full_name_en}</div>
                <div className="adm-family-detail">{pendingDetail(s)}</div>
              </div>
              <div className="adm-family-right">
                {risk && (
                  <span className="adm-risk-chip" style={{ color: risk.color, background: risk.color + "18" }}>
                    {risk.label}
                  </span>
                )}
                <button
                  className="adm-action-btn"
                  onClick={() => setSummaryTarget({ studentId: s.id, name: s.full_name_en })}
                >
                  Retention summary
                </button>
                {s.parent?.email ? (
                  <a
                    className="adm-action-btn primary"
                    href={retentionCallMailto(s.parent.full_name, s.parent.email, s.full_name_en)}
                  >
                    Schedule retention call
                  </a>
                ) : (
                  <span
                    className="adm-no-contact"
                    title="This parent has no email on file yet. Ask the school office to add one, then the call draft opens here."
                  >
                    No contact on file — request from school
                  </span>
                )}
                <button
                  className="adm-danger-btn"
                  onClick={() => setConfirmTarget({ studentId: s.id, name: s.full_name_en, gradeLabel: gradeLabelFor(s) })}
                >
                  Confirm no re-enrolment
                </button>
              </div>
            </div>
          );
        })}

        {hasRoster && pending.length > PENDING_PREVIEW_COUNT && (
          <div className="adm-family-row all-others">
            <div className="adm-family-body">
              <div className="adm-family-detail">
                {showAllPending
                  ? `Showing all ${pending.length} pending families`
                  : `${pending.length - PENDING_PREVIEW_COUNT} more pending families · sorted by risk`}
              </div>
            </div>
            <div className="adm-family-right">
              <button className="adm-action-btn" onClick={() => setShowAllPending(v => !v)}>
                {showAllPending ? "Show fewer" : `Show all ${pending.length}`}
              </button>
            </div>
          </div>
        )}

        {/* Demo fallback — roster unavailable (e.g. DB unreachable) */}
        {!hasRoster && MOCK_FAMILIES.map((f, i) => (
          <div key={f.id} className="adm-family-row">
            <div className="adm-family-avatar" style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}>
              {initials(f.name)}
            </div>
            <div className="adm-family-body">
              <div className="adm-family-name">{f.name}</div>
              <div className="adm-family-detail">{f.detail}</div>
            </div>
            <div className="adm-family-right">
              <span className="adm-risk-chip" style={{ color: f.color, background: f.color + "18" }}>
                {f.risk}
              </span>
              <button
                className="adm-action-btn"
                onClick={() => setSummaryTarget({
                  studentId: f.id,
                  name: f.name,
                  demoSummary: demoSummaryFor(i, f.id, f.name, f.grade),
                })}
              >
                Retention summary
              </button>
              <span
                className="adm-no-contact"
                title="This parent has no email on file yet. Ask the school office to add one, then the call draft opens here."
              >
                No contact on file — request from school
              </span>
              <button
                className="adm-danger-btn"
                onClick={() => setConfirmTarget({ studentId: f.id, name: f.name, gradeLabel: f.grade, demo: true })}
              >
                Confirm no re-enrolment
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Confirmed leaving */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">CONFIRMED LEAVING — AND WHY</span>
          <span className="adm-section-hint">
            {leavers.length > 0
              ? `${leavers.length} famil${leavers.length === 1 ? "y" : "ies"} · drives next year's planning`
              : "18 families · drive next year's planning"}
          </span>
        </div>
        <div className="adm-leaving-grid">
          <div className="adm-leaving-bars">
            {leavingBars.map(r => (
              <div key={r.label} className="adm-leaving-bar-row">
                <span className="adm-leaving-reason">{r.label.toUpperCase()}</span>
                <div className="adm-leaving-bar-wrap">
                  <div className="adm-leaving-bar-fill" style={{ width: `${(r.count / maxLeavingBar) * 100}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="adm-leaving-list">
            {leavers.length > 0
              ? leavers.slice(0, 8).map(s => (
                  <div key={s.id} className="adm-leaving-note-row">
                    <span className="adm-leaving-reason-chip">{LEAVER_REASON_LABEL[s.leaver_reason ?? ""] ?? "Other"}</span>
                    <span className="adm-leaving-note">
                      {s.full_name_en}
                      {gradeLabelFor(s) ? ` (${gradeLabelFor(s)})` : ""} · last day {s.final_enrollment_date}
                      {s.leaver_comment ? ` · “${s.leaver_comment}”` : ""}
                    </span>
                  </div>
                ))
              : MOCK_LEAVING.filter(r => r.note).map(r => (
                  <div key={r.label} className="adm-leaving-note-row">
                    <span className="adm-leaving-count">{r.count}</span>
                    <span className="adm-leaving-note">{r.note}</span>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* Pipeline funnel */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">NEW APPLICANT PIPELINE · 2026/27</span>
          <span className="adm-section-hint">
            {demoPipeline
              ? "142 active · demo pipeline — add your first applicant"
              : `${rows.length} active · click a stage to see candidates`}
          </span>
        </div>
        <div className="adm-pipeline">
          {PIPELINE_STAGES.map(key => {
            const count = demoPipeline ? MOCK_STAGE_COUNT[key] : (stageCounts[key] ?? 0);
            const maxCount = demoPipeline
              ? Math.max(...Object.values(MOCK_STAGE_COUNT))
              : Math.max(1, ...PIPELINE_STAGES.map(k => stageCounts[k] ?? 0));
            const active = expandedStage === key;
            return (
              <button
                key={key}
                type="button"
                className={`adm-pipeline-stage${active ? " active" : ""}`}
                onClick={() => setExpandedStage(active ? null : key)}
                aria-expanded={active}
                aria-label={`${STAGE_LABEL[key]} — ${count} candidates`}
              >
                <div className="adm-pipeline-bar-wrap">
                  <div className="adm-pipeline-bar" style={{ height: `${Math.max(8, (count / maxCount) * 80)}px` }} />
                </div>
                <div className="adm-pipeline-count">{count}</div>
                <div className="adm-pipeline-label">{STAGE_LABEL[key]}</div>
                <div className="adm-pipeline-sub">{demoPipeline ? MOCK_STAGE_SUB[key] : (active ? "hide list" : "view list")}</div>
              </button>
            );
          })}
        </div>
        {expandedStage && (
          <div className="adm-stagelist">
            <div className="adm-stagelist-head">
              {STAGE_LABEL[expandedStage]} — {expandedRows.length} candidate{expandedRows.length === 1 ? "" : "s"}
              {demoPipeline ? " (demo)" : ""}
            </div>
            {expandedRows.length === 0 && (
              <div className="adm-stagelist-empty">No candidates in this stage yet.</div>
            )}
            {expandedRows.map((a, i) => (
              <div key={a.id} className="adm-stagelist-row">
                <div className="adm-tbl-avatar" style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}>
                  {initials(a.full_name)}
                </div>
                <div className="adm-stagelist-body">
                  <span className="adm-tbl-name">{a.full_name}</span>
                  <span className="adm-tbl-meta">
                    {a.target_grade} · {a.source ?? "no source"} · {daysInStage(a.created_at)} days in stage
                    {a.parent_name ? ` · parent: ${a.parent_name}` : ""}
                  </span>
                </div>
                <button
                  className="adm-tbl-btn"
                  onClick={() => openEditor(a)}
                  disabled={isDemoApplicant(a)}
                  title={isDemoApplicant(a) ? "Demo row — add a real applicant to edit" : undefined}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All applicants table */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">ALL APPLICANTS</span>
          <div className="adm-tbl-controls">
            <button className="adm-export-btn" onClick={() => exportCsv(filteredApplicants)}>Export CSV ↓</button>
            <button className="adm-add-btn" onClick={() => openEditor(null)}>+ Add applicant</button>
          </div>
        </div>
        <div className="adm-search-row">
          <input
            className="adm-search"
            placeholder="Search by applicant name, parent, grade, or source…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="adm-stage-select"
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            aria-label="Filter by stage"
          >
            <option>All stages</option>
            {Object.keys(STAGE_LABEL).map(k => (
              <option key={k} value={k}>{STAGE_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>APPLICANT</th>
                <th>STAGE</th>
                <th>DAYS IN STAGE</th>
                <th>SOURCE</th>
                <th>PARENT</th>
                <th>NOTES</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredApplicants.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-tbl-empty">No applicants match this search.</td>
                </tr>
              )}
              {filteredApplicants.map((a, i) => (
                <tr key={a.id}>
                  <td>
                    <div className="adm-tbl-applicant">
                      <div className="adm-tbl-avatar" style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}>
                        {initials(a.full_name)}
                      </div>
                      <div>
                        <div className="adm-tbl-name">{a.full_name}</div>
                        <div className="adm-tbl-meta">{a.target_grade} · {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`adm-stage-chip ${STAGE_COLOR[a.stage] ?? "adm-chip-grey"}`}>
                      {STAGE_LABEL[a.stage] ?? a.stage.toUpperCase()}
                    </span>
                  </td>
                  <td className="adm-tbl-days">{daysInStage(a.created_at)}</td>
                  <td className="adm-tbl-source">{a.source ?? "—"}</td>
                  <td className="adm-tbl-owner">{a.parent_name ?? "—"}</td>
                  <td className="adm-tbl-signal">
                    {a.notes
                      ? <span className="adm-signal-badge" title={a.notes}>{a.notes.length > 24 ? `${a.notes.slice(0, 24)}…` : a.notes}</span>
                      : <span className="adm-signal-none">—</span>}
                  </td>
                  <td>
                    <button
                      className="adm-tbl-btn"
                      onClick={() => openEditor(a)}
                      disabled={isDemoApplicant(a)}
                      title={isDemoApplicant(a) ? "Demo row — add a real applicant to edit" : undefined}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      {summaryTarget && (
        <RetentionSummaryModal target={summaryTarget} onClose={() => setSummaryTarget(null)} />
      )}
      {confirmTarget && (
        <ConfirmLeaveModal
          target={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={(studentId, reason, comment) => {
            setLocalLeavers(prev => ({ ...prev, [studentId]: { reason, comment } }));
            router.refresh();
          }}
        />
      )}
      {editorOpen && (
        <ApplicantModal
          applicant={editorApplicant}
          parentOptions={parentOptions}
          onClose={() => setEditorOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
