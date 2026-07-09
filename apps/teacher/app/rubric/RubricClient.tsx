"use client";

import { useState, useMemo, useTransition } from "react";
import type { CurrentSlotInfo } from "@manhaj/lib/queries/attendance";
import type { RubricCriterion, RubricScore } from "@manhaj/lib/queries/rubric";
import { bulkSaveRubricScores } from "../actions/rubric";

type Student = {
  id: string;
  full_name_en: string;
  external_ref: string | null;
};

type Props = {
  slot: CurrentSlotInfo | null;
  students: Student[];
  criteria: RubricCriterion[];
  scores: RubricScore[];
  rubricId: string | null;
  teacherId: string;
  schoolId: string;
  currentMonth: string;
};

// ── Mock fallback ─────────────────────────────────────────────────────────────
const MOCK_STUDENTS: Student[] = [
  { id: "s1",  full_name_en: "Ahmed Al-Amri",    external_ref: null },
  { id: "s2",  full_name_en: "Dana Al-Bulushi",   external_ref: null },
  { id: "s3",  full_name_en: "Fatima Al-Hinai",   external_ref: null },
  { id: "s4",  full_name_en: "Hassan Al-Kindi",   external_ref: null },
  { id: "s5",  full_name_en: "Khalil Al-Mahri",   external_ref: null },
  { id: "s6",  full_name_en: "Layla Al-Habel",    external_ref: null },
  { id: "s7",  full_name_en: "Maya Al-Lawati",    external_ref: null },
  { id: "s8",  full_name_en: "Nasser Al-Rashidi", external_ref: null },
  { id: "s9",  full_name_en: "Salim Al-Lawati",   external_ref: null },
  { id: "s10", full_name_en: "Sara Al-Mughairi",  external_ref: null },
  { id: "s11", full_name_en: "Tariq Al-Balushi",  external_ref: null },
  { id: "s12", full_name_en: "Yusuf Al-Zaabi",    external_ref: null },
];

const MOCK_CRITERIA: RubricCriterion[] = [
  { id: "c1", axis_code: "conceptual",    axis_name_en: "Conceptual understanding",    description_en: "How well a pupil grasps the underlying ideas behind what she's learning — for maths this term: fractions, expansions, estimation.", ai_suggested: true,  display_order: 1, scale_min: 1, scale_max: 5 },
  { id: "c2", axis_code: "analytical",    axis_name_en: "Analytical Thinking",         description_en: "Breaks problems down, sees patterns, draws conclusions. For maths: multi-step problems, justifying answers.",                         ai_suggested: true,  display_order: 2, scale_min: 1, scale_max: 5 },
  { id: "c3", axis_code: "communication", axis_name_en: "Communication of reasoning",  description_en: "Explains thinking clearly — verbally and in writing. Not auto-scoreable from data.",                                                ai_suggested: false, display_order: 3, scale_min: 1, scale_max: 5 },
  { id: "c4", axis_code: "collaboration", axis_name_en: "Collaboration",               description_en: "Works productively with others, helps, contributes equitably.",                                                                       ai_suggested: false, display_order: 4, scale_min: 1, scale_max: 5 },
  { id: "c5", axis_code: "self_direction",axis_name_en: "Self-direction",              description_en: "Manages her own learning, completes homework, asks for help when stuck.",                                                             ai_suggested: true,  display_order: 5, scale_min: 1, scale_max: 5 },
  { id: "c6", axis_code: "application",   axis_name_en: "Application",                description_en: "Uses what she's learned in new contexts — real-world examples, cross-subject links.",                                                ai_suggested: true,  display_order: 6, scale_min: 1, scale_max: 5 },
];

const MOCK_AI_EVIDENCE: Record<string, string[]> = {
  conceptual:    ["82% on Tuesday's chapter test (top of class)", "Classwork: 5/8 fraction problems correct on Wed & Thu", "Last term overall was 4.2 → propose 4.0 → improving"],
  analytical:    ["5 of 8 multi-step word problems showed correct working (week of 30 May)", "Volunteered alternative method on Wed", "Last term interval narrows → propose 4.3 — you saw stronger justification"],
  self_direction:["Homework completion this month: 89% (7 due, Mon–25 May)", "Self-flagged 'stuck on Q4' in homework portal → proactive", "Same axis last term: 4.0 → stable"],
  application:   ["Solar-system project link to fractions ('3/8 of moon visible') — cross-subject signal", "Found all scatter section: 4/9 correct"],
};

