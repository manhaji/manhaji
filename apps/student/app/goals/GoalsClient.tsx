"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  RubricSuggestionData,
  StudentGoal,
  GoalReflection,
  GoalCheckin,
  GoalKind,
} from "@manhaj/lib/queries/goals";
import {
  addGoalAction,
  fetchGoalHistoryAction,
  tickGoalAction,
  saveReflectionAction,
} from "@/app/actions/goals";

type GoalStatus = "done" | "active" | "behind";

type DisplayGoal = {
  id: string;
  dbId: string | null;          // null = demo goal (no DB row)
  title: string;
  category: string;             // badge label
  setWith: string;
  frequency: string;
  progressLabel: string;
  progressPct: number;
  status: GoalStatus;
  highlight: string;
  tickLabel: string;            // label for the check-in button
};

type Suggestion = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  live: boolean;                      // signed-in student session present
  studentName: string;
  rubricScores: RubricSuggestionData[];
  goals: StudentGoal[];               // DB goals ([] → demo fallback)
  savedReflection: GoalReflection | null;
};

// ── Category styling ─────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { cls: string; border: string }> = {
  ACADEMIC:      { cls: "myg-cat-academic", border: "#3182CE" },
  PERSONAL:      { cls: "myg-cat-personal", border: "#38A169" },
  COLLABORATION: { cls: "myg-cat-collab",   border: "#805AD5" },
  BEHAVIOUR:     { cls: "myg-cat-collab",   border: "#805AD5" },
  ARABIC:        { cls: "myg-cat-arabic",   border: "#ED8936" },
  MATHS:         { cls: "myg-cat-maths",    border: "#319795" },
  UNIVERSITY:    { cls: "myg-cat-academic", border: "#2B6CB0" },
};

const KIND_LABEL: Record<GoalKind, string> = {
  academic:        "ACADEMIC",
  personal:        "PERSONAL",
  behavioural:     "BEHAVIOUR",
  university_prep: "UNIVERSITY",
};

const KIND_OPTIONS: Array<{ value: GoalKind; label: string }> = [
  { value: "academic",        label: "Academic"        },
  { value: "personal",        label: "Personal"        },
  { value: "behavioural",     label: "Behaviour"       },
  { value: "university_prep", label: "University prep" },
];

// ── Demo goals (shown only when the DB has none) ─────────────────────────────

const MOCK_GOALS: DisplayGoal[] = [
  {
    id: "g1", dbId: null,
    title: "Score 90%+ in every maths quiz",
    category: "ACADEMIC", setWith: "Mr. Tariq", frequency: "4 quiz min",
    progressLabel: "4 of 4 quizzes hit", progressPct: 100, status: "done",
    highlight: "Highest quiz score this month: 93% on chapter 4 — top of class!",
    tickLabel: "✓ Tick today",
  },
  {
    id: "g2", dbId: null,
    title: "Read for 30 minutes every day",
    category: "PERSONAL", setWith: "you", frequency: "Self-reported · daily check-in",
    progressLabel: "12-day streak — keep going!", progressPct: 92, status: "active",
    highlight: "Streak: 12 days · longest streak ever: 14 days · don't break the chain!",
    tickLabel: "✓ Tick today",
  },
  {
    id: "g3", dbId: null,
    title: "Help 1 new classmate each week",
    category: "COLLABORATION", setWith: "Ms. Reem (counselor)", frequency: "Linked to rubric · self + teacher checked",
    progressLabel: "3 of 4 weeks this month", progressPct: 75, status: "active",
    highlight: "Ms. Sara noticed you helping the new student at lunch on Thursday — that counts!",
    tickLabel: "✓ Add this week",
  },
  {
    id: "g4", dbId: null,
    title: "Master all 60 chapter-6 Arabic words",
    category: "ARABIC", setWith: "Ms. Maryam", frequency: "Self-quizzed · ~15 a week",
    progressLabel: "54 of 60 words mastered", progressPct: 90, status: "active",
    highlight: "Almost there — just 6 more words to go. You're ahead of schedule!",
    tickLabel: "✓ Tick today",
  },
];

