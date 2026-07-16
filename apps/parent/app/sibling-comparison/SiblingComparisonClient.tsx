"use client";

import type { ParentChild } from "@manhaj/lib/queries/parents";
import type { InvoiceWithLines } from "@manhaj/lib/queries/invoices";
import type { ActivitySlip } from "@manhaj/lib/queries/permissionslip";

type ChildSiblingData = {
  child: ParentChild;
  formTeacher: string | null;
  att: { pct: number; absences: number };
  homeworkCount: number;
  latestResult: { pct: number; subject: string; held_on: string } | null;
  positiveNotes: number;
  concernNotes: number;
  latestRecognition: string | null;
  latestRecognitionTeacher: string | null;
  pendingSlips: ActivitySlip[];
  courseSelection: { status: string; picks_count: number; submitted_at: string | null } | null;
  digestText: string | null;
  nextExam: { label: string; held_on: string; subject: string } | null;
};

interface Props {
  childData: ChildSiblingData[];
  unpaidInvoices: InvoiceWithLines[];
  weekStart: string;
  weekEnd: string;
  isMock: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayName(iso: string) {
  return SHORT_DAYS[new Date(iso + "T00:00:00Z").getUTCDay()] ?? "";
}

function fmtWeekRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
  const s = new Date(start + "T00:00:00Z").toLocaleDateString("en-GB", opts);
  const e = new Date(end   + "T00:00:00Z").toLocaleDateString("en-GB", opts);
  return `${s} — ${e}`;
}