const MOCK_COLLABORATION_CONTEXT = "Behaviour notes: +3 recognitions this month (incl. 'Helped new student at lunch Thu')";

// Pre-populated AI scores for the mock selected student (Layla, s6)
const MOCK_SCORES: RubricScore[] = [
  { student_id: "s1", axis_code: "conceptual",    score: 3, notes: null, source: "teacher" },
  { student_id: "s1", axis_code: "analytical",    score: 4, notes: null, source: "teacher" },
  { student_id: "s1", axis_code: "communication", score: 3, notes: null, source: "teacher" },
  { student_id: "s1", axis_code: "collaboration", score: 4, notes: null, source: "teacher" },
  { student_id: "s1", axis_code: "self_direction",score: 4, notes: null, source: "teacher" },
  { student_id: "s1", axis_code: "application",   score: 3, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "conceptual",    score: 4, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "analytical",    score: 3, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "communication", score: 4, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "collaboration", score: 3, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "self_direction",score: 3, notes: null, source: "teacher" },
  { student_id: "s2", axis_code: "application",   score: 4, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "conceptual",    score: 5, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "analytical",    score: 4, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "communication", score: 5, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "collaboration", score: 4, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "self_direction",score: 4, notes: null, source: "teacher" },
  { student_id: "s3", axis_code: "application",   score: 5, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "conceptual",    score: 3, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "analytical",    score: 3, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "communication", score: 2, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "collaboration", score: 3, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "self_direction",score: 3, notes: null, source: "teacher" },
  { student_id: "s4", axis_code: "application",   score: 3, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "conceptual",    score: 2, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "analytical",    score: 3, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "communication", score: 2, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "collaboration", score: 3, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "self_direction",score: 2, notes: null, source: "teacher" },
  { student_id: "s5", axis_code: "application",   score: 2, notes: null, source: "teacher" },
  // s6 (Layla) — AI proposed, not yet confirmed
  { student_id: "s6", axis_code: "conceptual",    score: 4, notes: null, source: "ai" },
  { student_id: "s6", axis_code: "analytical",    score: 4, notes: null, source: "ai" },
  { student_id: "s6", axis_code: "self_direction",score: 4, notes: null, source: "ai" },
  { student_id: "s6", axis_code: "application",   score: 4, notes: null, source: "ai" },
];

