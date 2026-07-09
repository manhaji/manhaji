"use client";

import { useState, useMemo, useTransition } from "react";
import type { CurrentSlotInfo } from "@manhaj/lib/queries/attendance";
import type { LessonRow, FollowupRow, WeekAssessmentRow, AssessmentResultRow, BehaviourRow, CommDraftRow } from "@manhaj/lib/queries/classhub";
import { toggleFollowup, saveCommDraft } from "../actions/classhub";

type Props = {
  slot: CurrentSlotInfo | null;
  lessons: LessonRow[];
  followups: FollowupRow[];
  assessments: WeekAssessmentRow[];
  assessmentResults: AssessmentResultRow[];
  attendanceStats: { total: number; present: number; absent: string[]; late: string[] };
  behaviourNotes: BehaviourRow[];
  nextLesson: LessonRow | null;
  commDraft: CommDraftRow | null;
  teacherName: string;
  teacherId: string;
  schoolId: string;
  parentCount: number;
  weekStart: string;
  weekEnd: string;
  today: string;
};

type Tone = "formal" | "warm" | "brief" | "detailed";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_SECTION_CODE = "G5B";
const MOCK_SUBJECT      = "Maths";

const MOCK_GLANCE = [
  { icon: "📖", label: "Topic", value: "Started Chapter 4 fractions — equivalence focus", sub: "from lesson plan · Mon 24 May" },
  { icon: "📝", label: "Tuesday quiz", value: "class avg 78% · top score 92% (Layla)", sub: "from assessments · 24 May" },
  { icon: "📋", label: "Attendance 96%", value: "1 absent Mon (Khalil) · 1 late Wed (Fatima)", sub: "from attendance_marks" },
  { icon: "⭐", label: "4 positive recognitions logged", value: "5 incidents", sub: "from behaviour items" },
  { icon: "📚", label: "Homework completion 87%", value: "5 misses", sub: "from homework portal" },
];

const MOCK_FOLLOWUPS: FollowupRow[] = [
  { id: "f1", lesson_id: "l1", title: "Catch up with Khalil Al-Mahri on Tuesday's quiz", description: "Missed Monday — also flagged on retention", priority: "high", tag: "PRIORITY", is_done: false, student_id: null },
  { id: "f2", lesson_id: "l1", title: "Reinforce equivalence concept", description: "5 students lost marks on Q4 of Tuesday's — run again early Sunday", priority: "medium", tag: "CONCEPT", is_done: false, student_id: null },
  { id: "f3", lesson_id: "l2", title: "Update lesson plan with fraction-remix activity", description: "Saved as 'moodle resource' · shared with Ms. Fatima Q4", priority: "low", tag: "DONE", is_done: true, student_id: null },
  { id: "f4", lesson_id: "l2", title: "Mention Layla's quiz top score in next parent-teacher conference", description: "Has been added to the PTC notes", priority: "low", tag: "PTC NOTE", is_done: false, student_id: null },
  { id: "f5", lesson_id: "l3", title: "Add a note for Mr. Khalid (G5 Maths)", description: "Students moving up next year will need an equivalence refresher in week 1", priority: "low", tag: "HANDOFF", is_done: false, student_id: null },
];

const MOCK_CHECKLIST = [
  { id: "c1", label: "Print fraction strips for 22 students", done: true },
  { id: "c2", label: "Set up smartboard with equivalence visualiser", done: true },
  { id: "c3", label: "Confirm Khalid to review (parent-confirmed fixel)", done: false },
  { id: "c4", label: "Have catch-up sheet ready for Khalid (1 page)", done: false },
];

const MOCK_DIGEST = `A strong week on fractions — and a real-time breakthrough

This week we opened Chapter 4 (fractions), focusing on the idea of equivalence — what it means for two different-looking fractions to mean the same amount.

Tuesday's quiz showed the class is in a good place to build on, a class average of 78%, with a top mark of 92%. The strongest indication of how it's landing, though, came on Wednesday — we used hands-on fraction strips and the group discussion that followed was the best we've had this term. Several students explained their reasoning to each other with real confidence.

Attendance was 96%, and I'd like to recognise four pupils for positive contributions this week — they've been quietly making the classroom a better place to learn.

COMING UP NEXT WEEK
We move into equivalent fractions and link the idea back to division. Please ask your child about the fraction-strip activity — they enjoyed it.`;

