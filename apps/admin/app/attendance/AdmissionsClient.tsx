"use client";

import { useState, useMemo } from "react";

type Applicant = {
  id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  target_grade: string;
  stage: string;
  source: string | null;
  notes: string | null;
  created_at: string;
};

type Props = {
  applicants: Applicant[];
  totalEnrolled: number;
};

// ── Mock data ──────────────────────────────────────────────────────────────
const MOCK_FAMILIES = [
  { id: "f1", name: "Al Hamdan Family", detail: "G5 · flagged high risk on retention dashboard · attendance, parent school comms", risk: "ALL DISMISSED RISK", action: "Open retention plan", color: "#C53030" },
  { id: "f2", name: "Maya Al-Lawati",   detail: "G9 · G10 · 4 Financial (mid-block) · 90 days overdue",                          risk: "BACK-TO-SCH RISK",  action: "View barrier plan", color: "#C05621" },
  { id: "f3", name: "Aisha Al-Balushi", detail: "G7 · 3 years at G12 · Competitive retention, same day · referral came engaged", risk: "COMPETITION RISK",  action: "Schedule retention call", color: "#975A16" },
  { id: "f4", name: "Sara Al-Said",     detail: "G1 · 7 years at G12 · 3 previous open · no other negative signals",             risk: "CREDIT RISK",       action: "Send nudge", color: "#276749" },
  { id: "f5", name: "Omar Al-Habsi",    detail: "G6 · G6 · 1 year at G4 · Father confirmation at PTO 'at' 3 last week' · 10 days ago", risk: "FRIENDLY CONTACT", action: "Send friendly reminder", color: "#2C5282" },
];

const LEAVING_REASONS = [
  { label: "GRADUATED",         count: 12, color: "#BEE3F8", note: "all leavers · rejected · all university destinations confirmed" },
  { label: "MOVING",            count: 4,  color: "#FEEBC8", note: "confirmed · 1 to KSA · 1 to Canada · 1 to Australia · 1 other" },
  { label: "COMPETITION LOSING",count: 2,  color: "#FED7D7", note: "Dissatisfied · 1 to previous gap · both flagged in exit interview" },
  { label: "DISSATISFIED",      count: 0,  color: "#EDF2F7", note: "" },
];

const PIPELINE_STAGES = [
  { key: "new",      label: "INQUIRY",      sub: "91 this month", mock: 142 },
  { key: "review",   label: "TOUR BOOKED",  sub: "first visit",   mock: 84 },
  { key: "interview",label: "ASSESSMENT",   sub: "in 18 days",    mock: 61 },
  { key: "offer",    label: "INTERVIEW",    sub: "27 scheduled",  mock: 38 },
  { key: "accepted", label: "OFFER SENT",   sub: "4 expiring",    mock: 31 },
  { key: "enrolled", label: "ENROLLED",     sub: "4 decisions pending", mock: 22 },
];

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

const STAGE_LABEL: Record<string, string> = {
  new: "INQUIRY", review: "TOUR BOOKED", interview: "ASSESSMENT",
  offer: "OFFER SENT", accepted: "ENROLLED", rejected: "REJECTED", withdrawn: "WITHDRAWN",
};
const STAGE_COLOR: Record<string, string> = {
  new: "adm-chip-blue", review: "adm-chip-blue", interview: "adm-chip-yellow",
  offer: "adm-chip-green", accepted: "adm-chip-green", rejected: "adm-chip-red", withdrawn: "adm-chip-grey",
};

const MOCK_APPLICANTS: Applicant[] = [
  { id: "a1", full_name: "Reem Al-Halabi",   email: null, phone_e164: null, target_grade: "G11", stage: "accepted",  source: "Sibling referral",   notes: null, created_at: "2026-01-01" },
  { id: "a2", full_name: "Laena Al-Sharif",  email: null, phone_e164: null, target_grade: "G7",  stage: "review",    source: "Open day",           notes: null, created_at: "2026-01-15" },
  { id: "a3", full_name: "Mohammed Al-Said", email: null, phone_e164: null, target_grade: "G3",  stage: "interview", source: "Word of mouth",      notes: null, created_at: "2026-02-01" },
  { id: "a4", full_name: "Aisha Al-Balushi", email: null, phone_e164: null, target_grade: "G5",  stage: "review",    source: "Website",            notes: null, created_at: "2026-02-10" },
  { id: "a5", full_name: "Yousef Al-Khalili",email: null, phone_e164: null, target_grade: "G9",  stage: "new",       source: "Parent of G8K",      notes: null, created_at: "2026-03-01" },
  { id: "a6", full_name: "Sama Al-Harthi",   email: null, phone_e164: null, target_grade: "G2",  stage: "offer",     source: "Google search",      notes: null, created_at: "2026-03-15" },
  { id: "a7", full_name: "Hassan Al-Amri",   email: null, phone_e164: null, target_grade: "G5",  stage: "review",    source: "Paid · Facebook ad", notes: null, created_at: "2026-04-01" },
  { id: "a8", full_name: "Faisal Al-Ansi",   email: null, phone_e164: null, target_grade: "G10", stage: "new",       source: "Walk in",            notes: null, created_at: "2026-04-10" },
];