const MOCK_HISTORY: GoalCheckin[] = [
  { id: "h1", checkedOn: "2026-05-24", progressPct: 100, value: 93, notes: "Chapter 4 quiz — 93%", source: "student" },
  { id: "h2", checkedOn: "2026-05-17", progressPct: 75,  value: 91, notes: "Chapter 3 quiz — 91%", source: "student" },
  { id: "h3", checkedOn: "2026-05-10", progressPct: 50,  value: 90, notes: "Chapter 2 quiz — 90%", source: "student" },
  { id: "h4", checkedOn: "2026-05-03", progressPct: 25,  value: 92, notes: "Chapter 1 quiz — 92%", source: "student" },
];

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    title: "Practise explaining your maths thinking out loud",
    description: "Your 'communication of reasoning' axis is your lowest — and the easiest to improve quickly. Mr. Tariq could pair you with a younger student once a week to explain a problem.",
  },
  {
    id: "s2",
    title: "Try one Arabic short story a week",
    description: "You're crushing vocabulary — try connecting it. Reading short stories will help fluency more than another word list.",
  },
];

const DEMO_REFLECTION =
  "Maths is starting to make more sense, especially fractions. I felt proud about the chapter 4 quiz. Reading every day has helped my vocabulary.";

// ── Helpers ──────────────────────────────────────────────────────────────────

function barColor(status: GoalStatus): string {
  if (status === "done")   return "#38A169";
  if (status === "behind") return "#ED8936";
  return "#3182CE";
}

function buildSuggestions(rubricScores: RubricSuggestionData[]): Suggestion[] {
  const low = rubricScores
    .filter(r => r.score !== null && r.score <= 2)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 2);
  if (!low.length) return DEFAULT_SUGGESTIONS;
  return low.map(r => ({
    id: r.axisCode,
    title: `Improve your ${r.axisCode.toLowerCase().replace(/_/g, " ")} skills`,
    description: `Your score on this area is ${r.score}/5 — a good area to set a goal around this month.`,
  }));
}

function fmtDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

function endOfMonth(offsetMonths: number): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offsetMonths + 1, 0))
    .toISOString().slice(0, 10);
}

function mapDbGoal(g: StudentGoal): DisplayGoal {
  const status: GoalStatus =
    g.status === "met" ? "done" : g.status === "at_risk" || g.status === "missed" ? "behind" : "active";
  const pct = g.progressPct ?? (status === "done" ? 100 : 0);
  return {
    id: g.id,
    dbId: g.id,
    title: g.title,
    category: KIND_LABEL[g.kind] ?? "ACADEMIC",
    setWith: g.createdByRole === "student" ? "you" : `your ${g.createdByRole}`,
    frequency: g.dueOn ? `Due ${fmtDate(g.dueOn)}` : "No due date",
    progressLabel: g.checkinCount > 0
      ? `${g.checkinCount} check-in${g.checkinCount === 1 ? "" : "s"} · last ${fmtDate(g.lastCheckinOn!)}`
      : "No check-ins yet — tick a day to start",
    progressPct: pct,
    status,
    highlight: g.description ?? "Tick a check-in each time you make progress — your history builds here.",
    tickLabel: "✓ Check in today",
  };
}

const CURRENT_MONTH = new Date().toLocaleString("en", { month: "long" });

// ── Component ────────────────────────────────────────────────────────────────

