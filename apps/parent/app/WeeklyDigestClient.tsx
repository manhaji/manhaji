"use client";

import { useState } from "react";
import type { ParentChild } from "@manhaj/lib/queries/parents";
import type { InvoiceWithLines } from "@manhaj/lib/queries/invoices";
import type { BehaviourEvent, StudentAssessmentResult, WeeklyDigestDraft, TeacherRecognition } from "@manhaj/lib/queries/weeklydigest";

type LessonRaw = {
  id: string;
  held_on: string;
  topic: string | null;
  plan_kind: string | null;
  homework_description: string | null;
  homework_due_date: string | null;
  subjects: { name_en: string; code?: string } | null;
};

type HomeworkRaw = {
  id: string;
  subject: string;
  title: string;
  due: string | null;
  lesson_date: string;
  ai_estimate: string | null;
};

type ChildDataEntry = {
  child: ParentChild;
  att: { student_id: string; pct: number; absences: number } | undefined;
  lessons: LessonRaw[];
  homework: HomeworkRaw[];
  behaviourEvents: BehaviourEvent[];
  assessmentResults: StudentAssessmentResult[];
  digestDraft: WeeklyDigestDraft | null;
  recognition: TeacherRecognition | null;
  nextLessons: LessonRaw[];
  topResult: StudentAssessmentResult | null;
  homeworkCount: number;
  positiveNotes: number;
};

interface Props {
  kids: ParentChild[];
  childData: ChildDataEntry[];
  unpaidInvoices: InvoiceWithLines[];
  weekStart: string;
  weekEnd: string;
  todayStr: string;
  isMock: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CHILD: ParentChild = {
  student_id: "mock-1",
  full_name_en: "Layla Al-Habsi",
  initial: "L",
  section_id: "mock-sec",
  section_code: "10A",
  grade_level: "Grade 10",
};

const MOCK_DIGEST_TEXT =
  "Layla had a strong week across most subjects. She scored 92% on her Maths quiz and contributed actively during the Arabic literature discussion. Her homework submission rate was 89% — one assignment was missed on Monday but she made up for it with extra effort later in the week. Ms. Sara noted that Layla's collaboration skills have noticeably improved this term.";

const MOCK_TIMELINE = [
  { day: "Sun", date: "24 May", icon: "📚", text: "Started Unit 4: Fractions in Maths", kind: "lesson" },
  { day: "Mon", date: "25 May", icon: "✏️", text: "Missed homework — Arabic worksheet", kind: "warn" },
  { day: "Tue", date: "26 May", icon: "🏆", text: "Scored 92% on Maths quiz", kind: "grade" },
  { day: "Wed", date: "27 May", icon: "🌟", text: "Teacher note: 'Great teamwork in Science'", kind: "positive" },
  { day: "Thu", date: "28 May", icon: "📝", text: "Submitted English essay on time", kind: "lesson" },
];

const MOCK_NEXT_WEEK = [
  { day: "Sun", label: "Islamic Studies test" },
  { day: "Mon", label: "Science project due" },
  { day: "Tue", label: "Field trip — Museum" },
  { day: "Wed", label: "Parent meeting" },
  { day: "Thu", label: "English oral exam" },
];

const MOCK_TODOS = [
  { label: "Sign consent form — Museum visit", action: "Sign now", kind: "form" },
  { label: "Invoice due — Tuition Term 3 (OMR 450)", action: "View invoice", kind: "invoice" },
];

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function fmtWeekRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  return `${s.toLocaleDateString("en-GB", opts).toUpperCase()} — ${e.toLocaleDateString("en-GB", opts).toUpperCase()}`;
}

function KPICard({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "green" | "amber" | "red" }) {
  return (
    <div className={`wd-kpi${tone ? ` wd-kpi--${tone}` : ""}`}>
      <div className="wd-kpi-label">{label}</div>
      <div className="wd-kpi-value">{value}</div>
      <div className="wd-kpi-sub">{sub}</div>
    </div>
  );
}