function daysInStage(created_at: string): number {
  return Math.floor((Date.now() - new Date(created_at).getTime()) / 86400000);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

const AVATAR_BG = ["#3D5A80", "#C05621", "#2F855A", "#C53030", "#975A16", "#2C5282", "#6B46C1", "#B7791F"];

export default function AdmissionsClient({ applicants, totalEnrolled }: Props) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All stages");

  const rows = applicants.length > 0 ? applicants : MOCK_APPLICANTS;

  // Pipeline counts from DB (or mock)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(a => { counts[a.stage] = (counts[a.stage] ?? 0) + 1; });
    return counts;
  }, [rows]);

  const filteredApplicants = useMemo(() => {
    return rows.filter(a => {
      const matchSearch = !search ||
        a.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (a.target_grade ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.source ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStage = stageFilter === "All stages" || a.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [rows, search, stageFilter]);

  const enrolled = totalEnrolled || 612;
  const reEnrolled = Math.round(enrolled * 0.884);
  const notDecided = 47;
  const confirmedLeaving = 18;

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

      {/* KPI strip */}
      <div className="adm-kpi-strip">
        <div className="adm-kpi-card">
          <div className="adm-kpi-val">{enrolled}</div>
          <div className="adm-kpi-label">Currently enrolled</div>
          <div className="adm-kpi-sub">2026/27 academic year · all grades</div>
        </div>
        <div className="adm-kpi-card good">
          <div className="adm-kpi-val">{reEnrolled}</div>
          <div className="adm-kpi-label">Re-families for 2026/27</div>
          <div className="adm-kpi-sub">88.4% · same time last year — +12.6%</div>
        </div>
        <div className="adm-kpi-card warn">
          <div className="adm-kpi-val">{notDecided}</div>
          <div className="adm-kpi-label">Not yet decided</div>
          <div className="adm-kpi-sub">7 days to deadline · 3 high risk</div>
        </div>
        <div className="adm-kpi-card bad">
          <div className="adm-kpi-val">{confirmedLeaving}</div>
          <div className="adm-kpi-label">Confirmed leaving</div>
          <div className="adm-kpi-sub">5/7 pending · 4 sibling · 5 other</div>
        </div>
      </div>

      {/* Re-enrolment families */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">RE-ENROLMENT — FAMILIES WHO HAVEN&rsquo;T DECIDED</span>
          <span className="adm-section-hint">47 pending · 12 days to deadline · sorted by risk</span>
        </div>
        {MOCK_FAMILIES.map((f, i) => (
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
              <button className="adm-action-btn primary">{f.action}</button>
            </div>
          </div>
        ))}
        <div className="adm-family-row all-others">
          <div className="adm-family-body">
            <div className="adm-family-detail">All 43 other pending families · no other negative signals · sorted by grade</div>
          </div>
          <div className="adm-family-right">
            <button className="adm-action-btn">Open all</button>
          </div>
        </div>
      </section>

      {/* Confirmed leaving */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">CONFIRMED LEAVING — AND WHY</span>
          <span className="adm-section-hint">18 families · drive next year&rsquo;s planning</span>
        </div>
        <div className="adm-leaving-grid">
          <div className="adm-leaving-bars">
            {LEAVING_REASONS.map(r => (
              <div key={r.label} className="adm-leaving-bar-row">
                <span className="adm-leaving-reason">{r.label}</span>
                <div className="adm-leaving-bar-wrap">
                  <div className="adm-leaving-bar-fill" style={{ width: `${(r.count / 12) * 100}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="adm-leaving-list">
            {LEAVING_REASONS.filter(r => r.note).map(r => (
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
            {rows.length > 0 ? rows.length : "142"} active · 1 new · {rows.length > 0 ? "real data" : "1 new assessment · auto-sorted by risk"}
          </span>
        </div>
        <div className="adm-pipeline">
          {PIPELINE_STAGES.map(s => {
            const count = rows.length > 0 ? (stageCounts[s.key] ?? 0) : s.mock;
            const maxCount = rows.length > 0 ? Math.max(...Object.values(stageCounts)) : 142;
            return (
              <div key={s.key} className="adm-pipeline-stage">
                <div className="adm-pipeline-bar-wrap">
                  <div
                    className="adm-pipeline-bar"
                    style={{ height: `${Math.max(8, (count / maxCount) * 80)}px` }}
                  />
                </div>
                <div className="adm-pipeline-count">{count}</div>
                <div className="adm-pipeline-label">{s.label}</div>
                <div className="adm-pipeline-sub">{s.sub}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Needs you this week */}
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

      {/* All applicants table */}
      <section className="adm-section">
        <div className="adm-section-head">
          <span className="adm-section-label">ALL APPLICANTS</span>
          <div className="adm-tbl-controls">
            <button className="adm-chip-btn active">All stages</button>
            <button className="adm-chip-btn">My applicants</button>
            <button className="adm-chip-btn">G7 seat</button>
            <button className="adm-export-btn">Export CSV ↓</button>
            <button className="adm-add-btn">+ Add applicant</button>
          </div>
        </div>
        <div className="adm-search-row">
          <input
            className="adm-search"
            placeholder="Search by applicant name, parent, or grade…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="adm-stage-select"
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
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
                <th>OWNER</th>
                <th>AI SIGNAL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
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
                  <td className="adm-tbl-owner">Ms. Salwa</td>
                  <td className="adm-tbl-signal">
                    {a.notes ? <span className="adm-signal-badge">{a.notes.slice(0, 20)}…</span> : <span className="adm-signal-none">—</span>}
                  </td>
                  <td>
                    <button className="adm-tbl-btn">Open ↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
