import type { AbsenceRow } from "@manhaj/lib/queries/schedule";

type Props = {
  absences: AbsenceRow[];
};

const MOCK_ABSENCES: AbsenceRow[] = [
  {
    id: "m1",
    teacher_id: "t1",
    teacher_name: "Mr. Tariq Al-Balvi",
    reason: "sick",
    status: "covered",
    notes: "Sick leave reported at 21:30 last night · returns tomorrow",
    sub_count: 4,
    subs: [{ sub_id: "s1", sub_teacher_name: "Ms. Fatima Al-Hinat" }],
  },
];

type MockPeriod = {
  time: string;
  label: string;
  subject: string | null;
  room: string | null;
  students: number | null;
  topic: string | null;
  flags: string[];
  sub: string | null;
  is_free: boolean;
  is_break: boolean;
};

const MOCK_PERIODS: MockPeriod[] = [
  { time: "08:00", label: "P1 · 60 min", subject: "G5B Maths", room: "Room 12", students: 22, topic: "Equivalent Fractions intro · lesson plan in room", flags: ["MATHS NEEDS CATCH-UP", "LEYLA ALLERGY"], sub: "Ms. Fatima Al-Hinat", is_free: false, is_break: false },
  { time: "09:00", label: "P2 · 45 min", subject: null, room: null, students: null, topic: null, flags: [], sub: null, is_free: true, is_break: false },
  { time: "09:45", label: "P3 · 45 min", subject: "G3A Maths", room: "Room 9", students: 19, topic: "Multiplication tables review · routine lesson", flags: ["HASSAN - POST-INJURY WATCH"], sub: "Ms. Fatima Al-Hinat", is_free: false, is_break: false },
  { time: "10:45", label: "P4 · 45 min", subject: "G5B Maths", room: "Room 12", students: 22, topic: "Equivalent Fractions practice (continues P1) · exit ticket", flags: [], sub: "Ms. Fatima Al-Hinat", is_free: false, is_break: false },
  { time: "12:00", label: "45 min", subject: null, room: "staff room", students: null, topic: null, flags: [], sub: null, is_free: false, is_break: true },
  { time: "12:45", label: "P5 · 45 min", subject: "G6C Maths", room: "Room 14", students: 24, topic: "Decimal Fractions intro · whole-day cover · handoff sent", flags: ["ZONO-B DELAY"], sub: "Ms. Fatima Al-Hinat", is_free: false, is_break: false },
  { time: "13:30", label: "P6 · 45 min", subject: null, room: null, students: null, topic: null, flags: [], sub: null, is_free: true, is_break: false },
];

const MOCK_CANDIDATES = [
  { name: "Ms. Fatima Al-Hinat", match: "#4 · accepted 22:14", score: 98, tags: ["Subject qualified", "Free", "Low load", "Same class"] },
  { name: "Mr. Khalid", match: "Head of Maths · P1 only · high load", score: 74, tags: ["Subject qualified"] },
  { name: "Mr. Omar", match: "Maths qualified · free · morning only · no G5 history", score: 61, tags: [] },
];

const REASON_LABEL: Record<string, string> = {
  sick: "sick leave", personal: "personal leave",
  professional_development: "professional development",
  emergency: "emergency", other: "other",
};

function periodsCovered(abs: AbsenceRow): number {
  return abs.sub_count;
}

