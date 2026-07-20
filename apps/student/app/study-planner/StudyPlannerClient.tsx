"use client";

import { useState } from "react";
import type { PeriodSlot } from "@manhaj/lib/queries/timetable";
import type { HomeworkRow } from "@manhaj/lib/queries/lessons";
import type { AssessmentRow, WrapupBlock } from "@manhaj/lib/queries/studyplanner";
import type { RubricSuggestionData } from "@manhaj/lib/queries/goals";
import { setWrapupDoneAction } from "@/app/actions/study";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClassPill = {
  period: string;
  subject: string;
  teacher?: string;
  kind: "class" | "test" | "trip" | "event";
  note?: string;
};

type HwItem = {
  subject: string;
  title: string;
  time: string;
  urgent?: boolean;
};

type FocusItem = {
  title: string;
  desc: string;
  time: string;
  done: boolean;
  urgent: boolean;
};

type StudySuggestion = {
  type: string;
  title: string;
  desc: string;
  time: string;
  addTo: string;
};

type AfternoonBlock = {
  time: string;
  title: string;
  sub?: string;
  tag: "SCHOOL" | "STUDY" | "FREE" | "WIND DOWN";
};

type Props = {
  studentName: string;
  periods: PeriodSlot[];
  homework: HomeworkRow[];
  assessments: AssessmentRow[];
  rubricScores: RubricSuggestionData[];
  /** Today's study_blocks rows — restore wrap-up checkbox state (mig 020). */
  wrapupBlocks: WrapupBlock[];
  today: string;
  weekStart: string;
  weekEnd: string;
  isMock: boolean;
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CLASSES: Record<string, ClassPill[]> = {
  Sun: [
    { period: "P1", subject: "Maths · fractions intro", teacher: "Mr. Tariq",  kind: "class" },
    { period: "P3", subject: "English",                  teacher: "Ms. Sara",   kind: "class" },
    { period: "P5", subject: "Science project DUE",                             kind: "test"  },
  ],
  Mon: [
    { period: "P1", subject: "Arabic",  teacher: "Mr. Hassan", kind: "class" },
    { period: "P2", subject: "Maths",   teacher: "Mr. Tariq",  kind: "class" },
    { period: "P3", subject: "PE",                              kind: "class" },
  ],
  Tue: [
    { period: "P2", subject: "Maths",   teacher: "Mr. Tariq", kind: "class" },
    { period: "P3", subject: "English", teacher: "Ms. Sara",  kind: "class" },
  ],
  Wed: [
    { period: "ALL", subject: "FIELD TRIP",                   note: "Al Zubair Museum · all day",   kind: "trip"  },
    { period: "",    subject: "Field trip counseled",                                                 kind: "event" },
    { period: "",    subject: "Pack lunch (no maths!)",                                               kind: "event" },
  ],
  Thu: [
    { period: "P1", subject: "MATHS CHAPTER TEST", teacher: "Mr. Tariq", note: "Fractions", kind: "test"  },
    { period: "P2", subject: "English review",      teacher: "Ms. Sara",                    kind: "class" },
    { period: "",   subject: "Test evening",                                                 kind: "event" },
  ],
};

const MOCK_HW: Record<string, HwItem[]> = {
  Sun: [{ subject: "Science", title: "Science project DUE", time: "30 min", urgent: true }],
  Mon: [{ subject: "Arabic",  title: "Arabic vocab · 15 min",           time: "15 min" }],
  Tue: [{ subject: "Maths",   title: "Multi-step problems · 25 min",    time: "25 min" }],
  Thu: [{ subject: "Maths",   title: "Test prep · 30 min",              time: "30 min" }],
};

const MOCK_FOCUS: FocusItem[] = [
  { title: "Finish your Science project",        desc: "Solar system model · due tomorrow · ~30 min left to do",  time: "30 min", done: false, urgent: true  },
  { title: "Maths worksheet — fractions intro",  desc: "Today's class work · complete problems 7–10 at home",     time: "20 min", done: false, urgent: false },
  { title: "Read 30 minutes (daily goal)",       desc: "Done at 8:30 AM · keep the 12-day streak going!",          time: "",       done: true,  urgent: false },
];

const MOCK_SUGGESTS: StudySuggestion[] = [
  {
    type:  "TEST PREP",
    title: "Maths chapter test review",
    desc:  "Mr. Tariq's 'worked examples' cover everything. Thursday's test will ask: Rest on Tuesday evening.",
    time:  "30 min",
    addTo: "Tue",
  },
  {
    type:  "BEHIND GOAL",
    title: "Multi-step word problems",
    desc:  "You're 11 problems behind your monthly goal. 2 problems on Sunday = 2 more this week = caught up.",
    time:  "15 min",
    addTo: "Sun",
  },
  {
    type:  "ALMOST DONE",
    title: "Arabic chapter 8 final 6 words",
    desc:  "Just 6 words left. One sitting and you're done — and it reaches the goal.",
    time:  "~5 min",
    addTo: "Mon",
  },
];

const MOCK_AFTERNOON: AfternoonBlock[] = [
  { time: "08:00 — 14:00", title: "School day",               sub: "Sun, Maths, English, Science, PE",                    tag: "SCHOOL"    },
  { time: "15:00 — 15:30", title: "Finish Science project",   sub: "30 minutes · most urgent · due tomorrow",              tag: "STUDY"     },
  { time: "15:30 — 16:00", title: "Break / snack",                                                                         tag: "FREE"      },
  { time: "16:00 — 16:30", title: "Maths worksheet",          sub: "30 minutes · fractions practice",                      tag: "STUDY"     },
  { time: "16:20 — 16:40", title: "Multi-step problems",      sub: "3 problems · 20 min · catches you up on your goal",    tag: "STUDY"     },
  { time: "16:40 — 17:30", title: "Free time",                sub: "Family · play · whatever you want",                    tag: "FREE"      },
  { time: "17:30 — 20:00", title: "Read",                     sub: "30 minutes · don't break the 12-day streak!",          tag: "STUDY"     },
  { time: "20:00",         title: "Wind down — bedtime by 21:00",                                                           tag: "WIND DOWN" },
];

const SUGGEST_BADGE_COLORS: Record<string, string> = {
  "TEST PREP":   "#FED7D7",
  "BEHIND GOAL": "#FEEBC8",
  "ALMOST DONE": "#C6F6D5",
  "FOCUS AREA":  "#BEE3F8",
};

const AFTERNOON_TAG: Record<string, { bg: string; color: string }> = {
  "SCHOOL":    { bg: "#EBF8FF", color: "#2B6CB0" },
  "STUDY":     { bg: "#2D3748", color: "#fff"     },
  "FREE":      { bg: "#F0FFF4", color: "#276749"  },
  "WIND DOWN": { bg: "#FAF5FF", color: "#553C9A"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_OFFSET: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"] as const;
const MONTHS    = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOW_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end   + "T00:00:00Z");
  return `${DOW_NAMES[s.getUTCDay()]} ${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} → ${DOW_NAMES[e.getUTCDay()]} ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`;
}

function buildSuggestionsFromRubric(scores: RubricSuggestionData[]): StudySuggestion[] {
  const low = scores.filter(r => r.score !== null && r.score <= 2).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  if (!low.length) return MOCK_SUGGESTS;
  return [
    {
      type:  "FOCUS AREA",
      title: `Practise your ${low[0].axisCode.replace(/_/g, " ").toLowerCase()} skills`,
      desc:  `Your rubric score here is ${low[0].score}/5 — the easiest area to move up this month.`,
      time:  "20 min",
      addTo: "Mon",
    },
    low[1]
      ? {
          type:  "ALMOST DONE",
          title: `Boost your ${low[1].axisCode.replace(/_/g, " ").toLowerCase()}`,
          desc:  `Score: ${low[1].score}/5. A focused session this week will push it to the next level.`,
          time:  "15 min",
          addTo: "Tue",
        }
      : MOCK_SUGGESTS[1],
    MOCK_SUGGESTS[2],
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudyPlannerClient({
  studentName, periods, homework, assessments, rubricScores, wrapupBlocks,
  today, weekStart, weekEnd, isMock,
}: Props) {
  const displayName = studentName || "Layla";

  // Restore persisted wrap-up state from study_blocks (keyed by task title).
  const persistedDone: Record<string, boolean> = {};
  for (const b of wrapupBlocks) persistedDone[b.title] = b.isDone;

  const [focusDone, setFocusDone] = useState<Record<number, boolean>>(
    () => (isMock ? { 2: true } : {}) as Record<number, boolean>,
  );
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // ── Per-day helpers ──────────────────────────────────────────────────────
  function dayDate(name: string): string { return addDays(weekStart, DAY_OFFSET[name] ?? 0); }

  function dayClasses(name: string): ClassPill[] {
    if (isMock) return MOCK_CLASSES[name] ?? [];
    return periods
      .filter(p => p.day === name && p.is_teaching && p.subject)
      .map(p => ({
        period:  p.period,
        subject: p.subject ?? "",
        teacher: p.teacher ?? undefined,
        kind:    "class" as const,
      }));
  }

  function dayHw(name: string): HwItem[] {
    if (isMock) return MOCK_HW[name] ?? [];
    const date = dayDate(name);
    return [
      ...assessments.filter(a => a.scheduledOn === date).map(a => ({
        subject: a.subject,
        title:   `${a.subject} ${a.kind} — study for today`,
        time:    "30 min",
        urgent:  true,
      })),
      ...homework.filter(h => h.due === date).map(h => ({
        subject: h.subject,
        title:   h.title,
        time:    h.ai_estimate ?? "",
      })),
    ];
  }

  // ── Today's focus ────────────────────────────────────────────────────────
  const todayFocus: FocusItem[] = isMock
    ? MOCK_FOCUS
    : homework
        .filter(h => h.due === today || h.due === addDays(today, 1))
        .slice(0, 3)
        .map(h => ({
          title:  h.title,
          desc:   `${h.subject} · due ${h.due === today ? "today" : "tomorrow"}`,
          time:   h.ai_estimate ?? "",
          done:   persistedDone[h.title] ?? false,
          urgent: h.due === today,
        }));

  // Persist a wrap-up tick to study_blocks.is_done (real write, OR demo).
  async function toggleWrapup(i: number, item: FocusItem) {
    const next = !(item.done || focusDone[i]);
    setFocusDone(p => ({ ...p, [i]: next }));   // optimistic
    if (isMock) return;                          // demo list — local only
    const res = await setWrapupDoneAction(item.title, today, next);
    if (!res.ok && res.error !== "not_signed_in") {
      setFocusDone(p => ({ ...p, [i]: !next })); // revert
      setSaveNote(`Couldn't save that: ${res.error}`);
    }
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const hwCount     = isMock ? 3 : homework.length;
  const testCount   = isMock ? 2 : assessments.length;
  const eventCount  = isMock ? 1 : 0;
  const freeAftCount= isMock ? 2 : Math.max(0, 5 - new Set(homework.map(h => h.due)).size);

  const hwDetail   = isMock ? "1 by Sunday"             : homework[0]     ? `Due ${(homework[0].due ?? "").slice(5)}` : "All clear";
  const testDetail = isMock ? "Maths · Thursday"        : assessments[0]  ? assessments[0].subject            : "None this week";
  const eventDetail= isMock ? "Field trip · Wednesday"  : "Check calendar";
  const freeDetail = isMock ? "Sun & Mon"               : freeAftCount > 0 ? `${freeAftCount} days`           : "";

  const suggestions = isMock ? MOCK_SUGGESTS : buildSuggestionsFromRubric(rubricScores);

  const todayDow = DOW_NAMES[new Date(today + "T00:00:00Z").getUTCDay()];

  return (
    <div className="sp-page">

      {/* Title */}
      <div className="sp-title-row">
        <h1 className="sp-title">Plan your week, {displayName}</h1>
        <p className="sp-subtitle">Your classes, your homework, your study time — all in one place. Drag and drop to plan your afternoons.</p>
      </div>

      {/* KPI strip */}
      <div className="sp-kpi-strip">
        <div className="sp-kpi-box">
          <div className="sp-kpi-num">{hwCount}</div>
          <div className="sp-kpi-label">HOMEWORK DUE</div>
          <div className="sp-kpi-detail">{hwDetail}</div>
        </div>
        <div className="sp-kpi-box">
          <div className="sp-kpi-num">{testCount}</div>
          <div className="sp-kpi-label">TESTS THIS WEEK</div>
          <div className="sp-kpi-detail">{testDetail}</div>
        </div>
        <div className="sp-kpi-box">
          <div className="sp-kpi-num">{eventCount}</div>
          <div className="sp-kpi-label">SPECIAL EVENTS</div>
          <div className="sp-kpi-detail">{eventDetail}</div>
        </div>
        <div className="sp-kpi-box">
          <div className="sp-kpi-num">{freeAftCount}</div>
          <div className="sp-kpi-label">FREE AFTERNOONS</div>
          <div className="sp-kpi-detail">{freeDetail}</div>
        </div>
      </div>

      {/* TODAY'S FOCUS */}
      <div className="sp-focus-card">
        <div className="sp-focus-head">
          <span className="sp-focus-heading">{todayFocus.length} things to wrap up</span>
          <span className="sp-focus-date">
            {new Date(today + "T00:00:00Z").toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
            })}
          </span>
        </div>
        {saveNote && <div className="sp-save-note" role="status">{saveNote}</div>}
        {todayFocus.map((item, i) => {
          const isDone = !!focusDone[i] || (focusDone[i] === undefined && item.done);
          return (
            <div key={i} className={`sp-focus-item${isDone ? " done" : ""}`}>
              <button
                className={`sp-focus-dot${isDone ? " check" : item.urgent ? " urgent" : ""}`}
                aria-pressed={isDone}
                aria-label={isDone ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
                onClick={() => toggleWrapup(i, item)}
              >
                {isDone ? "✓" : ""}
              </button>
              <div className="sp-focus-text">
                <div className="sp-focus-title">{item.title}</div>
                <div className="sp-focus-desc">{item.desc}</div>
              </div>
              {isDone
                ? <span className="sp-focus-tag done-tag">Done</span>
                : item.time
                  ? <span className={`sp-focus-tag${item.urgent ? " urgent-tag" : ""}`}>{item.time}</span>
                  : null}
            </div>
          );
        })}
      </div>

      {/* THIS WEEK */}
      <div className="sp-week-section">
        <div className="sp-week-hdr">
          <span className="sp-section-label">THIS WEEK</span>
          <span className="sp-week-range">
            {fmtWeekRange(weekStart, weekEnd)}&nbsp;·&nbsp;School week · Sun–Thu
          </span>
        </div>
        <div className="sp-week-grid">
          {WEEK_DAYS.map(name => {
            const date    = dayDate(name);
            const dayNum  = new Date(date + "T00:00:00Z").getUTCDate();
            const isToday = date === today;
            const classes = dayClasses(name);
            const hw      = dayHw(name);
            return (
              <div key={name} className={`sp-day-col${isToday ? " today" : ""}`}>
                <div className={`sp-day-head${isToday ? " today" : ""}`}>
                  <span className="sp-day-name">{name.toUpperCase()}</span>
                  <span className="sp-day-num">{dayNum}</span>
                </div>
                {classes.map((c, ci) => (
                  <div key={ci} className={`sp-class-pill ${c.kind}`}>
                    {c.period && <span className="sp-pill-period">{c.period}{c.teacher ? ` · ${c.teacher}` : ""}</span>}
                    <span className="sp-pill-subject">{c.subject}</span>
                    {c.note && <span className="sp-pill-note">{c.note}</span>}
                  </div>
                ))}
                {hw.map((h, hi) => (
                  <div key={hi} className={`sp-hw-pill${h.urgent ? " urgent" : ""}`}>
                    <span className="sp-hw-title">{h.title}</span>
                    {h.time && <span className="sp-hw-time">{h.time}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* WHAT MANHAJ SUGGESTS */}
      <div className="sp-suggests-section">
        <div className="sp-suggests-hdr">
          <span className="sp-section-label">WHAT MANHAJ SUGGESTS YOU STUDY</span>
          <span className="sp-suggests-note">Pulled from your goals + upcoming tests · pick what fits</span>
        </div>
        <div className="sp-suggests-card">
          <div className="sp-suggests-intro">
            <span className="sp-suggests-intro-num">{suggestions.length}</span>
            <div>
              <div className="sp-suggests-intro-title">{suggestions.length} short sessions worth doing this week</div>
              <div className="sp-suggests-intro-sub">Build from {isMock ? "Thursday's test, your behind goal, and your Arabic plan" : "your upcoming tests and goals"}.</div>
            </div>
          </div>
          <div className="sp-suggests-cols">
            {suggestions.map((s, i) => (
              <div key={i} className="sp-suggest-col">
                <span
                  className="sp-suggest-type"
                  style={{ background: SUGGEST_BADGE_COLORS[s.type] ?? "#EDF2F7" }}
                >
                  {s.type}
                </span>
                <div className="sp-suggest-title">{s.title}</div>
                <div className="sp-suggest-desc">{s.desc}</div>
                <div className="sp-suggest-footer">
                  <span className="sp-suggest-time">{s.time}</span>
                  <button className="sp-suggest-add">+ Add to {s.addTo} +</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* YOUR SUGGESTED AFTERNOON */}
      <div className="sp-afternoon-section">
        <div className="sp-afternoon-hdr">
          <span className="sp-section-label">YOUR SUGGESTED AFTERNOON — {todayDow}</span>
          <span className="sp-suggests-note">A possible plan · drag the blocks to adjust</span>
        </div>
        <div className="sp-timeline">
          {MOCK_AFTERNOON.map((block, i) => {
            const tagStyle = AFTERNOON_TAG[block.tag] ?? { bg: "#EDF2F7", color: "#4A5568" };
            return (
              <div key={i} className="sp-timeline-row">
                <span className="sp-timeline-time">{block.time}</span>
                <div className="sp-timeline-block">
                  <div className="sp-timeline-title">{block.title}</div>
                  {block.sub && <div className="sp-timeline-sub">{block.sub}</div>}
                </div>
                <span className="sp-timeline-tag" style={{ background: tagStyle.bg, color: tagStyle.color }}>
                  {block.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