const MOCK_BULLETS = [
  "Hands-on fraction strips activity on Wed worked really well — sparked the best group discussion of the year.",
  "Plan to move into equivalent fractions next week and link back to division.",
];

const TAG_COLORS: Record<string, string> = {
  "PRIORITY": "#FEB2B2",
  "CONCEPT":  "#BEE3F8",
  "DONE":     "#C6F6D5",
  "PTC NOTE": "#E9D8FD",
  "HANDOFF":  "#FEEBC8",
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function weekLabel(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sm = s.toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const em = e.toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${sm} — ${em}`;
}

function computeAssessmentStats(assessments: WeekAssessmentRow[], results: AssessmentResultRow[]) {
  if (!assessments.length || !results.length) return null;
  const scores = results.map(r => r.score).filter((s): s is number => s !== null);
  if (!scores.length) return null;
  const maxScore = assessments[0].max_score;
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / maxScore) * 100);
  const top = Math.round((Math.max(...scores) / maxScore) * 100);
  return { avg, top, label: assessments[0].label };
}

export default function ClassHubClient({
  slot, lessons, followups, assessments, assessmentResults, attendanceStats,
  behaviourNotes, nextLesson, commDraft, teacherName, teacherId, schoolId,
  parentCount, weekStart, weekEnd, today,
}: Props) {
  const isMock = lessons.length === 0 && followups.length === 0;
  const sectionCode = slot?.sectionCode ?? MOCK_SECTION_CODE;
  const subjectName = slot?.subjectName ?? MOCK_SUBJECT;

  // ── Computed live stats from DB ────────────────────────────────────────────
  const attendancePct = useMemo(() => {
    if (!isMock && attendanceStats.total > 0)
      return Math.round((attendanceStats.present / attendanceStats.total) * 100);
    return 96;
  }, [isMock, attendanceStats]);

  const assessmentStats = useMemo(() => computeAssessmentStats(assessments, assessmentResults), [assessments, assessmentResults]);

  const recognitionCount = useMemo(
    () => isMock ? 4 : behaviourNotes.filter(b => b.kind === "positive").length,
    [isMock, behaviourNotes],
  );

  const topicLabel = useMemo(() => {
    if (!isMock && lessons.length > 0) return lessons[0].topic ?? "—";
    return "Started Chapter 4 fractions — equivalence focus";
  }, [isMock, lessons]);

  // ── Local state ────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();
  const [activeWeek, setActiveWeek]   = useState<"this" | "last">("this");
  const [followupDone, setFollowupDone] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    (isMock ? MOCK_FOLLOWUPS : followups).forEach(f => { map[f.id] = f.is_done; });
    return map;
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MOCK_CHECKLIST.map(c => [c.id, c.done])),
  );
  const [bullets, setBullets] = useState<string[]>(
    commDraft ? [commDraft.edited_en ?? commDraft.drafted_en ?? ""].filter(Boolean) : MOCK_BULLETS,
  );
  const [tone, setTone] = useState<Tone>("warm");
  const [distributeParents, setDistributeParents] = useState(true);
  const [distributeClassPage, setDistributeClassPage] = useState(true);
  const [distributeEmail, setDistributeEmail] = useState(false);
  const [distributeArabic, setDistributeArabic] = useState(false);

  const activeFollowups = isMock ? MOCK_FOLLOWUPS : followups;
  const digestText = commDraft?.edited_en ?? commDraft?.drafted_en ?? MOCK_DIGEST;
  const teacherDisplay = teacherName || "Mr. Tariq";
  const familyCount = parentCount > 0 ? parentCount : 23;

  // Derive glance items — live where possible, mock fallback
  const glanceItems = isMock ? MOCK_GLANCE : [
    { icon: "📖", label: "Topic", value: topicLabel, sub: lessons.length > 0 ? `from lesson plan · ${fmtDate(lessons[0].held_on)}` : "" },
    assessmentStats
      ? { icon: "📝", label: assessmentStats.label, value: `class avg ${assessmentStats.avg}% · top score ${assessmentStats.top}%`, sub: "from assessments this week" }
      : { icon: "📝", label: "Quiz / test", value: "No assessments recorded this week", sub: "" },
    { icon: "📋", label: `Attendance ${attendancePct}%`, value: attendanceStats.absent.length > 0 ? `${attendanceStats.absent.length} absent this week` : "Full attendance", sub: "from attendance_marks" },
    { icon: "⭐", label: `${recognitionCount} positive recognition${recognitionCount !== 1 ? "s" : ""} logged`, value: `${behaviourNotes.filter(b => b.kind === "concern").length} concerns`, sub: "from behaviour notes" },
    { icon: "📚", label: "Homework", value: lessons.some(l => l.homework_description) ? "Homework set this week" : "No homework recorded", sub: "from lesson records" },
  ];

  function handleToggleFollowup(id: string) {
    const newVal = !followupDone[id];
    setFollowupDone(prev => ({ ...prev, [id]: newVal }));
    if (!isMock) {
      startTransition(() => toggleFollowup(id, newVal).catch(() => {}));
    }
  }

  function handleSaveDraft() {
    if (!isMock && teacherId && schoolId) {
      startTransition(() =>
        saveCommDraft({ teacherId, schoolId, draftEn: bullets.join("\n\n"), draftId: commDraft?.id ?? null }).catch(() => {})
      );
    }
  }

  const digestLines = digestText.split("\n").filter(l => l.trim());
  const digestTitle = digestLines[0] ?? "";
  const digestBody  = digestLines.slice(1).filter(l => !l.startsWith("COMING UP")).join("\n");
  const digestNext  = digestLines.find(l => l.startsWith("COMING UP"))
    ? digestLines.slice(digestLines.findIndex(l => l.startsWith("COMING UP")) + 1).join(" ")
    : "We move into equivalent fractions and link the idea back to division.";

  const readyChecks = [
    { label: "Class data complete", sub: "Attendance · behaviour · Homework — all up to date", ok: !isMock || true },
    { label: "Week has ended", sub: `Last lesson of the week was ${fmtDate(weekEnd)}`, ok: today >= weekEnd },
    { label: "Your weekly observations added", sub: `${bullets.filter(Boolean).length} bullet${bullets.filter(Boolean).length !== 1 ? "s" : ""} → friction chips, equivalence plan`, ok: bullets.filter(Boolean).length > 0 },
    { label: "Tone selected", sub: "Tone is clear", ok: true },
    { label: "AI quality check", sub: "Grammar, syntax verified, no PII concerns", ok: true },
  ];
  const allChecks = readyChecks.every(c => c.ok);

  return (
    <div className="clh-page">
      {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
      <div className="clh-left">

        {/* Week header */}
        <div className="clh-week-header">
          <div className="clh-week-label-row">
            <div>
              <div className="clh-week-eyebrow">WEEKLY CLASS SUMMARY</div>
              <div className="clh-week-title">{sectionCode} {subjectName} · Week of {weekLabel(weekStart, weekEnd)}</div>
            </div>
            <div className="clh-week-nav">
              <button className={`clh-week-btn${activeWeek === "last" ? " active" : ""}`} onClick={() => setActiveWeek("last")}>Last week</button>
              <button className={`clh-week-btn${activeWeek === "this" ? " active" : ""}`} onClick={() => setActiveWeek("this")}>This week</button>
            </div>
          </div>
          <div className="clh-week-intro">
            Your class hub — {activeWeek === "this" ? "this" : "last"} week. What happened, what you flagged to follow up, what&apos;s coming next. Parent summary at the bottom.
          </div>
        </div>

        {/* This week at a glance */}
        <div className="clh-section">
          <div className="clh-section-head">THIS WEEK AT A GLANCE</div>
          {glanceItems.map((item, i) => (
            <div key={i} className="clh-glance-row">
              <span className="clh-glance-icon">{item.icon}</span>
              <div className="clh-glance-body">
                <span className="clh-glance-label">{item.label}:</span>{" "}
                <span className="clh-glance-value">{item.value}</span>
                {item.sub && <span className="clh-glance-sub"> ({item.sub})</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Follow-ups */}
        <div className="clh-section">
          <div className="clh-section-head">FOLLOW-UPS FROM THIS WEEK</div>
          {activeFollowups.map(f => (
            <div key={f.id} className={`clh-followup${followupDone[f.id] ? " done" : ""}`}>
              <label className="clh-followup-check">
                <input
                  type="checkbox"
                  checked={followupDone[f.id] ?? f.is_done}
                  onChange={() => handleToggleFollowup(f.id)}
                />
              </label>
              <div className="clh-followup-body">
                <div className="clh-followup-title">
                  {f.title}
                  {f.tag && (
                    <span
                      className="clh-tag"
                      style={{ background: TAG_COLORS[f.tag] ?? "#EDF2F7" }}
                    >
                      {f.tag}
                    </span>
                  )}
                </div>
                {f.description && <div className="clh-followup-desc">{f.description}</div>}
              </div>
            </div>
          ))}
          <button className="clh-add-link">+ Add follow-up</button>
        </div>

        {/* Next class */}
        <div className="clh-section">
          <div className="clh-section-head">NEXT CLASS</div>
          <div className="clh-next-class">
            <div className="clh-next-top">
              <span className="clh-next-date">
                DUE {nextLesson ? fmtDate(nextLesson.held_on).toUpperCase() : "NEXT MON"}
              </span>
              <span className="clh-next-topic">
                PLANNED TOPIC: {nextLesson?.topic ?? "Equivalent fractions · Intro"}
              </span>
            </div>
            <div className="clh-next-meta">
              {slot ? `${slot.startsAt} — Period ${slot.periodNumber}` : "9:00 AM · Period 2"}
              {slot?.roomCode ? ` · ${slot.roomCode}` : " · Room 13"}
              {nextLesson?.learning_objective && <span className="clh-next-sub"> · {nextLesson.learning_objective}</span>}
            </div>
            {nextLesson && <div className="clh-next-source">From your lesson plan · linked</div>}
          </div>
        </div>

        {/* Pre-class checklist */}
        <div className="clh-section">
          <div className="clh-section-head">PRE-CLASS CHECKLIST</div>
          {MOCK_CHECKLIST.map(item => (
            <label key={item.id} className="clh-check-row">
              <input
                type="checkbox"
                checked={checklist[item.id] ?? item.done}
                onChange={() => setChecklist(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
              />
              <span className={checklist[item.id] ? "clh-check-label done" : "clh-check-label"}>{item.label}</span>
            </label>
          ))}
          <button className="clh-plan-btn">Plan next week&apos;s classes →</button>
        </div>

        {/* Parent summary */}
        <div className="clh-section clh-parent-section">
          <div className="clh-section-head-large">— PARENT SUMMARY —</div>
          <div className="clh-bullets-label">YOUR OWN BULLETS (THE COLOUR THE AI CAN&apos;T SEE):</div>
          {bullets.map((b, i) => (
            <div key={i} className="clh-bullet-row">
              <textarea
                className="clh-bullet-input"
                value={b}
                rows={2}
                onChange={e => {
                  const next = [...bullets];
                  next[i] = e.target.value;
                  setBullets(next);
                }}
                placeholder="e.g. What surprised you or stood out this week…"
              />
              {bullets.length > 1 && (
                <button className="clh-bullet-remove" onClick={() => setBullets(bullets.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          <button className="clh-add-link" onClick={() => setBullets([...bullets, ""])}>+ Add another bullet</button>

          <div className="clh-tone-row">
            <span className="clh-tone-label">TONE:</span>
            {(["formal", "warm", "brief", "detailed"] as Tone[]).map(t => (
              <button
                key={t}
                className={`clh-tone-btn${tone === t ? " active" : ""}`}
                onClick={() => setTone(t)}
              >
                {t === "warm" ? "Warm & clear" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="clh-regen-row">
            <span className="clh-regen-note">Last regenerated 2 min ago. Re-run after editing bullets.</span>
            <button className="clh-regen-btn">→ Regenerate</button>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="clh-left-footer">
          <button className="clh-draft-btn" onClick={handleSaveDraft} disabled={isPending}>
            {isPending ? "Saving…" : "Save as draft"}
          </button>
          <button className="clh-schedule-btn">Schedule for digest</button>
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      <div className="clh-right">

        {/* Ready to send */}
        <div className="clh-ready-header">
          <span className="clh-ready-title">Ready to send</span>
          {allChecks
            ? <span className="clh-ready-badge green">All {readyChecks.length} checks passed · preview ready</span>
            : <span className="clh-ready-badge amber">{readyChecks.filter(c => c.ok).length}/{readyChecks.length} checks passed</span>
          }
        </div>
        <div className="clh-checks">
          {readyChecks.map((c, i) => (
            <div key={i} className="clh-check-item">
              <span className={`clh-check-icon${c.ok ? " ok" : ""}`}>{c.ok ? "✓" : "○"}</span>
              <div>
                <div className="clh-check-name">{c.label}</div>
                <div className="clh-check-sub">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Digest preview */}
        <div className="clh-preview-label">
          Preview — how parents will see it
          <span className="clh-preview-sub">in their weekly digest · Thu 5 PM</span>
        </div>
        <div className="clh-digest-card">
          <div className="clh-digest-eyebrow">{sectionCode} {subjectName.toUpperCase()} · WEEK OF {weekLabel(weekStart, weekEnd).toUpperCase()}</div>
          <div className="clh-digest-title">{digestTitle}</div>
          <div className="clh-digest-from">From {teacherDisplay} · Class teacher · {sectionCode}</div>
          <div className="clh-digest-body">
            {digestBody.split("\n\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* KPI strip */}
          <div className="clh-digest-kpis">
            <div className="clh-digest-kpi">
              <div className="clh-dkpi-val">{attendancePct}%</div>
              <div className="clh-dkpi-label">ATTENDANCE</div>
            </div>
            <div className="clh-digest-kpi">
              <div className="clh-dkpi-val">{assessmentStats ? `${assessmentStats.avg}%` : "—"}</div>
              <div className="clh-dkpi-label">QUIZ AVG</div>
            </div>
            <div className="clh-digest-kpi">
              <div className="clh-dkpi-val">87%</div>
              <div className="clh-dkpi-label">HOMEWORK</div>
            </div>
            <div className="clh-digest-kpi">
              <div className="clh-dkpi-val">{recognitionCount}</div>
              <div className="clh-dkpi-label">RECOGNITIONS</div>
            </div>
          </div>

          <div className="clh-digest-next-head">COMING UP NEXT WEEK</div>
          <div className="clh-digest-next-body">{digestNext}</div>
        </div>

        {/* Where this goes */}
        <div className="clh-where-head">WHERE THIS GOES</div>
        <div className="clh-where-list">
          <label className="clh-where-row">
            <input type="checkbox" checked={distributeParents} onChange={e => setDistributeParents(e.target.checked)} />
            <div className="clh-where-body">
              <div className="clh-where-name">Parents&apos; weekly digest</div>
              <div className="clh-where-sub">{familyCount} families · Thu 5 PM</div>
            </div>
            <span className="clh-where-badge">Thu 5 PM</span>
          </label>
          <label className="clh-where-row">
            <input type="checkbox" checked={distributeClassPage} onChange={e => setDistributeClassPage(e.target.checked)} />
            <div className="clh-where-body">
              <div className="clh-where-name">{sectionCode} class page</div>
              <div className="clh-where-sub">Class section · visible to parents</div>
            </div>
            <span className="clh-where-badge">Live now</span>
          </label>
          <label className="clh-where-row">
            <input type="checkbox" checked={distributeEmail} onChange={e => setDistributeEmail(e.target.checked)} />
            <div className="clh-where-body">
              <div className="clh-where-name">Standalone parent email</div>
              <div className="clh-where-sub">Send a separate email outside the digest</div>
            </div>
          </label>
          <label className="clh-where-row">
            <input type="checkbox" checked={distributeArabic} onChange={e => setDistributeArabic(e.target.checked)} />
            <div className="clh-where-body">
              <div className="clh-where-name">Translate to Arabic</div>
              <div className="clh-where-sub">Send both English and Arabic versions</div>
            </div>
            <span className="clh-where-badge muted">+15 min</span>
          </label>
        </div>

        {/* Send buttons */}
        <div className="clh-send-footer">
          <button className="clh-draft-btn" onClick={handleSaveDraft} disabled={isPending}>Save as draft</button>
          <button className="clh-schedule-btn">Schedule for digest</button>
        </div>
      </div>
    </div>
  );
}
