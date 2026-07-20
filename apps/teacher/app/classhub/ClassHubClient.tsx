"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CurrentSlotInfo } from "@manhaj/lib/queries/attendance";
import type {
  LessonRow, FollowupRow, WeekAssessmentRow, AssessmentResultRow,
  BehaviourRow, CommDraftRow, SectionOption, ChecklistItem,
} from "@manhaj/lib/queries/classhub";
import {
  toggleFollowup, saveCommDraft, addFollowup, saveNextWeekPlan, savePreClassChecklist,
} from "../actions/classhub";

export type WeekView = "last" | "this" | "next";

type Props = {
  slot: CurrentSlotInfo | null;
  lessons: LessonRow[];
  followups: FollowupRow[];
  assessments: WeekAssessmentRow[];
  assessmentResults: AssessmentResultRow[];
  attendanceStats: { total: number; present: number; absent: string[]; late: string[] };
  behaviourNotes: BehaviourRow[];
  nextLesson: LessonRow | null;
  /** The lesson row inside NEXT week (if any) — target of the Next Week planner. */
  nextWeekLesson: LessonRow | null;
  /** Monday of next week — used as held_on when the planner creates the lesson. */
  nextWeekStart: string;
  commDraft: CommDraftRow | null;
  teacherName: string;
  teacherId: string;
  schoolId: string;
  parentCount: number;
  weekStart: string;
  weekEnd: string;
  today: string;
  weekView: WeekView;
  sectionOptions: SectionOption[];
  selectedSectionId: string | null;
  selectedSubjectId: string | null;
  sectionStudents: { id: string; name: string }[];
};

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

const MOCK_CHECKLIST: ChecklistItem[] = [
  { label: "Print fraction strips for 22 students", done: true },
  { label: "Set up smartboard with equivalence visualiser", done: true },
  { label: "Confirm Khalid to review (parent-confirmed fixel)", done: false },
  { label: "Have catch-up sheet ready for Khalid (1 page)", done: false },
];