export default function WeeklyDigestClient({
  kids,
  childData,
  unpaidInvoices,
  weekStart,
  weekEnd,
  todayStr,
  isMock,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const activeEntry = isMock ? null : childData[selectedIdx];
  const activeChild = isMock ? MOCK_CHILD : (activeEntry?.child ?? MOCK_CHILD);

  // ── KPIs
  const attPct       = isMock ? 100 : (activeEntry?.att?.pct ?? 0);
  const absences     = isMock ? 0   : (activeEntry?.att?.absences ?? 0);
  const hwCount      = isMock ? null : (activeEntry?.homeworkCount ?? 0);
  const topGrade     = isMock ? 92  : (activeEntry?.topResult?.pct ?? null);
  const topSubj      = isMock ? "Maths Tue quiz" : (activeEntry?.topResult ? `${activeEntry.topResult.subject} · ${fmtDate(activeEntry.topResult.held_on)}` : null);
  const posNotes     = isMock ? 2   : (activeEntry?.positiveNotes ?? 0);

  // ── AI Digest
  const digestText = isMock ? MOCK_DIGEST_TEXT : (activeEntry?.digestDraft?.text ?? null);

  // ── Timeline
  type TimelineEvent = { day: string; date: string; icon: string; text: string; kind: string };
  let timeline: TimelineEvent[] = [];
  if (isMock) {
    timeline = MOCK_TIMELINE;
  } else if (activeEntry) {
    const evtsByDate = new Map<string, TimelineEvent>();
    for (const lesson of activeEntry.lessons) {
      const d = new Date(lesson.held_on + "T00:00:00Z");
      const dayName = SHORT_DAYS[d.getUTCDay()] ?? "";
      const dateFmt = fmtDate(lesson.held_on);
      const sub = lesson.subjects?.name_en ?? "Lesson";
      const topic = lesson.topic ? `: ${lesson.topic}` : "";
      evtsByDate.set(lesson.held_on, { day: dayName, date: dateFmt, icon: "📚", text: `${sub}${topic}`, kind: "lesson" });
    }
    for (const ar of activeEntry.assessmentResults) {
      const d = new Date(ar.held_on + "T00:00:00Z");
      const dayName = SHORT_DAYS[d.getUTCDay()] ?? "";
      evtsByDate.set(`${ar.held_on}-grade`, {
        day: dayName, date: fmtDate(ar.held_on), icon: "🏆",
        text: `Scored ${ar.pct ?? ar.score}% on ${ar.label} (${ar.subject})`, kind: "grade",
      });
    }
    for (const bev of activeEntry.behaviourEvents) {
      const d = new Date(bev.observed_on + "T00:00:00Z");
      const dayName = SHORT_DAYS[d.getUTCDay()] ?? "";
      const icon = bev.kind === "positive" ? "🌟" : bev.kind === "concern" ? "⚠️" : "📌";
      const kind = bev.kind === "positive" ? "positive" : bev.kind === "concern" ? "warn" : "lesson";
      evtsByDate.set(`${bev.observed_on}-beh-${bev.id}`, {
        day: dayName, date: fmtDate(bev.observed_on), icon, text: bev.note, kind,
      });
    }
    timeline = Array.from(evtsByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v)
      .slice(0, 5);
  }

  // ── Next week
  type NextItem = { day: string; label: string };
  let nextWeek: NextItem[] = [];
  if (isMock) {
    nextWeek = MOCK_NEXT_WEEK;
  } else if (activeEntry) {
    const byDay: Record<string, string> = {};
    for (const lesson of activeEntry.nextLessons) {
      const d = new Date(lesson.held_on + "T00:00:00Z");
      const dayName = SHORT_DAYS[d.getUTCDay()] ?? "";
      if (!byDay[dayName]) byDay[dayName] = lesson.subjects?.name_en ?? "Lesson";
    }
    nextWeek = ["Sun", "Mon", "Tue", "Wed", "Thu"].map(day => ({
      day,
      label: byDay[day] ?? "—",
    }));
  }

  // ── Recognition
  const recognition = isMock
    ? { note: "Layla showed exceptional teamwork during the Science experiment. She helped her group organise their findings really well.", teacher_name: "Ms. Sara", observed_on: weekEnd }
    : (activeEntry?.recognition ?? null);

  // ── Todos
  type TodoItem = { label: string; action: string; kind: string };
  const todos: TodoItem[] = isMock
    ? MOCK_TODOS
    : [
        ...unpaidInvoices.slice(0, 2).map(inv => ({
          label: `Invoice due — ${inv.what_for ?? "balance"} (OMR ${inv.amount_owed_aed})`,
          action: "View invoice",
          kind: "invoice",
        })),
      ];

  const weekRangeLabel = fmtWeekRange(weekStart, weekEnd);

  return (
    <div className="wd-root">
      {/* ── Header ── */}
      <div className="wd-header">
        <div className="wd-header-left">
          <span className="wd-badge">WEEKLY DIGEST</span>
          <span className="wd-week-range">· {weekRangeLabel}</span>
        </div>
        {kids.length > 1 && (
          <div className="wd-child-selector">
            {kids.map((c, i) => (
              <button
                key={c.student_id}
                className={`wd-child-tab${i === selectedIdx ? " active" : ""}`}
                onClick={() => setSelectedIdx(i)}
              >
                <span className="wd-child-initial">{c.initial}</span>
                {c.full_name_en.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        {kids.length <= 1 && (
          <div className="wd-child-pill">
            <span className="wd-child-initial">{activeChild.initial}</span>
            <span className="wd-child-name">{activeChild.full_name_en}</span>
            <span className="wd-child-grade">{activeChild.grade_level ?? activeChild.section_code}</span>
          </div>
        )}
      </div>

      {/* ── AI Digest Card ── */}
      {digestText && (
        <div className="wd-digest-card">
          <div className="wd-digest-icon">✦</div>
          <div className="wd-digest-body">
            <p className="wd-digest-text">{digestText}</p>
            <div className="wd-digest-badge">
              <span className="wd-digest-ai-dot" />
              Drafted by Manhaj AI · reviewed by Ms. Sara before sending
            </div>
          </div>
        </div>
      )}
      {!digestText && (
        <div className="wd-digest-card wd-digest-card--mock">
          <div className="wd-digest-icon">✦</div>
          <div className="wd-digest-body">
            <p className="wd-digest-text">
              {isMock
                ? MOCK_DIGEST_TEXT
                : `${activeChild.full_name_en.split(" ")[0]}'s weekly digest hasn't been drafted yet. Check back later.`}
            </p>
            {isMock && (
              <div className="wd-digest-badge">
                <span className="wd-digest-ai-dot" />
                Drafted by Manhaj AI · reviewed by Ms. Sara before sending
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Strip ── */}
      <div className="wd-kpi-strip">
        <KPICard
          label="ATTENDANCE"
          value={`${attPct}%`}
          sub={absences === 0 ? "5/5 days on time" : `${absences} absence${absences > 1 ? "s" : ""} this week`}
          tone={attPct === 100 ? "green" : attPct >= 80 ? "amber" : "red"}
        />
        <KPICard
          label="HOMEWORK DONE"
          value={isMock ? "89%" : hwCount !== null ? `${hwCount}` : "—"}
          sub={isMock ? "1 missed Monday" : hwCount !== null ? `${hwCount} assignment${hwCount !== 1 ? "s" : ""} this week` : "none assigned"}
          tone={isMock ? "amber" : hwCount !== null && hwCount > 0 ? "green" : undefined}
        />
        <KPICard
          label="TOP GRADE"
          value={topGrade !== null ? `${topGrade}%` : "—"}
          sub={topSubj ?? "no assessments"}
          tone={topGrade !== null ? (topGrade >= 85 ? "green" : topGrade >= 65 ? "amber" : "red") : undefined}
        />
        <KPICard
          label="BEHAVIOUR NOTES"
          value={`+${posNotes}`}
          sub={posNotes > 0 ? `${posNotes > 1 ? "both" : "one"} positive` : "none this week"}
          tone={posNotes > 0 ? "green" : undefined}
        />
      </div>

      {/* ── Two-column body ── */}
      <div className="wd-body">
        {/* ── Left: timeline + next week + recognition ── */}
        <div className="wd-left">
          {/* Timeline */}
          <div className="wd-section">
            <div className="wd-section-title">What happened this week</div>
            <div className="wd-timeline">
              {(timeline.length > 0 ? timeline : MOCK_TIMELINE).map((evt, i) => (
                <div key={i} className={`wd-tl-row wd-tl-row--${evt.kind}`}>
                  <div className="wd-tl-day">
                    <span className="wd-tl-dayname">{evt.day}</span>
                    <span className="wd-tl-date">{evt.date}</span>
                  </div>
                  <div className="wd-tl-line">
                    <div className="wd-tl-dot" />
                    {i < (timeline.length > 0 ? timeline : MOCK_TIMELINE).length - 1 && <div className="wd-tl-connector" />}
                  </div>
                  <div className="wd-tl-content">
                    <span className="wd-tl-icon">{evt.icon}</span>
                    <span className="wd-tl-text">{evt.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next week */}
          <div className="wd-section">
            <div className="wd-section-title">Coming up next week</div>
            <div className="wd-next-grid">
              {(nextWeek.length > 0 ? nextWeek : MOCK_NEXT_WEEK).map(item => (
                <div key={item.day} className="wd-next-col">
                  <div className="wd-next-day">{item.day}</div>
                  <div className="wd-next-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recognition */}
          {recognition && (
            <div className="wd-recognition">
              <div className="wd-recog-header">
                <span className="wd-recog-star">★</span>
                Recognition from teachers
              </div>
              <blockquote className="wd-recog-quote">
                &ldquo;{recognition.note}&rdquo;
              </blockquote>
              {recognition.teacher_name && (
                <div className="wd-recog-teacher">— {recognition.teacher_name}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: to-do + footer ── */}
        <div className="wd-right">
          {/* Things to do */}
          {todos.length > 0 && (
            <div className="wd-section wd-todo-card">
              <div className="wd-section-title">Things you need to do</div>
              <div className="wd-todo-list">
                {todos.map((todo, i) => (
                  <div key={i} className={`wd-todo-item wd-todo-item--${todo.kind}`}>
                    <div className="wd-todo-icon">{todo.kind === "invoice" ? "💳" : "📋"}</div>
                    <div className="wd-todo-label">{todo.label}</div>
                    <button className="wd-todo-btn">{todo.action}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessments this week */}
          {!isMock && activeEntry && activeEntry.assessmentResults.length > 0 && (
            <div className="wd-section">
              <div className="wd-section-title">Grades this week</div>
              <div className="wd-grades-list">
                {activeEntry.assessmentResults.map(ar => (
                  <div key={ar.id} className="wd-grade-row">
                    <div className="wd-grade-subject">{ar.subject}</div>
                    <div className="wd-grade-label">{ar.label}</div>
                    <div className={`wd-grade-pct${ar.pct !== null && ar.pct >= 85 ? " green" : ar.pct !== null && ar.pct >= 65 ? " amber" : " red"}`}>
                      {ar.pct !== null ? `${ar.pct}%` : `${ar.score}/${ar.max_score}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="wd-footer-actions">
            <button className="wd-footer-btn wd-footer-btn--outline">Reply to school</button>
            <button className="wd-footer-btn wd-footer-btn--outline">View {activeChild.full_name_en.split(" ")[0]}&apos;s full report</button>
            <button className="wd-footer-btn wd-footer-btn--primary">Open in app</button>
          </div>
        </div>
      </div>
    </div>
  );
}