export default function GoalsClient({ live, studentName, rubricScores, goals, savedReflection }: Props) {
  const router = useRouter();
  const displayName = studentName || "Layla";
  const usingDb = live && goals.length > 0;

  // Local demo goals added while there's no DB session
  const [localGoals, setLocalGoals] = useState<DisplayGoal[]>([]);
  const baseGoals: DisplayGoal[] = usingDb ? goals.map(mapDbGoal) : MOCK_GOALS;
  const allGoals = [...baseGoals, ...localGoals];

  const [ticked, setTicked]         = useState<Record<string, boolean>>({});
  const [demoNote, setDemoNote]     = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  // Add-goal modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [formTitle, setFormTitle]   = useState("");
  const [formKind, setFormKind]     = useState<GoalKind>("academic");
  const [formDue, setFormDue]       = useState(endOfMonth(0));
  const [formDesc, setFormDesc]     = useState("");
  const [formError, setFormError]   = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  // History modal
  const [historyFor, setHistoryFor]     = useState<DisplayGoal | null>(null);
  const [history, setHistory]           = useState<GoalCheckin[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Suggestions
  const [addedSuggestions, setAddedSuggestions] = useState<Record<string, boolean>>({});

  // Reflection
  const [reflection, setReflection] = useState(
    live ? (savedReflection?.body ?? "") : DEMO_REFLECTION,
  );
  const [reflectionState, setReflectionState] = useState<"idle" | "saving" | "saved" | "demo-saved" | "error">("idle");
  const [reflectionError, setReflectionError] = useState<string | null>(null);

  const activeCount = allGoals.filter(g => g.status !== "done").length;
  const doneCount   = allGoals.filter(g => g.status === "done").length;
  const checkinTotal = usingDb
    ? goals.reduce((s, g) => s + g.checkinCount, 0)
    : 12;

  const suggestions = buildSuggestions(rubricScores);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAddModal(prefillTitle?: string, forNextMonth?: boolean) {
    setFormTitle(prefillTitle ?? "");
    setFormKind("academic");
    setFormDue(endOfMonth(forNextMonth ? 1 : 0));
    setFormDesc("");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleAddGoal() {
    if (!formTitle.trim()) { setFormError("Give your goal a name first."); return; }
    setSaving(true);
    setFormError(null);
    const res = await addGoalAction({
      title: formTitle, kind: formKind, dueOn: formDue || undefined,
      description: formDesc || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      startTransition(() => router.refresh());
      return;
    }
    if (res.error === "not_signed_in") {
      // Demo fallback — keep the goal locally so the flow still works.
      setLocalGoals(p => [...p, {
        id: `local-${Date.now()}`, dbId: null,
        title: formTitle.trim(),
        category: KIND_LABEL[formKind],
        setWith: "you",
        frequency: formDue ? `Due ${fmtDate(formDue)}` : "No due date",
        progressLabel: "No check-ins yet — tick a day to start",
        progressPct: 0, status: "active",
        highlight: formDesc || "Tick a check-in each time you make progress.",
        tickLabel: "✓ Check in today",
      }]);
      setModalOpen(false);
      setDemoNote("Demo mode — sign in as a student to save goals to your school record.");
      return;
    }
    setFormError(res.error);
  }

  async function handleTick(goal: DisplayGoal) {
    if (ticked[goal.id]) return;
    setTicked(p => ({ ...p, [goal.id]: true }));  // optimistic
    if (goal.dbId) {
      const next = Math.min(100, (goal.progressPct ?? 0) + 10);
      const res = await tickGoalAction(goal.dbId, next);
      if (res.ok) startTransition(() => router.refresh());
      else if (res.error !== "not_signed_in") {
        setTicked(p => ({ ...p, [goal.id]: false }));
        setDemoNote(`Couldn't save that check-in: ${res.error}`);
      }
    }
  }

  async function openHistory(goal: DisplayGoal) {
    setHistoryFor(goal);
    if (!goal.dbId) { setHistory(MOCK_HISTORY); return; }
    setHistory(null);
    setHistoryLoading(true);
    const res = await fetchGoalHistoryAction(goal.dbId);
    setHistoryLoading(false);
    setHistory(res.ok ? (res.data ?? []) : []);
  }

  async function handleAddSuggestion(s: Suggestion) {
    if (addedSuggestions[s.id]) return;
    setAddedSuggestions(p => ({ ...p, [s.id]: true }));
    const res = await addGoalAction({
      title: s.title, kind: "academic", dueOn: endOfMonth(0), description: s.description,
    });
    if (res.ok) { startTransition(() => router.refresh()); return; }
    if (res.error === "not_signed_in") {
      setLocalGoals(p => [...p, {
        id: `local-sug-${s.id}`, dbId: null,
        title: s.title, category: "ACADEMIC", setWith: "Manhaji",
        frequency: `Due ${fmtDate(endOfMonth(0))}`,
        progressLabel: "No check-ins yet — tick a day to start",
        progressPct: 0, status: "active", highlight: s.description,
        tickLabel: "✓ Check in today",
      }]);
      setDemoNote("Demo mode — sign in as a student to save goals to your school record.");
    } else {
      setAddedSuggestions(p => ({ ...p, [s.id]: false }));
      setDemoNote(`Couldn't add that goal: ${res.error}`);
    }
  }

  async function handleSaveReflection() {
    setReflectionState("saving");
    setReflectionError(null);
    const res = await saveReflectionAction(reflection);
    if (res.ok) {
      setReflectionState("saved");
      startTransition(() => router.refresh());
      return;
    }
    if (res.error === "not_signed_in") { setReflectionState("demo-saved"); return; }
    setReflectionState("error");
    setReflectionError(res.error);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="myg-page">

      {/* Title */}
      <div className="myg-title-row">
        <h1 className="myg-title">My goals · {CURRENT_MONTH}</h1>
        <p className="myg-subtitle">What you&apos;re working on this month. Set a few, track your progress, celebrate the wins.</p>
      </div>

      {demoNote && (
        <div className="myg-demo-note" role="status">
          {demoNote}
          <button className="myg-demo-note-close" onClick={() => setDemoNote(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Summary card */}
      <div className="myg-summary-card">
        <div className="myg-summary-left">
          <span className="myg-summary-icon">☀️</span>
          <div>
            <div className="myg-summary-headline">
              {allGoals.length === 0
                ? "No goals yet — add your first one below."
                : `You're working on ${activeCount} goal${activeCount === 1 ? "" : "s"}${doneCount > 0 ? ` and you've completed ${doneCount}` : ""}.`}
            </div>
            <div className="myg-summary-sub">
              {usingDb
                ? "Tick a check-in whenever you make progress — your teacher sees the same picture."
                : `Big week — your maths quiz score (92%) hit your '90% quiz' goal. And you read every day for 12 days straight!`}
            </div>
          </div>
        </div>
        <div className="myg-kpis">
          <div className="myg-kpi">
            <div className="myg-kpi-num">{activeCount}</div>
            <div className="myg-kpi-label">ACTIVE</div>
          </div>
          <div className="myg-kpi">
            <div className="myg-kpi-num">{doneCount}</div>
            <div className="myg-kpi-label">DONE</div>
          </div>
          <div className="myg-kpi">
            <div className="myg-kpi-num">{checkinTotal}</div>
            <div className="myg-kpi-label">{usingDb ? "CHECK-INS" : "DAY STREAK"}</div>
          </div>
        </div>
      </div>

      {/* Active Goals */}
      <div className="myg-section-hdr">
        <span className="myg-section-label">ACTIVE GOALS</span>
        <button className="myg-add-btn" onClick={() => openAddModal()}>+ Add a goal</button>
      </div>

      <div className="myg-goals-grid">
        {allGoals.map(goal => {
          const cat = CAT_STYLE[goal.category] ?? CAT_STYLE.ACADEMIC;
          return (
            <div key={goal.id} className="myg-goal-card" style={{ borderTopColor: cat.border }}>
              {/* Top row */}
              <div className="myg-card-top">
                <span className={`myg-cat-badge ${cat.cls}`}>{goal.category}</span>
                {goal.status === "done" && <span className="myg-done-badge">✓ DONE</span>}
                <span className="myg-goal-freq">{goal.frequency}</span>
              </div>

              {/* Title */}
              <div className="myg-goal-title">{goal.title}</div>

              {/* Progress */}
              <div className="myg-progress-row">
                <span className="myg-progress-label">{goal.progressLabel}</span>
                <span className="myg-progress-pct">{goal.progressPct}%</span>
              </div>
              <div className="myg-bar-wrap">
                <div
                  className="myg-bar-fill"
                  style={{ width: `${goal.progressPct}%`, background: barColor(goal.status) }}
                />
              </div>

              {/* Highlight */}
              <div className="myg-highlight">{goal.highlight}</div>

              {/* Footer */}
              <div className="myg-card-footer">
                <span className="myg-set-by">Set with {goal.setWith}</span>
                <div className="myg-card-actions">
                  <button className="myg-action-btn" onClick={() => openHistory(goal)}>See history</button>
                  {goal.status === "done" ? (
                    <button
                      className="myg-action-btn primary"
                      onClick={() => openAddModal(goal.title, true)}
                    >
                      Set next month&apos;s →
                    </button>
                  ) : (
                    <button className="myg-action-btn primary" onClick={() => handleTick(goal)}>
                      {ticked[goal.id] ? "✓ Ticked!" : goal.tickLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI practice card — visible but unlinked (Phase 2) */}
        <div className="myg-goal-card wide myg-ai-card" style={{ borderTopColor: "#319795" }}>
          <div className="myg-card-top">
            <span className="myg-cat-badge myg-cat-maths">MATHS</span>
            <span className="myg-phase2-pill">AI PRACTICE · PHASE 2</span>
            <span className="myg-goal-freq">Practise 5 a week · 10 weeks</span>
          </div>
          <div className="myg-goal-title">Get better at multi-step word problems</div>
          <div className="myg-highlight">
            Manhaji will generate practice problems matched to your level and track them here.
            This AI module arrives in Phase 2 — for now, ask Mr. Tariq for this week&apos;s problem sheet.
          </div>
        </div>
      </div>

      {/* Manhaji Suggests */}
      <div className="myg-section-hdr myg-section-hdr-gap">
        <span className="myg-section-label">GOALS MANHAJI SUGGESTS</span>
        <span className="myg-suggests-note">Based on your rubric scores · pick what feels right</span>
      </div>
      <div className="myg-suggests-card">
        <div className="myg-suggests-grid">
          {suggestions.map(s => (
            <div key={s.id} className="myg-suggest-item">
              <div className="myg-suggest-title">{s.title}</div>
              <div className="myg-suggest-desc">{s.description}</div>
              <button
                className={`myg-suggest-add${addedSuggestions[s.id] ? " added" : ""}`}
                onClick={() => handleAddSuggestion(s)}
                disabled={!!addedSuggestions[s.id]}
              >
                {addedSuggestions[s.id] ? "✓ Added to your goals" : "+ Add this as a goal"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Reflection */}
      <div className="myg-reflection-section">
        <div className="myg-section-hdr">
          <span className="myg-section-label">QUICK REFLECTION</span>
          <span className="myg-suggests-note">Private to you and your teacher · saved with your monthly report</span>
        </div>
        <div className="myg-reflection-card">
          <div className="myg-reflection-label">WHAT WENT WELL THIS MONTH?</div>
          <textarea
            className="myg-reflection-textarea"
            value={reflection}
            rows={4}
            placeholder="A sentence or two about your month — what clicked, what you're proud of…"
            onChange={e => { setReflection(e.target.value); setReflectionState("idle"); }}
          />
          <div className="myg-reflection-footer">
            <span className="myg-reflection-note">
              {reflectionState === "saved"      && "Saved ✓ · stored with your monthly report"}
              {reflectionState === "demo-saved" && "Saved for this session (demo) — sign in to keep it"}
              {reflectionState === "saving"     && "Saving…"}
              {reflectionState === "error"      && `Couldn't save: ${reflectionError}`}
              {reflectionState === "idle" && (
                live && savedReflection
                  ? `Last saved ${fmtDate(savedReflection.createdAt.slice(0, 10))} · only you, your teacher, and ${displayName}'s parents can see this`
                  : `Only you, your teacher, and ${displayName}'s parents can see this`
              )}
            </span>
            <button
              className="myg-save-btn"
              onClick={handleSaveReflection}
              disabled={reflectionState === "saving"}
            >
              Save reflection
            </button>
          </div>
        </div>
      </div>

      {/* ── Add-goal modal ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="stu-modal-bg" onClick={() => setModalOpen(false)}>
          <div className="stu-modal" role="dialog" aria-modal="true" aria-label="Add a goal" onClick={e => e.stopPropagation()}>
            <div className="stu-modal-head">
              <h3>Add a goal</h3>
              <button className="stu-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="stu-modal-body">
              <label className="stu-field">
                <span className="stu-field-label">What&apos;s the goal?</span>
                <input
                  className="stu-input"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Score 90%+ in every maths quiz"
                  autoFocus
                />
              </label>
              <div className="stu-field-row">
                <label className="stu-field">
                  <span className="stu-field-label">Category</span>
                  <select className="stu-input" value={formKind} onChange={e => setFormKind(e.target.value as GoalKind)}>
                    {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </label>
                <label className="stu-field">
                  <span className="stu-field-label">Target date</span>
                  <input className="stu-input" type="date" value={formDue} onChange={e => setFormDue(e.target.value)} />
                </label>
              </div>
              <label className="stu-field">
                <span className="stu-field-label">How will you know you&apos;re on track? <em>(optional)</em></span>
                <textarea
                  className="stu-input"
                  rows={2}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="e.g. Practise 5 problems a week"
                />
              </label>
              {formError && <div className="stu-form-error" role="alert">{formError}</div>}
            </div>
            <div className="stu-modal-foot">
              <button className="myg-action-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="myg-action-btn primary" onClick={handleAddGoal} disabled={saving}>
                {saving ? "Adding…" : "Add goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History modal ──────────────────────────────────────────────────── */}
      {historyFor && (
        <div className="stu-modal-bg" onClick={() => setHistoryFor(null)}>
          <div className="stu-modal" role="dialog" aria-modal="true" aria-label="Goal history" onClick={e => e.stopPropagation()}>
            <div className="stu-modal-head">
              <h3>History · {historyFor.title}</h3>
              <button className="stu-modal-close" onClick={() => setHistoryFor(null)} aria-label="Close">×</button>
            </div>
            <div className="stu-modal-body">
              {historyLoading && <div className="stu-modal-hint">Loading check-ins…</div>}
              {!historyLoading && history !== null && history.length === 0 && (
                <div className="stu-modal-hint">
                  No check-ins yet — tick &quot;{historyFor.tickLabel.replace("✓ ", "")}&quot; on the goal card to start your history.
                </div>
              )}
              {!historyLoading && history !== null && history.length > 0 && (
                <ol className="myg-history-list">
                  {history.map(h => (
                    <li key={h.id} className="myg-history-row">
                      <span className="myg-history-date">{fmtDate(h.checkedOn)}</span>
                      <span className="myg-history-body">
                        {h.notes ?? (h.source === "auto" ? "Automatic check-in" : "Checked in")}
                      </span>
                      {h.progressPct !== null && (
                        <span className="myg-history-pct">{h.progressPct}%</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {!historyFor.dbId && (
                <div className="stu-modal-hint">Sample history — sign in as a student to see your real check-ins.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
