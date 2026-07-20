"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  UniversityApp,
  UniversityAppStatus,
  UniversityRef,
  TestScoreRow,
  MasterDocRow,
  BookingRequestRow,
  CounselorInfo,
} from "@manhaj/lib/queries/applications";
import { MOCK_UNIVERSITIES } from "@manhaj/lib/mock-universities";
import {
  addApplicationAction,
  addTestScoreAction,
  requestBookingAction,
} from "@/app/actions/applications";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  live: boolean;                     // signed-in student session present
  studentName: string;
  apps: UniversityApp[];             // DB rows ([] → demo fallback)
  universities: UniversityRef[];     // reference list ([] → demo fallback)
  testScores: TestScoreRow[];
  masterDocs: MasterDocRow[];
  booking: BookingRequestRow | null;
  counselor: CounselorInfo | null;
};

/** Unified render model for both DB and demo applications. */
type AppRow = {
  id: string;
  abbr: string;
  color: string;
  name: string;
  country: string;
  program: string;
  status: UniversityAppStatus;
  deadline: string | null;
  decision: string | null;
  admitRate: number | null;
  note: string;
};

type Doc = { name: string; status: "uploaded" | "in_progress" | "missing"; detail?: string };

// ── Demo data ─────────────────────────────────────────────────────────────────

const MOCK_APPS: AppRow[] = [
  { id:"u1", abbr:"AUS",  color:"#009B77", name:"American University of Sharjah", country:"UAE",               program:"Computer Engineering",  status:"submitted",   deadline:null,         decision:"Q1 2027", admitRate:68, note:"Based on 10-yr data · Last on 10 Sept"       },
  { id:"u2", abbr:"KCL",  color:"#800020", name:"King's College London",           country:"UK · UCAS P430",    program:"BSc Computer Science",   status:"submitted",   deadline:null,         decision:"Q1 2027", admitRate:40, note:"40% adm · 3 documents pending"              },
  { id:"u3", abbr:"UCL",  color:"#522D6D", name:"University College London",       country:"UK",                program:"BSc Computer Science",   status:"in_progress", deadline:"2027-01-12", decision:null,      admitRate:32, note:"Personal statement at draft 3"               },
  { id:"u4", abbr:"MCG",  color:"#ED1B2F", name:"McGill University",               country:"Canada · Montreal", program:"BSc Computer Science",   status:"interview",   deadline:null,         decision:"Q2 2027", admitRate:44, note:"Interview stage"                             },
  { id:"u5", abbr:"UofT", color:"#003FA5", name:"University of Toronto",           country:"Toronto, Canada",   program:"Computer Science",       status:"submitted",   deadline:null,         decision:"Q2 2027", admitRate:51, note:""                                           },
  { id:"u6", abbr:"NYU",  color:"#57068C", name:"NYU Abu Dhabi",                   country:"AE · scholarship",  program:"BSc Computer Science",   status:"in_progress", deadline:"2027-07-01", decision:null,      admitRate:15, note:"Highly selective"                            },
  { id:"u7", abbr:"SQU",  color:"#006C3B", name:"Sultan Qaboos University",        country:"Oman",              program:"Computer Science",       status:"researching", deadline:null,         decision:null,      admitRate:82, note:"GPA 3.5 required"                            },
];

const MOCK_DOCS: Doc[] = [
  { name: "Personal IB grades (transcript)",        status: "uploaded"     },
  { name: "IELTS score report",                     status: "uploaded"     },
  { name: "Up-to-date ID photo (×3)",               status: "uploaded"     },
  { name: "Reference letter · academic (Mr. Alamy)",status: "uploaded"     },
  { name: "Reference letter · academic (Ms. Sara)", status: "uploaded"     },
  { name: "Reference letter · personal",            status: "uploaded"     },
  { name: "Personal statement",                     status: "in_progress", detail: "Draft 3 · AI feedback waiting · 11 days ago" },
  { name: "CV / activities list",                   status: "uploaded",    detail: "Updated 5 days ago"                           },
  { name: "IB Transcript (predicted)",              status: "uploaded"     },
];