export default function TodayView({ absences }: Props) {
  const rows = absences.length > 0 ? absences : MOCK_ABSENCES;
  const totalAbsent = rows.length;
  const totalCovered = rows.reduce((s, a) => s + a.sub_count, 0);
  const openGaps = rows.reduce((s, a) => s + Math.max(0, (a.sub_count === 0 ? 1 : 0)), 0);
  const isFullyCovered = openGaps === 0;
  const primarySub = rows[0]?.subs[0]?.sub_teacher_name ?? "a substitute";
  const absentName = rows[0]?.teacher_name ?? "Teacher";

  return (
    <div>
      {/* AI Banner */}
      <div className="sch-banner">
        <div className="sch-banner-avatar">M</div>
        <div className="sch-banner-body">
          <div className="sch-banner-title">
            {totalAbsent} teacher{totalAbsent !== 1 ? "s" : ""} absent today
            {isFullyCovered
              ? `, ${totalCovered} period${totalCovered !== 1 ? "s" : ""} needing cover — all ${totalCovered} now assigned.`
              : ` · some periods still need cover.`}
            {totalAbsent === 1 && ` ${primarySub} covers ${absentName}'s whole day — accepted and handoff sheet sent.`}
            {isFullyCovered ? " No other gaps. School is fully staffed." : ""}
          </div>
          <div className="sch-banner-sub">
            Auto-matched substitutes last night · confirmed at {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="sch-kpi-strip">
        <div className="sch-kpi-card">
          <div className="sch-kpi-val">47</div>
          <div className="sch-kpi-label">Classes today</div>
          <div className="sch-kpi-sub">across 32 sections</div>
        </div>
        <div className={`sch-kpi-card ${totalAbsent > 0 ? "warn" : ""}`}>
          <div className="sch-kpi-val">{totalAbsent}</div>
          <div className="sch-kpi-label">Teachers absent</div>
          <div className="sch-kpi-sub">{rows[0] ? `${rows[0].teacher_name} · ${REASON_LABEL[rows[0].reason] ?? rows[0].reason}` : "All present"}</div>
        </div>
        <div className="sch-kpi-card good">
          <div className="sch-kpi-val">{totalCovered}/{totalCovered}</div>
          <div className="sch-kpi-label">Cover assigned</div>
          <div className="sch-kpi-sub">All periods covered</div>
        </div>
        <div className={`sch-kpi-card ${openGaps > 0 ? "bad" : "good"}`}>
          <div className="sch-kpi-val">{openGaps}</div>
          <div className="sch-kpi-label">Open gaps</div>
          <div className="sch-kpi-sub">{openGaps === 0 ? "School fully staffed" : `${openGaps} period${openGaps !== 1 ? "s" : ""} uncovered`}</div>
        </div>
      </div>

      {/* Today's substitutions */}
      {rows.map(absence => (
        <AbsentTeacherBlock key={absence.id} absence={absence} />
      ))}
    </div>
  );
}

function AbsentTeacherBlock({ absence }: { absence: AbsenceRow }) {
  const isFullyCovered = absence.subs.length > 0;
  const primarySub = absence.subs[0]?.sub_teacher_name;

  return (
    <div className="sch-sub-section">
      <div className="sch-sub-section-head">
        <span className="sch-sub-section-label">TODAY&rsquo;S SUBSTITUTIONS</span>
        <span className="sch-sub-section-count">
          {absence.sub_count} absence{absence.sub_count !== 1 ? "s" : ""} · {absence.subs.length > 0 ? absence.subs.length : "0"} assigned
        </span>
      </div>

      {/* Absent teacher row */}
      <div className="sch-teacher-row">
        <div className="sch-teacher-avatar">
          {absence.teacher_name.split(" ").slice(0, 2).map(p => p[0]).join("")}
        </div>
        <div className="sch-teacher-info">
          <div className="sch-teacher-name">{absence.teacher_name}</div>
          <div className="sch-teacher-meta">
            Out today · {absence.notes ?? "absent"}
          </div>
        </div>
        <div className="sch-teacher-right">
          <span className="sch-periods-count">{MOCK_PERIODS.filter(p => !p.is_free && !p.is_break).length} teaching periods</span>
          {isFullyCovered
            ? <span className="sch-covered-badge">FULLY COVERED</span>
            : <span className="sch-gap-badge">OPEN GAPS</span>}
        </div>
      </div>

      {/* Period list */}
      <div className="sch-periods">
        {MOCK_PERIODS.map((p, i) => (
          <div key={i} className={`sch-period-row${p.is_break ? " break" : p.is_free ? " free" : ""}`}>
            <div className="sch-period-time">
              <span className="sch-time">{p.time}</span>
              <span className="sch-dur">{p.label}</span>
            </div>
            <div className="sch-period-body">
              {p.is_break ? (
                <span className="sch-period-break">Lunch · {p.room}</span>
              ) : p.is_free ? (
                <span className="sch-period-free">Free period · no class</span>
              ) : (
                <>
                  <div className="sch-period-class">
                    <span className="sch-class-name">{p.subject}</span>
                    {p.room && <span className="sch-class-detail">· {p.room}</span>}
                    {p.students && <span className="sch-class-detail">· {p.students} students</span>}
                  </div>
                  {p.topic && <div className="sch-period-topic">{p.topic}</div>}
                  {p.flags.length > 0 && (
                    <div className="sch-period-flags">
                      {p.flags.map(f => <span key={f} className="sch-flag-chip">{f}</span>)}
                    </div>
                  )}
                </>
              )}
            </div>
            {!p.is_break && !p.is_free && (
              <div className="sch-period-sub">
                {p.sub ? (
                  <>
                    <div className="sch-sub-avatar">
                      {p.sub.split(" ").slice(0, 2).map(x => x[0]).join("")}
                    </div>
                    <div className="sch-sub-info">
                      <div className="sch-sub-name">{primarySub ?? p.sub}</div>
                      <div className="sch-sub-match">Match #4 · accepted</div>
                    </div>
                    <span className="sch-check">✓</span>
                  </>
                ) : (
                  <span className="sch-no-cover">No cover needed</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ranked candidates */}
      <div className="sch-candidates">
        <div className="sch-candidates-label">
          WHY {(primarySub ?? "substitute").toUpperCase()} · RANKED CANDIDATES
        </div>
        <div className="sch-candidates-row">
          {MOCK_CANDIDATES.map(c => (
            <div key={c.name} className={`sch-candidate-card${c.name === primarySub ? " selected" : ""}`}>
              <div className="sch-cand-top">
                <div className="sch-cand-avatar">{c.name.split(" ").slice(0, 2).map(x => x[0]).join("")}</div>
                <div className="sch-cand-name">{c.name}</div>
                <div className="sch-cand-score">{c.score}</div>
              </div>
              <div className="sch-cand-match">{c.match}</div>
              <div className="sch-cand-tags">
                {c.tags.map(tag => <span key={tag} className="sch-cand-tag">{tag}</span>)}
              </div>
            </div>
          ))}
        </div>
        <button className="sch-change-btn">Change pair</button>
      </div>

      {/* Footer actions */}
      <div className="sch-sub-footer">
        <div className="sch-footer-note">
          Handoff sheet · sent to {primarySub ?? "substitute"} at 22:14 last night ·{" "}
          <a href="#" className="sch-footer-link">read it</a> at 06:42 today
        </div>
        <div className="sch-footer-actions">
          <button className="sch-footer-btn">View handoff sheet</button>
          <button className="sch-footer-btn">Message {primarySub?.split(" ")[1] ?? "substitute"}</button>
          <button className="sch-footer-btn primary">Mark {absence.teacher_name.split(" ")[1]} returned</button>
        </div>
      </div>
    </div>
  );
}