function fmtDateShort(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// 5-day school week present count
function presentDays(att: { pct: number; absences: number }) {
  return 5 - att.absences;
}

const CHILD_COLORS = ["#3182CE", "#805AD5", "#2F855A", "#C05621"];

function childColor(idx: number) { return CHILD_COLORS[idx % CHILD_COLORS.length]; }

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_AI_SUMMARY =
  "Good news this week: Omar's recovering from Monday's absence and is on track for Thursday's science exam · Layla had her strongest maths week of the term · Yasmin wrote her own name unaided for the first time. 3 things need your attention — see below.";

const MOCK_CHILDREN: ChildSiblingData[] = [
  {
    child: { student_id: "m1", full_name_en: "Omar Al-Habsi",  initial: "O", section_id: "s1", section_code: "7B",  grade_level: "Grade 7"  },
    formTeacher: "Ms. Khadija",
    att: { pct: 80, absences: 1 },
    homeworkCount: 4,
    latestResult: { pct: 88, subject: "Science", held_on: "2026-05-28" },
    positiveNotes: 1, concernNotes: 2,
    latestRecognition: "Missed Monday (recorded sick — note from you). Caught up by Wednesday with no missed deadlines.",
    latestRecognitionTeacher: null,
    pendingSlips: [],
    courseSelection: { status: "draft", picks_count: 2, submitted_at: null },
    digestText: null,
    nextExam: { label: "Science exam", held_on: "2026-05-29", subject: "Science" },
  },
  {
    child: { student_id: "m2", full_name_en: "Layla Al-Habsi", initial: "L", section_id: "s2", section_code: "10A",  grade_level: "Grade 10"  },
    formTeacher: "Ms. Tariq",
    att: { pct: 100, absences: 0 },
    homeworkCount: 3,
    latestResult: { pct: 92, subject: "Maths", held_on: "2026-05-27" },
    positiveNotes: 2, concernNotes: 2,
    latestRecognition: "Best maths week of the term — top score on Tuesday's quiz. Ms. Sara noted 'remarkable vocabulary growth' in English.",
    latestRecognitionTeacher: "Ms. Sara",
    pendingSlips: [
      {
        activityId: "a1", slipId: null, status: "not_started", slipNotes: null,
        signedAt: null, signedName: null,
        title: "Bait Al Zubair Museum", location: "Muscat",
        activityDate: "2026-06-03", departTime: "08:30", returnTime: "13:30",
        transport: "School bus", costAed: 35, supervisorRatio: null,
        curriculumLink: null, riskPdfPath: null,
        description: null, deadline: "2026-06-02",
      },
    ],
    courseSelection: null,
    digestText: null,
    nextExam: { label: "Field trip", held_on: "2026-06-03", subject: "Field trip" },
  },
  {
    child: { student_id: "m3", full_name_en: "Yasmin Al-Habsi", initial: "Y", section_id: "s3", section_code: "KG2",  grade_level: "KG2"       },
    formTeacher: "Ms. Layla",
    att: { pct: 100, absences: 0 },
    homeworkCount: 5,
    latestResult: null,
    positiveNotes: 3, concernNotes: 0,
    latestRecognition: "Big week, Ms. Layla. 'Bright and curious — asking thoughtful questions in story time.' New friend made: Salim from Class C.",
    latestRecognitionTeacher: "Ms. Layla",
    pendingSlips: [],
    courseSelection: null,
    digestText: null,
    nextExam: { label: "Show & tell", held_on: "2026-05-29", subject: "Show & tell" },
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="sc-kpi">
      <div className="sc-kpi-label">{label}</div>
      <div className="sc-kpi-value">{value}</div>
      <div className="sc-kpi-sub">{sub}</div>
    </div>
  );
}

function ChildCard({ entry, idx, isMock }: { entry: ChildSiblingData; idx: number; isMock: boolean }) {
  const color     = childColor(idx);
  const present   = presentDays(entry.att);
  const isKG      = entry.child.grade_level?.toLowerCase().startsWith("kg");
  const firstName = entry.child.full_name_en.split(" ")[0];
  const topSlip   = entry.pendingSlips[0] ?? null;
  const homeworkLabel = isMock
    ? (idx === 0 ? "95%" : idx === 1 ? "89%" : "100%")
    : (entry.homeworkCount > 0 ? `${entry.homeworkCount}` : "—");
  const homeworkSub = isMock
    ? (idx === 0 ? "on track" : idx === 1 ? "1 missed" : "all complete")
    : (entry.homeworkCount > 0 ? `${entry.homeworkCount} this week` : "none assigned");

  return (
    <div className="sc-child-card">
      {/* Header */}
      <div className="sc-card-head">
        <div className="sc-card-avatar" style={{ background: color }}>{entry.child.initial}</div>
        <div>
          <div className="sc-card-name">{entry.child.full_name_en}</div>
          <div className="sc-card-meta">
            {entry.child.grade_level ?? entry.child.section_code}
            {entry.formTeacher ? ` · ${entry.formTeacher}` : ""}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="sc-kpi-grid">
        <KpiBlock
          label="ATTENDANCE"
          value={`${entry.att.pct}%`}
          sub={`${present} of 5 days`}
        />
        <KpiBlock
          label={isKG && isMock ? "ACTIVITIES DONE" : "HOMEWORK"}
          value={homeworkLabel}
          sub={homeworkSub}
        />
      </div>
      <div className="sc-kpi-grid">
        {entry.latestResult
          ? <KpiBlock
              label="LATEST GRADE"
              value={`${entry.latestResult.pct}%`}
              sub={`${entry.latestResult.subject} · ${dayName(entry.latestResult.held_on)}`}
            />
          : isKG && isMock
          ? <div className="sc-kpi">
              <div className="sc-kpi-label">HIGHLIGHT</div>
              <div className="sc-kpi-value sc-kpi-value--sm">Wrote his name unaided</div>
              <div className="sc-kpi-sub">Tuesday · first time</div>
            </div>
          : <KpiBlock label="LATEST GRADE" value="—" sub="no assessments yet" />
        }
        <KpiBlock
          label="BEHAVIOUR"
          value={`+${entry.positiveNotes}`}
          sub={entry.positiveNotes === 1 ? "recognition" : "recognitions"}
        />
      </div>

      {/* Note */}
      {entry.latestRecognition && (
        <p className="sc-card-note">{entry.latestRecognition}</p>
      )}

      {/* Pending action */}
      {topSlip && (
        <div className="sc-card-action">
          <span className="sc-card-action-text">
            Sign field-trip consent — due {fmtDateShort(topSlip.deadline ?? topSlip.activityDate)}
          </span>
          <a href="/parent/permission-slip" className="sc-card-action-btn" style={{ background: color }}>Sign</a>
        </div>
      )}
      {!topSlip && entry.courseSelection && entry.courseSelection.status !== "submitted" && (
        <div className="sc-card-action">
          <span className="sc-card-action-text">
            Sign Term 4 elective selection — due Sun 8 June
          </span>
          <a href="/parent/courses" className="sc-card-action-btn" style={{ background: color }}>Open form</a>
        </div>
      )}
      {isMock && idx === 2 && (
        <div className="sc-card-action">
          <span className="sc-card-action-text">Confirm pickup-person change for Wed</span>
          <button className="sc-card-action-btn" style={{ background: color }}>Confirm</button>
        </div>
      )}

      {/* Footer */}
      <div className="sc-card-footer">
        <a href="#" className="sc-card-viewfull">Open {firstName}&apos;s full view →</a>
        <div className="sc-card-footer-icons">
          <span title="Grades">📊</span>
          <span title="Calendar">📅</span>
          <span title="Reports">📋</span>
        </div>
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────

function ComparisonTable({ entries, isMock }: { entries: ChildSiblingData[]; isMock: boolean }) {
  const rows = [
    {
      label: "Attendance",
      cells: entries.map(e => {
        const p = presentDays(e.att);
        return { main: `${p}/5`, sub: e.att.absences > 0 ? `${e.att.absences} sick day` : "full" };
      }),
    },
    {
      label: "Homework / activities",
      cells: entries.map((e, i) => isMock
        ? (i === 0 ? { main: "95%", sub: "1 late" } : i === 1 ? { main: "89%", sub: "1 missed" } : { main: "100%", sub: "all done" })
        : { main: e.homeworkCount > 0 ? `${e.homeworkCount}` : "—", sub: "" }
      ),
    },
    {
      label: "Latest assessment",
      cells: entries.map(e => e.latestResult
        ? { main: `${e.latestResult.pct}%`, sub: `${e.latestResult.subject} · ${dayName(e.latestResult.held_on)}` }
        : { main: "—", sub: "no assessments" }
      ),
    },
    {
      label: "Behaviour notes",
      cells: entries.map(e => ({
        main: `+${e.positiveNotes}`,
        sub: `${e.concernNotes} incident${e.concernNotes !== 1 ? "s" : ""}`,
      })),
    },
    {
      label: "Next big thing",
      cells: entries.map(e => e.nextExam
        ? { main: e.nextExam.subject, sub: dayName(e.nextExam.held_on) }
        : { main: "—", sub: "" }
      ),
    },
  ];

  return (
    <div className="sc-cmp-wrap">
      <table className="sc-cmp-table">
        <thead>
          <tr>
            <th className="sc-cmp-th-label"></th>
            {entries.map((e, i) => (
              <th key={e.child.student_id} className="sc-cmp-th-child" style={{ color: childColor(i) }}>
                {e.child.full_name_en.split(" ")[0].toUpperCase()} · {e.child.section_code.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="sc-cmp-row">
              <td className="sc-cmp-row-label">{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className="sc-cmp-cell">
                  <div className="sc-cmp-main">{cell.main}</div>
                  {cell.sub && <div className="sc-cmp-sub">{cell.sub}</div>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Attention items ───────────────────────────────────────────────────────────

type AttentionItem = {
  tag: string;
  color: string;
  title: string;
  sub: string;
  action: string;
  href: string;
};

function buildAttentionItems(entries: ChildSiblingData[], unpaidInvoices: InvoiceWithLines[], isMock: boolean): AttentionItem[] {
  if (isMock) {
    return [
      { tag: "YASMIN", color: CHILD_COLORS[2], title: "Confirm pickup-person change for Wednesday", sub: "Auntie Mariam is collecting — please confirm by tomorrow", action: "Confirm", href: "#" },
      { tag: "LAYLA", color: CHILD_COLORS[1], title: "Sign field-trip consent · Bait Al Zubair", sub: "Trip is Wed 3 June · signature due by Tuesday", action: "Sign now", href: "/parent/permission-slip" },
      { tag: "OMAR",  color: CHILD_COLORS[0], title: "Sign Term 4 elective selection", sub: "3 options to choose from · due Sunday 8 June", action: "Open form", href: "/parent/courses" },
      { tag: "FAMILY", color: "#DD6B20", title: "Term 3 fees — Installment 3 of 4", sub: "5 invoices · total AED 26,250 · due 15 June", action: "View invoices", href: "/parent/invoices" },
    ];
  }

  const items: AttentionItem[] = [];

  entries.forEach((e, i) => {
    const firstName = e.child.full_name_en.split(" ")[0];
    const color = childColor(i);

    for (const slip of e.pendingSlips.slice(0, 1)) {
      items.push({
        tag: firstName.toUpperCase(), color,
        title: `Sign field-trip consent · ${slip.title}`,
        sub: slip.deadline ? `Trip is ${fmtDateShort(slip.activityDate)} · signature due ${fmtDateShort(slip.deadline)}` : `Trip on ${fmtDateShort(slip.activityDate)}`,
        action: "Sign now",
        href: "/parent/permission-slip",
      });
    }

    if (e.courseSelection && e.courseSelection.status !== "submitted" && e.courseSelection.status !== "locked") {
      items.push({
        tag: firstName.toUpperCase(), color,
        title: `Sign Term 4 elective selection`,
        sub: `${e.courseSelection.picks_count} options to choose from`,
        action: "Open form",
        href: "/parent/courses",
      });
    }
  });

  if (unpaidInvoices.length > 0) {
    const total = unpaidInvoices.reduce((s, i) => s + i.amount_owed_aed, 0);
    const earliest = [...unpaidInvoices].sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""))[0];
    items.push({
      tag: "FAMILY", color: "#DD6B20",
      title: `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length > 1 ? "s" : ""}`,
      sub: `Total AED ${total.toLocaleString()}${earliest?.due_on ? ` · due ${fmtDateShort(earliest.due_on)}` : ""}`,
      action: "View invoices",
      href: "/parent/invoices",
    });
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SiblingComparisonClient({ childData, unpaidInvoices, weekStart, weekEnd, isMock }: Props) {
  const entries  = isMock ? MOCK_CHILDREN : childData;
  const weekLabel = fmtWeekRange(weekStart, weekEnd);
  const nameList  = entries.map(e => e.child.full_name_en.split(" ")[0]).join(", ");

  const aiSummary = isMock
    ? MOCK_AI_SUMMARY
    : entries.map(e => e.digestText).find(Boolean) ?? null;

  const attentionItems = buildAttentionItems(entries, unpaidInvoices, isMock);

  return (
    <div className="sc-root">
      {/* ── Header ── */}
      <div className="sc-header">
        <h1 className="sc-title">Your children</h1>
        <p className="sc-subtitle">
          A combined view across {nameList}. Week of {weekLabel}.
        </p>
      </div>

      {/* ── AI summary card ── */}
      {(aiSummary || isMock) && (
        <div className="sc-ai-card">
          <div className="sc-ai-icon">✦</div>
          <div className="sc-ai-body">
            <p className="sc-ai-text">{aiSummary ?? MOCK_AI_SUMMARY}</p>
            <div className="sc-ai-badge">
              <span className="sc-ai-dot" />
              Drafted by Manhaj AI · summarised across all {entries.length} children&apos;s week.
            </div>
          </div>
        </div>
      )}

      {/* ── Child cards ── */}
      <div
        className="sc-cards-grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 3)}, 1fr)` }}
      >
        {entries.map((entry, i) => (
          <ChildCard key={entry.child.student_id} entry={entry} idx={i} isMock={isMock} />
        ))}
      </div>

      {/* ── Comparison table ── */}
      <div className="sc-section">
        <div className="sc-section-head">
          <div className="sc-section-title">This week, side by side</div>
          <div className="sc-section-meta">Comparison · same week</div>
        </div>
        <ComparisonTable entries={entries} isMock={isMock} />
      </div>

      {/* ── Things needing attention ── */}
      {attentionItems.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-head">
            <div className="sc-section-title">Things needing your attention</div>
            <div className="sc-section-meta">{attentionItems.length} across the family · sorted by deadline</div>
          </div>
          <div className="sc-attention-list">
            {attentionItems.map((item, i) => (
              <div key={i} className="sc-attention-item">
                <div className="sc-attention-left">
                  <span className="sc-attention-tag" style={{ background: item.color }}>{item.tag}</span>
                  <div>
                    <div className="sc-attention-title">{item.title}</div>
                    <div className="sc-attention-sub">{item.sub}</div>
                  </div>
                </div>
                <a href={item.href} className="sc-attention-btn">{item.action}</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