const MOCK_SCORES: Array<{ name: string; score: string; suffix: string; note?: string }> = [
  { name: "IELTS Academic",  score: "6.8",  suffix: "/9"   },
  { name: "SAT",             score: "1480", suffix: ""     },
  { name: "Predicted IB",    score: "43",   suffix: "/45", note: "by your teachers" },
];

const MOCK_PLACEMENT = [
  { name: "UCL CS",    admitRate: 52 },
  { name: "King's CS", admitRate: 38 },
  { name: "McGill CS", admitRate: 44 },
  { name: "NYUAD CS",  admitRate: 15 },
];

const MOCK_NEEDLE = [
  {
    label: "PATH TO UCL",
    title: "Take the SAT Math II subject test",
    desc: "The 50 applicants who added it last year moved from waitlist to admit. Next sitting: 7 Dec.",
  },
  {
    label: "PATH TO MCGILL",
    title: "Lead a community volunteering project",
    desc: "Historically, McGill values community leadership. Manhaji says you have a project planned — could you formalise a final draft?",
  },
  {
    label: "PATH TO ALL",
    title: "Finish personal statement draft 4",
    desc: "Your counsellor's Draft 3 feedback is waiting. Key revisions historically move the predicted ratio by 8.5%.",
  },
];

const MOCK_ANON = [
  { year:"2024", ib:43, sat:1520, note:"Same CS focus · led robotics club",        outcomes:["UCL","McGill","AMS U"]           },
  { year:"2024", ib:42, sat:1480, note:"CS & maths · part-time data work",          outcomes:["UCL WAITLIST","GOOD S","START U"] },
  { year:"2025", ib:42, sat:1500, note:"CS maths · IB diploma ×53",                 outcomes:["McGill","ADMIT U"]               },
  { year:"2023", ib:41, sat:1480, note:"CS maths · volunteer activities",            outcomes:["UCL","GOOD S","AUS U"]           },
];

const STUDY_ASSIST = [
  "Get feedback on a draft essay",
  "Practice interview questions",
  "Compare 2 universities",
  "Build a deadline plan",
];

const TEST_PRESETS = ["IELTS Academic", "SAT", "TOEFL iBT", "Predicted IB", "AP exam", "Other…"];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<UniversityAppStatus, { label: string; bg: string; color: string }> = {
  researching: { label: "RESEARCHING", bg: "#EDF2F7", color: "#4A5568"  },
  in_progress: { label: "IN PROGRESS", bg: "#EBF8FF", color: "#2B6CB0"  },
  submitted:   { label: "SUBMITTED",   bg: "#F0FFF4", color: "#276749"  },
  interview:   { label: "INTERVIEW",   bg: "#FEEBC8", color: "#975A16"  },
  admitted:    { label: "ADMITTED",    bg: "#C6F6D5", color: "#276749"  },
  rejected:    { label: "REJECTED",    bg: "#FED7D7", color: "#C53030"  },
  withdrawn:   { label: "WITHDRAWN",   bg: "#EDF2F7", color: "#718096"  },
};

const TAB_STATUSES: UniversityAppStatus[] = [
  "researching", "in_progress", "submitted", "interview", "admitted", "rejected",
];

const NEW_APP_STATUSES: UniversityAppStatus[] = ["researching", "in_progress", "submitted"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ABBR_COLORS = ["#0B2545", "#3D5A80", "#2B6CB0", "#553C9A", "#276749", "#975A16", "#800020"];

function abbrOf(name: string): string {
  const words = name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && !["of", "the", "in", "and"].includes(w.toLowerCase()));
  return words.slice(0, 3).map(w => w[0]!.toUpperCase()).join("") || name.slice(0, 3).toUpperCase();
}

function colorOf(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return ABBR_COLORS[h % ABBR_COLORS.length];
}