const SCALE_LABELS: Record<number, string> = { 1: "EMERGING", 2: "DEVELOPING", 3: "PROFICIENT", 4: "STRONG", 5: "ADVANCED" };
const COLORS = ["#3D5A80","#C05621","#2F855A","#C53030","#975A16","#2C5282","#6B46C1","#B7791F","#276749","#553C9A"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type AxisScore = { score: number | null; notes: string | null; source: "ai" | "teacher" | null };
type StudentScoreMap = Record<string, AxisScore>;
type AllScores = Record<string, StudentScoreMap>;

function buildInitialScores(students: Student[], criteria: RubricCriterion[], scores: RubricScore[]): AllScores {
  const all: AllScores = {};
  for (const s of students) {
    const map: StudentScoreMap = {};
    for (const c of criteria) {
      map[c.axis_code] = { score: null, notes: null, source: null };
    }
    all[s.id] = map;
  }
  for (const sc of scores) {
    if (!all[sc.student_id]) continue;
    all[sc.student_id][sc.axis_code] = {
      score: sc.score,
      notes: sc.notes,
      source: sc.source === "ai" ? "ai" : sc.source === "teacher" ? "teacher" : null,
    };
  }
  return all;
}

function studentStatus(studentId: string, criteria: RubricCriterion[], allScores: AllScores): "confirmed" | "in_progress" | "not_started" {
  const sm = allScores[studentId];
  if (!sm) return "not_started";
  const hasTeacher = criteria.every(c => sm[c.axis_code]?.source === "teacher");
  if (hasTeacher) return "confirmed";
  const hasAny = criteria.some(c => sm[c.axis_code]?.score !== null);
  return hasAny ? "in_progress" : "not_started";
}

function overallScore(studentId: string, criteria: RubricCriterion[], allScores: AllScores): number | null {
  const sm = allScores[studentId];
  if (!sm) return null;
  const scores = criteria.map(c => sm[c.axis_code]?.score).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export default function RubricClient({ slot, students, criteria, scores, rubricId, teacherId, schoolId, currentMonth }: Props) {
  const isMock = students.length === 0 || criteria.length === 0;
  const activeStudents = isMock ? MOCK_STUDENTS : students;
  const activeCriteria = isMock ? MOCK_CRITERIA : criteria;

  const [month, setMonth]           = useState(currentMonth);
  const [activeIdx, setActiveIdx]   = useState(isMock ? 5 : 0); // default to Layla (index 5) in mock
  const [isPending, startTransition]= useTransition();

  const initialScores = useMemo(
    () => buildInitialScores(activeStudents, activeCriteria, isMock ? MOCK_SCORES : scores),
    [activeStudents, activeCriteria, isMock, scores],
  );
  const [allScores, setAllScores] = useState<AllScores>(initialScores);

  const activeStudent = activeStudents[activeIdx];

  const confirmedCount = useMemo(
    () => activeStudents.filter(s => studentStatus(s.id, activeCriteria, allScores) === "confirmed").length,
    [activeStudents, activeCriteria, allScores],
  );

  function setScore(axisCode: string, score: number) {
    setAllScores(prev => ({
      ...prev,
      [activeStudent.id]: {
        ...prev[activeStudent.id],
        [axisCode]: { ...prev[activeStudent.id]?.[axisCode], score, source: "teacher" },
      },
    }));
  }

  function setNotes(axisCode: string, notes: string) {
    setAllScores(prev => ({
      ...prev,
      [activeStudent.id]: {
        ...prev[activeStudent.id],
        [axisCode]: { ...prev[activeStudent.id]?.[axisCode], notes: notes || null },
      },
    }));
  }

  function buildPayloads(studentId: string) {
    const sm = allScores[studentId] ?? {};
    return activeCriteria
      .filter(c => sm[c.axis_code]?.score !== null)
      .map(c => ({
        student_id:           studentId,
        rubric_id:            rubricId ?? "mock",
        axis_code:            c.axis_code,
        score:                sm[c.axis_code].score as number,
        notes:                sm[c.axis_code].notes,
        scored_by_teacher_id: teacherId,
        scored_for_month:     month,
        school_id:            schoolId,
        subject_id:           null,
      }));
  }

  function confirmAndNext() {
    // Mark all scored axes as teacher-confirmed in local state
    setAllScores(prev => {
      const sm = { ...prev[activeStudent.id] };
      for (const c of activeCriteria) {
        if (sm[c.axis_code]?.score !== null) {
          sm[c.axis_code] = { ...sm[c.axis_code], source: "teacher" };
        }
      }
      return { ...prev, [activeStudent.id]: sm };
    });
    if (!isMock && rubricId && schoolId && teacherId) {
      const payloads = buildPayloads(activeStudent.id);
      startTransition(() => bulkSaveRubricScores(payloads).catch(() => {}));
    }
    if (activeIdx < activeStudents.length - 1) setActiveIdx(activeIdx + 1);
  }

  function saveDraft() {
    if (!isMock && rubricId && schoolId && teacherId) {
      const payloads = buildPayloads(activeStudent.id);
      startTransition(() => bulkSaveRubricScores(payloads).catch(() => {}));
    }
  }

  const sm = allScores[activeStudent?.id] ?? {};
  const overall = overallScore(activeStudent?.id, activeCriteria, allScores);

  const [yr, mn] = month.split("-").map(Number);
  const sectionLabel = slot?.sectionCode ?? "G5B";
  const subjectLabel = slot?.subjectName ?? "Maths";
  const cycleLabel   = `${sectionLabel} · ${subjectLabel} · ${monthLabel(month)}`;

  const aiAxisCount     = activeCriteria.filter(c => c.ai_suggested).length;
  const judgeAxisCount  = activeCriteria.filter(c => !c.ai_suggested).length;

  return (
    <div className="rub-page">
      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="rub-sidebar">
        <div className="rub-cycle-header">
          <div className="rub-cycle-label">MONTHLY RUBRIC CYCLE</div>
          <div className="rub-cycle-class">{cycleLabel}</div>
          <div className="rub-cycle-nav">
            <button className="rub-cycle-btn" onClick={() => setMonth(prevMonth(month))}>
              {monthLabel(prevMonth(month)).split(" ")[0]}
            </button>
            <button className="rub-cycle-btn active">{monthLabel(month).split(" ")[0]}</button>
            <button className="rub-cycle-btn" onClick={() => setMonth(nextMonth(month))}>
              {monthLabel(nextMonth(month)).split(" ")[0]}
            </button>
          </div>
        </div>

        <div className="rub-progress-block">
          <div className="rub-progress-label">
            CLASS PROGRESS
            <span className="rub-progress-count">{confirmedCount} of {activeStudents.length} scored</span>
          </div>
          <div className="rub-progress-bar">
            <div className="rub-progress-fill" style={{ width: `${Math.round((confirmedCount / activeStudents.length) * 100)}%` }} />
          </div>
        </div>

        <div className="rub-student-list">
          {activeStudents.map((s, i) => {
            const status = studentStatus(s.id, activeCriteria, allScores);
            const avg    = overallScore(s.id, activeCriteria, allScores);
            return (
              <button
                key={s.id}
                className={`rub-student-row${i === activeIdx ? " active" : ""}`}
                onClick={() => setActiveIdx(i)}
              >
                <div
                  className="rub-s-avatar"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {initials(s.full_name_en)}
                </div>
                <div className="rub-s-info">
                  <div className="rub-s-name">{s.full_name_en}</div>
                  <div className="rub-s-sub">
                    {status === "confirmed"   && <span className="rub-dot confirmed" />}
                    {status === "in_progress" && <span className="rub-dot in-progress" />}
                    {status === "not_started" && <span className="rub-dot not-started" />}
                    {status === "confirmed"   ? `Scored · ${avg ?? "—"}/5` :
                     status === "in_progress" ? "In progress" : "Not started"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right scoring panel ───────────────────────────────────────────── */}
      <main className="rub-panel">
        {/* Student header */}
        <div className="rub-student-header">
          <div className="rub-student-header-info">
            <div
              className="rub-stu-avatar"
              style={{ background: COLORS[activeIdx % COLORS.length] }}
            >
              {initials(activeStudent.full_name_en)}
            </div>
            <div>
              <div className="rub-stu-name">{activeStudent.full_name_en}</div>
              <div className="rub-stu-meta">
                {sectionLabel} · Roll #{activeIdx + 1} of {activeStudents.length} in class
              </div>
            </div>
          </div>
          <div className="rub-header-actions">
            {activeIdx > 0 && (
              <button className="rub-nav-btn" onClick={() => setActiveIdx(activeIdx - 1)}>← Previous</button>
            )}
            <button className="rub-nav-btn primary" onClick={confirmAndNext}>
              Save &amp; next →
            </button>
            {isPending && <span className="rub-saving">saving…</span>}
          </div>
        </div>

        {/* AI banner */}
        <div className="rub-ai-banner">
          <span className="rub-ai-avatar">M</span>
          <span className="rub-ai-text">
            Manhaj AI has proposed scores for the {aiAxisCount} data-led axes using {activeStudent.full_name_en.split(" ")[0]}&apos;s {monthLabel(month)} grades, attendance, homework, and behaviour notes.
            {judgeAxisCount > 0 && ` The ${judgeAxisCount} judgment ${judgeAxisCount === 1 ? "axis is" : "axes are"} blank for you to fill in.`}
          </span>
        </div>

        {/* Rubric axes */}
        <div className="rub-axes">
          {activeCriteria.map(c => {
            const axisScore = sm[c.axis_code] ?? { score: null, notes: null, source: null };
            const isAI      = c.ai_suggested;
            const hasAIScore= axisScore.source === "ai";
            const isTeacher = axisScore.source === "teacher";
            const chipLabel = !isAI ? "YOUR COMMENT"
              : isTeacher ? "AI ASSESSED"
              : hasAIScore ? "IN PROGRESS"
              : "AI SUGGESTED";
            const chipClass = !isAI ? "rub-chip teacher" : isTeacher ? "rub-chip ai-done" : "rub-chip ai";
            const aiEvidence = isMock ? (MOCK_AI_EVIDENCE[c.axis_code] ?? []) : [];

            return (
              <div key={c.axis_code} className="rub-axis">
                <div className="rub-axis-head">
                  <span className="rub-axis-name">{c.axis_name_en}</span>
                  <span className={chipClass}>{chipLabel}</span>
                </div>
                {c.description_en && (
                  <div className="rub-axis-desc">{c.description_en}</div>
                )}

                {/* Score scale */}
                <div className="rub-scale">
                  {Array.from({ length: c.scale_max - c.scale_min + 1 }, (_, i) => i + c.scale_min).map(v => (
                    <button
                      key={v}
                      className={`rub-scale-btn${axisScore.score === v ? " active" : ""}`}
                      onClick={() => setScore(c.axis_code, v)}
                    >
                      <span className="rub-scale-num">{v}</span>
                      <span className="rub-scale-label">{SCALE_LABELS[v] ?? String(v)}</span>
                    </button>
                  ))}
                </div>

                {/* AI evidence */}
                {isAI && aiEvidence.length > 0 && (
                  <div className="rub-evidence">
                    <div className="rub-evidence-head">EVIDENCE USED BY AI</div>
                    {aiEvidence.map((e, i) => (
                      <div key={i} className="rub-evidence-item">· {e}</div>
                    ))}
                  </div>
                )}

                {/* Collaboration context (mock only) */}
                {isMock && c.axis_code === "collaboration" && (
                  <div className="rub-context-note">
                    <span className="rub-context-label">CONTEXT (NOT USED IN PROPOSING SCORE):</span> {MOCK_COLLABORATION_CONTEXT}
                  </div>
                )}

                {/* No-AI note for teacher-judgment axes */}
                {!isAI && (
                  <div className="rub-no-ai-note">
                    Nothing automatic for this axis. Your observation is the source of truth. Add a one-line note to support the score.
                  </div>
                )}

                {/* Notes textarea */}
                <div className="rub-notes-row">
                  <div className="rub-notes-label">YOUR NOTES (OPTIONAL, HELPS AI AND PARENTS AND NEXT TEACHER):</div>
                  <textarea
                    className="rub-notes-input"
                    value={axisScore.notes ?? ""}
                    placeholder={isAI ? "e.g. any nuance the data can't capture…" : "e.g. Confidently explained her fraction method to a peer on Wed."}
                    onChange={e => setNotes(c.axis_code, e.target.value)}
                    rows={1}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall score + footer */}
        <div className="rub-footer">
          <div className="rub-overall">
            <div className="rub-overall-score">{overall !== null ? overall : "—"}<span className="rub-overall-denom">/5</span></div>
            <div className="rub-overall-label">OVERALL SCORE · THIS CYCLE</div>
          </div>
          <div className="rub-footer-actions">
            <button className="rub-save-draft" onClick={saveDraft}>Save draft</button>
            <button className="rub-confirm-btn" onClick={confirmAndNext}>
              {activeIdx < activeStudents.length - 1 ? "Confirm & next student" : "Confirm & finish"}
            </button>
          </div>
        </div>

        {/* How it works note */}
        <div className="rub-how-note">
          <strong>How the scoring works:</strong> AI proposes scores on data-led axes (grades, homework, attendance, behaviour) and shows the evidence it used. You confirm or adjust. The 2 judgment axes are yours alone — AI never proposes those. All scores are saved and shared with parents and the next teacher.
        </div>
      </main>
    </div>
  );
}