const MOCK_PLAN_NOTES = "Equivalent fractions · Intro — open with the fraction-strips recap, then link equivalence back to division. Finish with examples 1–5 in pairs.";

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
  "FOLLOW-UP": "#BEE3F8",
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
  behaviourNotes, nextLesson, nextWeekLesson, nextWeekStart, commDraft,
  teacherName, teacherId, schoolId, parentCount, weekStart, weekEnd, today,
  weekView, sectionOptions, selectedSectionId, selectedSubjectId, sectionStudents,
}: Props) {
  const router = useRouter();
  const hasRealSection = !!(selectedSectionId && schoolId && teacherId);
  const isMock = !hasRealSection && lessons.length === 0 && followups.length === 0;

  const selectedOption = sectionOptions.find(o => o.sectionId === selectedSectionId) ?? null;
  const sectionCode = selectedOption?.code ?? slot?.sectionCode ?? MOCK_SECTION_CODE;
  const subjectName = selectedOption?.subjectName ?? slot?.subjectName ?? MOCK_SUBJECT;

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
  const [followupDone, setFollowupDone] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    (isMock ? MOCK_FOLLOWUPS : followups).forEach(f => { map[f.id] = f.is_done; });
    return map;
  });
  // Demo-only follow-ups added via the pop-up when no DB section is available.
  const [localFollowups, setLocalFollowups] = useState<FollowupRow[]>([]);

  // Pre-class checklist: real jsonb from the upcoming lesson, OR demo.
  const checklistSourceLesson = nextWeekLesson ?? nextLesson;
  const realChecklist = checklistSourceLesson?.pre_class_checklist ?? [];
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    realChecklist.length > 0 ? realChecklist : MOCK_CHECKLIST,
  );
  const checklistIsReal = !!checklistSourceLesson && realChecklist.length > 0;

  // Next-week planner state.
  const [planNotes, setPlanNotes] = useState<string>(
    nextWeekLesson?.plan_notes ?? (hasRealSection ? "" : MOCK_PLAN_NOTES),
  );
  const [planChecklist, setPlanChecklist] = useState<ChecklistItem[]>(
    nextWeekLesson && nextWeekLesson.pre_class_checklist.length > 0
      ? nextWeekLesson.pre_class_checklist
      : hasRealSection ? [] : MOCK_CHECKLIST,
  );
  const [newItemLabel, setNewItemLabel] = useState("");
  const [planSaved, setPlanSaved] = useState<null | "ok" | string>(null);
  const [savedLessonId, setSavedLessonId] = useState<string | null>(nextWeekLesson?.id ?? null);

  // Upload-homework control (file-select UI; storage upload is Phase 2).
  const [homeworkFile, setHomeworkFile] = useState<string | null>(null);

  // Add-follow-up pop-up.
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [fuTitle, setFuTitle] = useState("");
  const [fuDesc, setFuDesc] = useState("");
  const [fuDue, setFuDue] = useState("");
  const [fuStudent, setFuStudent] = useState("");
  const [fuPriority, setFuPriority] = useState<"high" | "medium" | "low">("medium");
  const [fuError, setFuError] = useState<string | null>(null);
  const [fuSaving, setFuSaving] = useState(false);

  // Parent-summary bullet editor removed (Sprint 1.5) — bullets still feed the
  // readiness checks and draft save until the Phase-2 digest composer lands.
  const [bullets] = useState<string[]>(
    commDraft ? [commDraft.edited_en ?? commDraft.drafted_en ?? ""].filter(Boolean) : MOCK_BULLETS,
  );
  const [distributeParents, setDistributeParents] = useState(true);
  const [distributeClassPage, setDistributeClassPage] = useState(true);
  const [distributeEmail, setDistributeEmail] = useState(false);
  const [distributeArabic, setDistributeArabic] = useState(false);

  const activeFollowups = [...(isMock ? MOCK_FOLLOWUPS : followups), ...localFollowups];
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

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navTo(section: string | null, week: WeekView) {
    const params = new URLSearchParams();
    if (section) params.set("section", section);
    params.set("week", week);
    router.push(`?${params.toString()}`);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleToggleFollowup(id: string) {
    const newVal = !followupDone[id];
    setFollowupDone(prev => ({ ...prev, [id]: newVal }));
    if (!isMock && !id.startsWith("local-")) {
      startTransition(() => toggleFollowup(id, newVal).catch(() => {}));
    }
  }

  function handleToggleChecklist(idx: number) {
    const updated = checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    setChecklist(updated);
    if (checklistIsReal && checklistSourceLesson) {
      startTransition(() => savePreClassChecklist(checklistSourceLesson.id, updated).catch(() => {}));
    }
  }

  function handleSavePlan() {
    setPlanSaved(null);
    if (!hasRealSection || !selectedSubjectId) {
      setPlanSaved("ok");   // demo mode — keep the button honest but local
      return;
    }
    startTransition(async () => {
      const res = await saveNextWeekPlan({
        lessonId: savedLessonId,
        schoolId,
        sectionId: selectedSectionId!,
        subjectId: selectedSubjectId,
        teacherId,
        heldOn: nextWeekLesson?.held_on ?? nextWeekStart,
        planNotes,
        checklist: planChecklist,
      }).catch(e => ({ ok: false as const, error: String(e), lessonId: undefined }));
      if (res.ok) {
        setPlanSaved("ok");
        if (res.lessonId) setSavedLessonId(res.lessonId);
      } else {
        setPlanSaved(res.error ?? "Could not save the plan.");
      }
    });
  }

  function addPlanItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    setPlanChecklist(prev => [...prev, { label, done: false }]);
    setNewItemLabel("");
  }

  function openFollowupModal() {
    setFuTitle(""); setFuDesc(""); setFuDue(""); setFuStudent("");
    setFuPriority("medium"); setFuError(null);
    setShowFollowupModal(true);
  }

  function handleSaveFollowup() {
    if (!fuTitle.trim()) { setFuError("Give the follow-up a title."); return; }
    setFuError(null);

    if (!hasRealSection) {
      // Demo mode — show it in the pending list locally.
      setLocalFollowups(prev => [...prev, {
        id: `local-${Date.now()}`,
        lesson_id: null,
        title: fuTitle.trim(),
        description: fuDesc.trim() || null,
        priority: fuPriority,
        tag: "FOLLOW-UP",
        is_done: false,
        student_id: fuStudent || null,
        due_date: fuDue || null,
      }]);
      setShowFollowupModal(false);
      return;
    }

    setFuSaving(true);
    startTransition(async () => {
      const res = await addFollowup({
        schoolId,
        teacherId,
        sectionId: selectedSectionId!,
        title: fuTitle,
        description: fuDesc || null,
        dueDate: fuDue || null,
        studentId: fuStudent || null,
        priority: fuPriority,
      }).catch(e => ({ ok: false as const, error: String(e) }));
      setFuSaving(false);
      if (res.ok) {
        setShowFollowupModal(false);
        router.refresh();   // pending list re-reads lesson_followups
      } else {
        setFuError(res.error ?? "Could not save the follow-up.");
      }
    });
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

  const weekEyebrow = weekView === "next" ? "NEXT WEEK · PLAN" : "WEEKLY CLASS SUMMARY";
  const weekIntro = weekView === "next"
    ? "Plan the next class — summary, pre-class checklist, and homework. The substitute sheet and student views read from this."
    : `Your class hub — ${weekView === "this" ? "this" : "last"} week. What happened, what you flagged to follow up, what's coming next.`;

  return (
    <div className="clh-page">
      {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
      <div className="clh-left">

        {/* Week header */}
        <div className="clh-week-header">
          <div className="clh-week-label-row">
            <div>
              <div className="clh-week-eyebrow">{weekEyebrow}</div>
              <div className="clh-week-title">{sectionCode} {subjectName} · Week of {weekLabel(weekStart, weekEnd)}</div>
              {sectionOptions.length > 0 && (
                <div className="clh-section-select-wrap">
                  <label className="clh-section-select-label" htmlFor="clh-section-select">Class</label>
                  <select
                    id="clh-section-select"
                    className="clh-section-select"
                    value={selectedSectionId ?? ""}
                    onChange={e => navTo(e.target.value, weekView)}
                  >
                    {sectionOptions.map(o => (
                      <option key={`${o.sectionId}-${o.subjectId}`} value={o.sectionId}>
                        {o.gradeLevel ? `${o.gradeLevel} ` : ""}{o.code} · {o.subjectName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="clh-week-nav">
              <button className={`clh-week-btn${weekView === "last" ? " active" : ""}`} onClick={() => navTo(selectedSectionId, "last")}>Last week</button>
              <button className={`clh-week-btn${weekView === "this" ? " active" : ""}`} onClick={() => navTo(selectedSectionId, "this")}>This week</button>
              <button className={`clh-week-btn${weekView === "next" ? " active" : ""}`} onClick={() => navTo(selectedSectionId, "next")}>Next week</button>
            </div>
          </div>
          <div className="clh-week-intro">{weekIntro}</div>
        </div>

        {weekView === "next" ? (
          <>
            {/* ── NEXT WEEK PLANNER (absorbs the old Input page) ─────────── */}
            <div className="clh-section">
              <div className="clh-section-head">NEXT CLASS SUMMARY</div>
              <p className="clh-plan-hint">
                What will you cover {nextWeekLesson ? `on ${fmtDate(nextWeekLesson.held_on)}` : `the week of ${fmtDate(nextWeekStart)}`}?
                Saved to the lesson plan — the substitute sheet reads this too.
              </p>
              <textarea
                className="clh-plan-textarea"
                rows={5}
                value={planNotes}
                onChange={e => setPlanNotes(e.target.value)}
                placeholder="e.g. Equivalent fractions — open with the strips recap, link equivalence back to division, finish with paired examples 1–5."
                aria-label="Next class summary"
              />
            </div>

            <div className="clh-section">
              <div className="clh-section-head">PRE-CLASS CHECKLIST</div>
              {planChecklist.length === 0 && (
                <p className="clh-plan-hint">Nothing yet — add what you need ready before class.</p>
              )}
              {planChecklist.map((item, i) => (
                <div key={i} className="clh-check-row clh-check-row-edit">
                  <label className="clh-check-row-label">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => setPlanChecklist(prev => prev.map((c, j) => j === i ? { ...c, done: !c.done } : c))}
                    />
                    <span className={item.done ? "clh-check-label done" : "clh-check-label"}>{item.label}</span>
                  </label>
                  <button
                    type="button"
                    className="clh-check-remove"
                    aria-label={`Remove checklist item: ${item.label}`}
                    onClick={() => setPlanChecklist(prev => prev.filter((_, j) => j !== i))}
                  >✕</button>
                </div>
              ))}
              <div className="clh-check-add-row">
                <input
                  type="text"
                  className="clh-check-add-input"
                  placeholder="Add a checklist item…"
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPlanItem(); } }}
                  aria-label="New checklist item"
                />
                <button type="button" className="clh-check-add-btn" onClick={addPlanItem}>Add</button>
              </div>
            </div>

            <div className="clh-section">
              <div className="clh-section-head">HOMEWORK</div>
              <div className="clh-hw-actions">
                <button type="button" className="clh-hw-btn phase2" disabled aria-disabled="true">
                  Generate homework with AI
                  <span className="clh-phase2-chip">Phase 2</span>
                </button>
                <label className="clh-hw-btn upload">
                  Upload homework
                  <input
                    type="file"
                    className="clh-hw-file-input"
                    accept=".pdf,.doc,.docx,.png,.jpg"
                    onChange={e => setHomeworkFile(e.target.files?.[0]?.name ?? null)}
                  />
                </label>
              </div>
              {homeworkFile && (
                <div className="clh-hw-file-note">
                  Selected: <strong>{homeworkFile}</strong> — file storage lands in Phase 2 (bucket pending); the selection is not uploaded yet.
                </div>
              )}
            </div>

            {/* Follow-ups stay reachable from the planner too */}
            <div className="clh-section">
              <div className="clh-section-head">PENDING FOLLOW-UPS</div>
              {activeFollowups.filter(f => !(followupDone[f.id] ?? f.is_done)).length === 0 && (
                <p className="clh-plan-hint">No open follow-ups for this class.</p>
              )}
              {activeFollowups.filter(f => !(followupDone[f.id] ?? f.is_done)).map(f => (
                <div key={f.id} className="clh-followup">
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
                        <span className="clh-tag" style={{ background: TAG_COLORS[f.tag] ?? "#EDF2F7" }}>{f.tag}</span>
                      )}
                    </div>
                    {f.description && <div className="clh-followup-desc">{f.description}</div>}
                    {f.due_date && <div className="clh-followup-desc">Due {fmtDate(f.due_date)}</div>}
                  </div>
                </div>
              ))}
              <button className="clh-add-link" onClick={openFollowupModal}>+ Add follow-up</button>
            </div>

            <div className="clh-left-footer">
              <button className="clh-draft-btn" onClick={handleSavePlan} disabled={isPending}>
                {isPending ? "Saving…" : "Save next-week plan"}
              </button>
              {planSaved === "ok" && <span className="clh-plan-saved">✓ Plan saved</span>}
              {planSaved && planSaved !== "ok" && <span className="clh-plan-error" role="alert">{planSaved}</span>}
            </div>
          </>
        ) : (
          <>
            {/* This week at a glance */}
            <div className="clh-section">
              <div className="clh-section-head">{weekView === "last" ? "LAST WEEK AT A GLANCE" : "THIS WEEK AT A GLANCE"}</div>
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
              <div className="clh-section-head">FOLLOW-UPS</div>
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
                    {f.due_date && <div className="clh-followup-desc">Due {fmtDate(f.due_date)}</div>}
                  </div>
                </div>
              ))}
              <button className="clh-add-link" onClick={openFollowupModal}>+ Add follow-up</button>
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
                    PLANNED TOPIC: {nextLesson?.topic ?? nextLesson?.plan_notes?.slice(0, 60) ?? "Equivalent fractions · Intro"}
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
              {checklist.map((item, i) => (
                <label key={i} className="clh-check-row">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklist(i)}
                  />
                  <span className={item.done ? "clh-check-label done" : "clh-check-label"}>{item.label}</span>
                </label>
              ))}
              <button className="clh-plan-btn" onClick={() => navTo(selectedSectionId, "next")}>
                Plan next week&apos;s classes →
              </button>
            </div>

            {/* Footer buttons */}
            <div className="clh-left-footer">
              <button className="clh-draft-btn" onClick={handleSaveDraft} disabled={isPending}>
                {isPending ? "Saving…" : "Save as draft"}
              </button>
              <button className="clh-schedule-btn">Schedule for digest</button>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      {weekView === "next" ? (
        <div className="clh-right">
          <div className="clh-ready-header">
            <span className="clh-ready-title">Where this plan goes</span>
          </div>
          <div className="clh-checks">
            <div className="clh-check-item">
              <span className="clh-check-icon ok">✓</span>
              <div>
                <div className="clh-check-name">Substitute handoff sheet</div>
                <div className="clh-check-sub">A covering teacher sees this summary and checklist for {sectionCode} automatically.</div>
              </div>
            </div>
            <div className="clh-check-item">
              <span className="clh-check-icon ok">✓</span>
              <div>
                <div className="clh-check-name">Your class hub · Next class</div>
                <div className="clh-check-sub">The This-week view shows the plan under &ldquo;Next class&rdquo; once saved.</div>
              </div>
            </div>
            <div className="clh-check-item">
              <span className="clh-check-icon">○</span>
              <div>
                <div className="clh-check-name">Student homework tab</div>
                <div className="clh-check-sub">Homework generation and uploads connect in Phase 2.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* ── ADD FOLLOW-UP POP-UP ─────────────────────────────────────────── */}
      {showFollowupModal && (
        <div className="clh-modal-overlay" role="presentation" onClick={() => setShowFollowupModal(false)}>
          <div
            className="clh-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add follow-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="clh-modal-head">
              <span className="clh-modal-title">Add follow-up · {sectionCode}</span>
              <button type="button" className="clh-modal-close" onClick={() => setShowFollowupModal(false)} aria-label="Close">✕</button>
            </div>

            <label className="clh-modal-label" htmlFor="fu-title">Title</label>
            <input
              id="fu-title"
              type="text"
              className="clh-modal-input"
              value={fuTitle}
              onChange={e => setFuTitle(e.target.value)}
              placeholder="e.g. Catch up with Khalil on Tuesday's quiz"
              autoFocus
            />

            <label className="clh-modal-label" htmlFor="fu-desc">Description <span className="clh-modal-opt">(optional)</span></label>
            <textarea
              id="fu-desc"
              className="clh-modal-input"
              rows={3}
              value={fuDesc}
              onChange={e => setFuDesc(e.target.value)}
              placeholder="Any detail the future you (or a substitute) needs."
            />

            <div className="clh-modal-row">
              <div className="clh-modal-col">
                <label className="clh-modal-label" htmlFor="fu-due">Due date <span className="clh-modal-opt">(optional)</span></label>
                <input
                  id="fu-due"
                  type="date"
                  className="clh-modal-input"
                  value={fuDue}
                  onChange={e => setFuDue(e.target.value)}
                />
              </div>
              <div className="clh-modal-col">
                <label className="clh-modal-label" htmlFor="fu-priority">Priority</label>
                <select
                  id="fu-priority"
                  className="clh-modal-input"
                  value={fuPriority}
                  onChange={e => setFuPriority(e.target.value as "high" | "medium" | "low")}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <label className="clh-modal-label" htmlFor="fu-student">Student <span className="clh-modal-opt">(optional)</span></label>
            <select
              id="fu-student"
              className="clh-modal-input"
              value={fuStudent}
              onChange={e => setFuStudent(e.target.value)}
            >
              <option value="">Whole class</option>
              {sectionStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {fuError && <div className="clh-modal-error" role="alert">{fuError}</div>}

            <div className="clh-modal-actions">
              <button type="button" className="clh-schedule-btn" onClick={() => setShowFollowupModal(false)}>Cancel</button>
              <button type="button" className="clh-draft-btn" onClick={handleSaveFollowup} disabled={fuSaving}>
                {fuSaving ? "Saving…" : "Save follow-up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