function toAppRow(a: UniversityApp): AppRow {
  return {
    id: a.id,
    abbr: abbrOf(a.universityName),
    color: colorOf(a.universityName),
    name: a.universityName,
    country: a.country,
    program: a.program,
    status: a.status,
    deadline: a.deadline,
    decision: null,
    admitRate: null,
    note: a.notes ?? "",
  };
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Next N school days (Sun–Thu) × two afternoon times. */
function buildSlots(): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < 6) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 5 || dow === 6) continue; // Fri/Sat — Oman weekend
    for (const [h, m] of [[13, 30], [15, 30]] as const) {
      const slot = new Date(d);
      slot.setHours(h, m, 0, 0);
      out.push(slot.toISOString());
      if (out.length >= 6) break;
    }
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplicationTrackerClient({
  live, apps, universities, testScores, masterDocs, booking, counselor,
}: Props) {
  const router = useRouter();
  const usingDbApps = live && apps.length > 0;

  const activeCounselor = counselor ?? { id: null, name: "Ms. Hala Al-Aatari", nextSession: live ? null : "Mon 2 Jan · 3:30 PM" };
  const uniList = universities.length > 0 ? universities : MOCK_UNIVERSITIES;

  const [localApps, setLocalApps]   = useState<AppRow[]>([]);
  const [demoNote, setDemoNote]     = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<UniversityAppStatus | "all">("all");

  const allApps: AppRow[] = [...(usingDbApps ? apps.map(toAppRow) : MOCK_APPS), ...localApps];

  // Add-university modal
  const [addOpen, setAddOpen]       = useState(false);
  const [uniQuery, setUniQuery]     = useState("");
  const [pickedUni, setPickedUni]   = useState<{ id: string | null; name: string; country: string } | null>(null);
  const [formProgram, setFormProgram] = useState("");
  const [formStatus, setFormStatus] = useState<UniversityAppStatus>("researching");
  const [formDeadline, setFormDeadline] = useState("");
  const [addError, setAddError]     = useState<string | null>(null);
  const [addSaving, setAddSaving]   = useState(false);

  // Test-score form
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [scoreTest, setScoreTest]   = useState(TEST_PRESETS[0]);
  const [scoreCustom, setScoreCustom] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [scoreDate, setScoreDate]   = useState("");
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [localScores, setLocalScores] = useState<TestScoreRow[]>([]);

  // Booking modal
  const [bookOpen, setBookOpen]     = useState(false);
  const [bookSlot, setBookSlot]     = useState<string | null>(null);
  const [bookError, setBookError]   = useState<string | null>(null);
  const [bookSaving, setBookSaving] = useState(false);
  const [localBooking, setLocalBooking] = useState<{ start: string; demo: boolean } | null>(null);
  const slots = useMemo(() => buildSlots(), []);
  const nowMs = useMemo(() => new Date().getTime(), []);

  const effectiveBooking = booking
    ? { start: booking.requestedStart, demo: false, status: booking.status }
    : localBooking
      ? { start: localBooking.start, demo: localBooking.demo, status: "pending" as const }
      : null;

  const allScores = [...testScores, ...localScores];
  const hasRealScores = allScores.length > 0;

  // Status counts + filter
  const counts = TAB_STATUSES.reduce((acc, s) => {
    acc[s] = allApps.filter(a => a.status === s).length;
    return acc;
  }, {} as Record<UniversityAppStatus, number>);
  const filteredApps = activeFilter === "all" ? allApps : allApps.filter(a => a.status === activeFilter);

  // Deadline banner (nearest upcoming deadline). nowMs is captured once (useMemo).
  const todayIso = new Date(nowMs).toISOString().slice(0, 10);
  const nextDeadline = allApps
    .filter(a => a.deadline && a.deadline >= todayIso)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))[0] ?? null;
  const daysToDeadline = nextDeadline
    ? Math.ceil((Date.parse(nextDeadline.deadline! + "T00:00:00Z") - nowMs) / 86400000)
    : null;

  const deadlinesThisMonth = allApps.filter(a =>
    a.deadline && a.deadline.slice(0, 7) === todayIso.slice(0, 7)).length;

  // Filtered university search list
  const uniMatches = uniQuery.trim().length > 0
    ? uniList.filter(u => u.name.toLowerCase().includes(uniQuery.trim().toLowerCase())).slice(0, 8)
    : uniList.slice(0, 8);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAddModal() {
    setUniQuery(""); setPickedUni(null); setFormProgram("");
    setFormStatus("researching"); setFormDeadline(""); setAddError(null);
    setAddOpen(true);
  }

  async function handleAddUniversity() {
    if (!pickedUni) { setAddError("Pick a university from the list first."); return; }
    setAddSaving(true);
    setAddError(null);
    const res = await addApplicationAction({
      universityId: pickedUni.id && !pickedUni.id.startsWith("demo-") ? pickedUni.id : null,
      universityName: pickedUni.name,
      country: pickedUni.country,
      program: formProgram,
      status: formStatus,
      deadline: formDeadline || undefined,
    });
    setAddSaving(false);
    if (res.ok) {
      setAddOpen(false);
      router.refresh();
      return;
    }
    if (res.error === "not_signed_in") {
      setLocalApps(p => [...p, {
        id: `local-${Date.now()}`,
        abbr: abbrOf(pickedUni.name), color: colorOf(pickedUni.name),
        name: pickedUni.name, country: pickedUni.country,
        program: formProgram, status: formStatus,
        deadline: formDeadline || null, decision: null, admitRate: null, note: "",
      }]);
      setAddOpen(false);
      setDemoNote("Demo mode — sign in as a student to save applications to your school record.");
      return;
    }
    setAddError(res.error);
  }

  async function handleAddScore() {
    const testName = scoreTest === "Other…" ? scoreCustom : scoreTest;
    if (!testName.trim() || !scoreValue.trim()) { setScoreError("Enter the test and your score."); return; }
    setScoreSaving(true);
    setScoreError(null);
    const res = await addTestScoreAction({
      testName, scoreRaw: scoreValue, takenOn: scoreDate || undefined,
    });
    setScoreSaving(false);
    if (res.ok) {
      setScoreFormOpen(false); setScoreValue(""); setScoreDate("");
      router.refresh();
      return;
    }
    if (res.error === "not_signed_in") {
      setLocalScores(p => [...p, {
        id: `local-${Date.now()}`, testName: testName.trim(), scoreRaw: scoreValue.trim(),
        scoreNumeric: null, takenOn: scoreDate || null, notes: null,
      }]);
      setScoreFormOpen(false); setScoreValue(""); setScoreDate("");
      setDemoNote("Demo mode — sign in as a student to save scores to your school record.");
      return;
    }
    setScoreError(res.error);
  }

  async function handleBook() {
    if (!bookSlot) { setBookError("Pick a time slot first."); return; }
    setBookSaving(true);
    setBookError(null);
    const res = await requestBookingAction({ startIso: bookSlot });
    setBookSaving(false);
    if (res.ok) {
      setLocalBooking({ start: bookSlot, demo: false });
      setBookOpen(false);
      router.refresh();
      return;
    }
    if (res.error === "not_signed_in") {
      setLocalBooking({ start: bookSlot, demo: true });
      setBookOpen(false);
      setDemoNote("Demo mode — sign in as a student to send the request to your counsellor.");
      return;
    }
    if (res.error === "no_counselor") {
      setBookError("Your school hasn't linked a counsellor to your class yet — ask the front office to set one up.");
      return;
    }
    setBookError(res.error);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderApp(app: AppRow) {
    const cfg = STATUS_CFG[app.status];
    return (
      <div key={app.id} className="at-app-row">
        <div className="at-app-logo" style={{ background: app.color }}>
          {app.abbr.slice(0, 4)}
        </div>
        <div className="at-app-info">
          <div className="at-app-name">{app.name}</div>
          <div className="at-app-sub">{[app.country, app.program].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="at-app-status-col">
          <span className="at-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          {app.deadline && <div className="at-app-deadline">Due {new Date(app.deadline + "T00:00:00Z").toLocaleDateString("en-GB", { day:"numeric", month:"short", timeZone:"UTC" })}</div>}
          {app.decision && !app.deadline && <div className="at-app-decision">Decision {app.decision}</div>}
        </div>
        <div className="at-app-rate-col">
          {app.admitRate !== null ? (
            <>
              <div className="at-admit-bar-wrap">
                <div className="at-admit-bar-fill" style={{ width: `${app.admitRate}%` }} />
              </div>
              <div className="at-admit-pct">{app.admitRate}% adm</div>
            </>
          ) : (
            <div className="at-admit-pct at-admit-pending">Fit estimate arrives with the Phase-2 outcomes model</div>
          )}
          {app.note && <div className="at-app-note">{app.note}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="at-page">

      {/* ── Full-width header ─────────────────────────────────────────────── */}
      <div className="at-header">
        <h1 className="at-title">My university applications · 2026/27 entry</h1>
        <p className="at-subtitle">
          {allApps.length} application{allApps.length === 1 ? "" : "s"} in motion.
          {deadlinesThisMonth > 0 ? ` ${deadlinesThisMonth} deadline${deadlinesThisMonth === 1 ? "" : "s"} this month.` : ""}
          {" "}Your counsellor, {activeCounselor.name.split(" ").slice(-2).join(" ")}, is your partner in this — message her any time.
        </p>
      </div>

      {demoNote && (
        <div className="at-demo-note" role="status">
          {demoNote}
          <button className="at-demo-note-close" onClick={() => setDemoNote(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="at-status-strip">
        {TAB_STATUSES.map(s => (
          <button
            key={s}
            className={`at-status-tab${activeFilter === s ? " active" : ""}`}
            onClick={() => setActiveFilter(prev => prev === s ? "all" : s)}
          >
            <span className="at-tab-num">{counts[s]}</span>
            <span className="at-tab-label">{STATUS_CFG[s].label}</span>
          </button>
        ))}
      </div>

      {/* ── Deadline banner ──────────────────────────────────────────────── */}
      {nextDeadline && daysToDeadline !== null && daysToDeadline <= 60 && (
        <div className="at-alert-banner">
          <div className="at-alert-left">
            <div className="at-alert-msg">
              <strong>{nextDeadline.name} deadline is in {daysToDeadline} day{daysToDeadline === 1 ? "" : "s"}</strong>
              {" "}· make sure your documents and statement are on track.
            </div>
            <div className="at-alert-sub">
              Deadlines come from your tracked applications · your counsellor sees the same list
            </div>
          </div>
          <button className="at-alert-btn" onClick={() => setBookOpen(true)}>Ask your counsellor</button>
        </div>
      )}

      {/* ── Two-column body ───────────────────────────────────────────────── */}
      <div className="at-body">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="at-main">

          {/* Applications list */}
          <div className="at-section">
            <div className="at-section-hdr">
              <span className="at-section-label">YOUR APPLICATIONS</span>
              <button className="at-add-btn" onClick={openAddModal}>+ Add a university</button>
            </div>
            <div className="at-app-list">
              {filteredApps.map(renderApp)}
              {filteredApps.length === 0 && (
                <div className="at-empty-hint">
                  Nothing in this column yet — add a university or tap the tab again to see all.
                </div>
              )}
            </div>
          </div>

          {/* Placement insights */}
          <div className="at-section">
            <div className="at-section-hdr">
              <span className="at-section-label">PLACEMENT INSIGHTS — WHERE YOU STAND</span>
            </div>
            <div className="at-placement-card">
              <div className="at-placement-left">
                <div className="at-placement-eyebrow">YOUR PROFILE</div>
                <div className="at-placement-rank">{hasRealScores ? `${allScores.length} score${allScores.length === 1 ? "" : "s"} on file` : "Top 18%"}</div>
                <div className="at-placement-profile">
                  {hasRealScores
                    ? allScores.slice(0, 4).map(s => `${s.testName}: ${s.scoreRaw ?? s.scoreNumeric}`).join(" · ")
                    : "Predicted IB: 43 · SAT: 1480 · GS: 78.5 · strong extracurriculars"}
                </div>
                {hasRealScores && (
                  <div className="at-placement-refresh-note">
                    Updates as you add test scores · cohort ranking arrives with the Phase-2 outcomes model
                  </div>
                )}
              </div>
              <div className="at-placement-right">
                <div className="at-placement-eyebrow">5-YEAR PROGRAMME ADMISSION RATES (SAMPLE)</div>
                {MOCK_PLACEMENT.map((p, i) => (
                  <div key={i} className="at-placement-row">
                    <span className="at-placement-uni">{p.name}</span>
                    <div className="at-placement-bar-wrap">
                      <div className="at-placement-bar-fill" style={{ width: `${p.admitRate}%` }} />
                    </div>
                    <span className="at-placement-rate">{p.admitRate}% adm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What would move the needle */}
          <div className="at-section">
            <div className="at-section-hdr">
              <span className="at-section-label">WHAT WOULD MOVE THE NEEDLE MOST</span>
            </div>
            <div className="at-needle-grid">
              {MOCK_NEEDLE.map((n, i) => (
                <div key={i} className="at-needle-card">
                  <div className="at-needle-label">{n.label}</div>
                  <div className="at-needle-title">{n.title}</div>
                  <div className="at-needle-desc">{n.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Anonymous past students */}
          <div className="at-section">
            <div className="at-section-hdr">
              <span className="at-section-label">ANONYMOUS PAST STUDENTS WITH SIMILAR PROFILES</span>
            </div>
            <div className="at-anon-card">
              <table className="at-anon-table">
                <thead>
                  <tr>
                    <th>CLASS</th>
                    <th>IB</th>
                    <th>SAT</th>
                    <th>PROFILE NOTE</th>
                    <th>OUTCOME</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ANON.map((s, i) => (
                    <tr key={i}>
                      <td>{s.year}</td>
                      <td>{s.ib}</td>
                      <td>{s.sat}</td>
                      <td>{s.note}</td>
                      <td>
                        <div className="at-outcome-chips">
                          {s.outcomes.map((o, j) => (
                            <span key={j} className="at-outcome-chip">{o}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="at-anon-footer">
                About these numbers: Manhaji&apos;s internal model is trained on 5 years of applicant outcomes (50 senior classes). Match scores are indicative only — universities make the final call, and many things outside our data matter too. Use this as a planning aid, not a verdict.
              </div>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        <div className="at-sidebar">

          {/* Master docs */}
          <div className="at-side-card">
            <div className="at-side-label">YOUR MASTER DOCS</div>
            {live ? (
              masterDocs.length > 0 ? (
                <div className="at-doc-list">
                  {masterDocs.map(d => (
                    <div key={d.id} className="at-doc-row">
                      <span className="at-doc-icon ok">✓</span>
                      <div className="at-doc-info">
                        <div className="at-doc-name">{d.title ?? d.docType}</div>
                        <div className="at-doc-detail">
                          {d.docType} · uploaded {new Date(d.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="at-docs-empty">
                  <div className="at-docs-empty-title">Your advisor hasn&apos;t uploaded documents yet.</div>
                  <div className="at-docs-empty-sub">
                    Transcripts, reference letters and certificates will appear here once your
                    advisor adds them. Advisor uploads arrive in Phase 2.
                  </div>
                </div>
              )
            ) : (
              <div className="at-doc-list">
                {MOCK_DOCS.map((d, i) => (
                  <div key={i} className="at-doc-row">
                    <span className={`at-doc-icon${d.status === "uploaded" ? " ok" : d.status === "in_progress" ? " wip" : " miss"}`}>
                      {d.status === "uploaded" ? "✓" : d.status === "in_progress" ? "·" : "!"}
                    </span>
                    <div className="at-doc-info">
                      <div className="at-doc-name">{d.name}</div>
                      {d.detail && <div className="at-doc-detail">{d.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test scores */}
          <div className="at-side-card">
            <div className="at-side-label">TEST SCORES</div>
            <div className="at-scores-list">
              {(hasRealScores
                ? allScores.map(s => ({
                    name: s.testName,
                    score: s.scoreRaw ?? String(s.scoreNumeric ?? ""),
                    suffix: "",
                    note: s.takenOn ? `taken ${new Date(s.takenOn + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}` : undefined,
                  }))
                : MOCK_SCORES
              ).map((s, i) => (
                <div key={i} className="at-score-row">
                  <span className="at-score-name">{s.name}</span>
                  <span className="at-score-val">
                    {s.score}<span className="at-score-suffix">{s.suffix}</span>
                    {s.note && <span className="at-score-note"> · {s.note}</span>}
                  </span>
                </div>
              ))}
            </div>
            {!scoreFormOpen ? (
              <button className="at-score-add-btn" onClick={() => setScoreFormOpen(true)}>+ Add a score</button>
            ) : (
              <div className="at-score-form">
                <select className="stu-input" value={scoreTest} onChange={e => setScoreTest(e.target.value)} aria-label="Test">
                  {TEST_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {scoreTest === "Other…" && (
                  <input
                    className="stu-input"
                    value={scoreCustom}
                    onChange={e => setScoreCustom(e.target.value)}
                    placeholder="Test name"
                    aria-label="Custom test name"
                  />
                )}
                <div className="at-score-form-row">
                  <input
                    className="stu-input"
                    value={scoreValue}
                    onChange={e => setScoreValue(e.target.value)}
                    placeholder="Score (e.g. 1480)"
                    aria-label="Score"
                  />
                  <input
                    className="stu-input"
                    type="date"
                    value={scoreDate}
                    onChange={e => setScoreDate(e.target.value)}
                    aria-label="Date taken"
                  />
                </div>
                {scoreError && <div className="stu-form-error" role="alert">{scoreError}</div>}
                <div className="at-score-form-actions">
                  <button className="myg-action-btn" onClick={() => { setScoreFormOpen(false); setScoreError(null); }}>Cancel</button>
                  <button className="myg-action-btn primary" onClick={handleAddScore} disabled={scoreSaving}>
                    {scoreSaving ? "Saving…" : "Save score"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Study assistant — Phase 2 */}
          <div className="at-side-card at-assist-card">
            <div className="at-side-label">
              MANHAJI STUDY ASSISTANT <span className="myg-phase2-pill">PHASE 2</span>
            </div>
            <div className="at-assist-list">
              {STUDY_ASSIST.map((item, i) => (
                <div key={i} className="at-assist-item at-assist-item-static">
                  <span className="at-assist-arrow">›</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* Counsellor */}
          <div className="at-side-card">
            <div className="at-side-label">YOUR COUNSELLOR</div>
            <div className="at-counselor-row">
              <div className="at-counselor-avatar">
                {activeCounselor.name.split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join("")}
              </div>
              <div>
                <div className="at-counselor-name">{activeCounselor.name}</div>
                {activeCounselor.nextSession && (
                  <div className="at-counselor-next">Next session: {activeCounselor.nextSession}</div>
                )}
              </div>
            </div>
            {effectiveBooking ? (
              <div className="at-booking-state" role="status">
                <div className="at-booking-state-title">
                  {effectiveBooking.status === "confirmed" ? "✓ Session confirmed" : "Requested · awaiting counsellor confirmation"}
                </div>
                <div className="at-booking-state-sub">
                  {fmtDay(effectiveBooking.start)} · {fmtTime(effectiveBooking.start)}
                  {effectiveBooking.demo ? " · demo request (not sent)" : ""}
                </div>
              </div>
            ) : (
              <button className="at-book-btn" onClick={() => { setBookSlot(null); setBookError(null); setBookOpen(true); }}>
                Book a 1:1 session
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── Add-university modal ─────────────────────────────────────────── */}
      {addOpen && (
        <div className="stu-modal-bg" onClick={() => setAddOpen(false)}>
          <div className="stu-modal" role="dialog" aria-modal="true" aria-label="Add a university" onClick={e => e.stopPropagation()}>
            <div className="stu-modal-head">
              <h3>Add a university</h3>
              <button className="stu-modal-close" onClick={() => setAddOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="stu-modal-body">
              {!pickedUni ? (
                <>
                  <label className="stu-field">
                    <span className="stu-field-label">Search the university list</span>
                    <input
                      className="stu-input"
                      value={uniQuery}
                      onChange={e => setUniQuery(e.target.value)}
                      placeholder="Start typing — e.g. Toronto, Oxford, Sultan Qaboos…"
                      autoFocus
                    />
                  </label>
                  <div className="at-uni-results" role="listbox" aria-label="Matching universities">
                    {uniMatches.map(u => (
                      <button
                        key={u.id}
                        className="at-uni-result"
                        role="option"
                        aria-selected="false"
                        onClick={() => setPickedUni({ id: u.id, name: u.name, country: u.country })}
                      >
                        <span className="at-uni-result-name">{u.name}</span>
                        <span className="at-uni-result-meta">{u.country} · {u.region}</span>
                      </button>
                    ))}
                    {uniMatches.length === 0 && (
                      <button
                        className="at-uni-result"
                        onClick={() => setPickedUni({ id: null, name: uniQuery.trim(), country: "" })}
                      >
                        <span className="at-uni-result-name">Use &quot;{uniQuery.trim()}&quot;</span>
                        <span className="at-uni-result-meta">Not in the list — add as free text</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="at-uni-picked">
                    <div>
                      <div className="at-uni-result-name">{pickedUni.name}</div>
                      {pickedUni.country && <div className="at-uni-result-meta">{pickedUni.country}</div>}
                    </div>
                    <button className="myg-action-btn" onClick={() => setPickedUni(null)}>Change</button>
                  </div>
                  <label className="stu-field">
                    <span className="stu-field-label">Programme / course</span>
                    <input
                      className="stu-input"
                      value={formProgram}
                      onChange={e => setFormProgram(e.target.value)}
                      placeholder="e.g. BSc Computer Science"
                      autoFocus
                    />
                  </label>
                  <div className="stu-field-row">
                    <label className="stu-field">
                      <span className="stu-field-label">Where are you with it?</span>
                      <select
                        className="stu-input"
                        value={formStatus}
                        onChange={e => setFormStatus(e.target.value as UniversityAppStatus)}
                      >
                        {NEW_APP_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_CFG[s].label.toLowerCase()}</option>
                        ))}
                      </select>
                    </label>
                    <label className="stu-field">
                      <span className="stu-field-label">Deadline <em>(optional)</em></span>
                      <input className="stu-input" type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} />
                    </label>
                  </div>
                </>
              )}
              {addError && <div className="stu-form-error" role="alert">{addError}</div>}
            </div>
            <div className="stu-modal-foot">
              <button className="myg-action-btn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="myg-action-btn primary" onClick={handleAddUniversity} disabled={addSaving || !pickedUni}>
                {addSaving ? "Adding…" : "Add to my applications"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking modal ────────────────────────────────────────────────── */}
      {bookOpen && (
        <div className="stu-modal-bg" onClick={() => setBookOpen(false)}>
          <div className="stu-modal" role="dialog" aria-modal="true" aria-label="Book a 1:1 session" onClick={e => e.stopPropagation()}>
            <div className="stu-modal-head">
              <h3>Book a 1:1 with {activeCounselor.name}</h3>
              <button className="stu-modal-close" onClick={() => setBookOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="stu-modal-body">
              <div className="stu-modal-hint">
                Pick a slot that works for you — your counsellor confirms it (or suggests another time).
                Calendar sync arrives in Phase 2.
              </div>
              <div className="at-slot-grid">
                {slots.map(s => (
                  <button
                    key={s}
                    className={`at-slot${bookSlot === s ? " picked" : ""}`}
                    onClick={() => setBookSlot(s)}
                    aria-pressed={bookSlot === s}
                  >
                    <span className="at-slot-day">{fmtDay(s)}</span>
                    <span className="at-slot-time">{fmtTime(s)}</span>
                  </button>
                ))}
              </div>
              {bookError && <div className="stu-form-error" role="alert">{bookError}</div>}
            </div>
            <div className="stu-modal-foot">
              <button className="myg-action-btn" onClick={() => setBookOpen(false)}>Cancel</button>
              <button className="myg-action-btn primary" onClick={handleBook} disabled={bookSaving || !bookSlot}>
                {bookSaving ? "Sending…" : "Request this slot"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
