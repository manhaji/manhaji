/**
 * Student Dashboard.
 * Async server component. Fetches real homework + timetable from DB.
 * Narrative section remains static (AI-generated content).
 */

import Link from "next/link";
import { getCurrentStudentId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getHomeworkForStudent } from "@manhaj/lib/queries/lessons";
import { getStudentTimetable } from "@manhaj/lib/queries/timetable";
import { MOCK_HOMEWORK } from "@manhaj/lib/mock-homework";
import { DEMO_DAY, MOCK_PERIODS, periodsForDay } from "@manhaj/lib/mock-student-schedule";

export const dynamic = "force-dynamic";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export default async function StudentDashboard() {
  const [studentId, academicYearId] = await Promise.all([
    getCurrentStudentId(),
    getCurrentAcademicYearId(),
  ]);

  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayDow = DOW[today.getDay()];
  const from     = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to       = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [homework, periods] = await Promise.all([
    studentId ? getHomeworkForStudent(studentId, from, to) : Promise.resolve([]),
    studentId && academicYearId ? getStudentTimetable(studentId, academicYearId) : Promise.resolve([]),
  ]);

  const useReal = homework.length > 0 || periods.length > 0;

  // Homework stats
  const hwDueCount = useReal
    ? homework.filter(h => !h.due || h.due >= todayStr).length
    : MOCK_HOMEWORK.filter(h => ["due-today", "not-started", "in-progress", "overdue"].includes(h.status)).length;

  const hwOverdue = useReal
    ? homework.filter(h => h.due !== null && h.due < todayStr)
    : MOCK_HOMEWORK.filter(h => h.status === "overdue");

  const hwPreview = useReal
    ? homework.slice(0, 2).map(h => ({
        id: h.id,
        subject: h.subject,
        dueLabel: h.due ? h.due.slice(5, 10) : "—",
        overdue: h.due ? h.due < todayStr : false,
      }))
    : MOCK_HOMEWORK.slice(0, 2).map(h => ({
        id: h.id,
        subject: h.subject,
        dueLabel: h.due.slice(5, 10),
        overdue: h.status === "overdue",
      }));

  // Today's schedule from DB
  const mockTodayAll = periodsForDay(MOCK_PERIODS, DEMO_DAY);
  const todayPeriods = periods.length > 0
    ? periods.filter(p => p.day === todayDow && p.subject !== null)
    : mockTodayAll.filter(p => p.state == null);

  const p3Today = periods.length > 0
    ? periods.find(p => p.day === todayDow && p.period === "P3")
    : mockTodayAll.find(p => p.period === "P3");

  const p4Today = periods.length > 0
    ? periods.find(p => p.day === todayDow && p.period === "P4")
    : mockTodayAll.find(p => p.period === "P4");

  return (
    <div className="container">
      {/* Hero greeting — monthly narrative */}
      <section className="greet-hero" aria-label="Monthly briefing">
        <div className="greet-hero-label">April 2026 · monthly</div>
        <h1>Here&apos;s how April went.</h1>
        <p className="greet-hero-sub">Three things you did well, one to build, two ideas for May.</p>

        <div className="greet-hero-narrative">
          You had <b>a strong April overall</b>, with notable progress in <b>Chemistry</b> and <b>Mathematics</b> —
          your work on equilibrium problems showed real depth and you were top of class on the unit test.
          Your oral-communication rubric climbed from 3.4 to 4.0, the third month in a row going up,
          supported by your engagement in MUN prep.<br /><br />
          The one to build: <span className="greet-build">written Arabic</span>. Your score dipped below 3.0 for the
          second month; Ms Khadija prepared a 3-week scaffold pack — you can move this back above 3.5 in May.
          <div className="greet-hero-byline">
            Drafted by Manhaj · reviewed and approved by Ms Sandra Swart · 8 May 2026
          </div>
        </div>

        <div className="greet-hero-chips">
          <span>★ Top of class · Chemistry</span>
          <span>▲ Oral 3.4 → 4.0 over 3 months</span>
          <span>● MUN finalist citation</span>
          <span>Attendance 97% · 1 absence</span>
        </div>

        <div className="greet-hero-actions">
          <button className="greet-btn">Read the full report</button>
          <button className="greet-btn">Compare to March</button>
          <button className="greet-btn primary">Open my scaffold pack</button>
        </div>
      </section>

      {/* Today strip — 2 columns */}
      <div className="today-strip" aria-label="Today snapshot">
        <div>
          <div className="today-strip-col-label">Right now · P3 starts in 6 min</div>
          <div className="today-strip-col-body">
            {p3Today
              ? `${p3Today.subject ?? "—"} · ${p3Today.room ?? ""} · ${p3Today.teacher ?? ""}`
              : "Mathematics · R201 · Mr Faisal"}
            <small>
              Bring calculator + chapter 7 textbook. Limits review for tomorrow&apos;s test.
            </small>
          </div>
        </div>
        <div className="today-strip-divider">
          <div className="today-strip-col-label">Next exam</div>
          <div className="today-strip-col-body">
            Chemistry mid-term · 12d
            <small>P3 on 12 May · Lab 1 · 50-question paper · revision pack ready</small>
          </div>
        </div>
      </div>

      {/* KPI row — 4 cards */}
      <div className="dash-stat-row" aria-label="Dashboard KPIs">
        <div className="dash-stat-card">
          <div className="dash-stat-l">Due this week</div>
          <div className="dash-stat-v warn">{hwDueCount}</div>
          <div className="dash-stat-d">
            {hwOverdue.length > 0 ? `${hwOverdue.length} overdue` : "next: tomorrow"}
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-l">Rubric this month</div>
          <div className="dash-stat-v good">4.1</div>
          <div className="dash-stat-d">▲ +0.22 vs last month</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-l">Attendance</div>
          <div className="dash-stat-v good">97%</div>
          <div className="dash-stat-d">1 absence (medical)</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-l">Honor citations</div>
          <div className="dash-stat-v good">3</div>
          <div className="dash-stat-d">this month</div>
        </div>
      </div>

      {/* Divider */}
      <div className="dash-divider" aria-hidden="true">Jump into a tab</div>

      {/* 2×2 summary card grid */}
      <div className="sd-card-grid">
        <Link href="/schedule" className="sd-card">
          <div className="sd-card-head">
            <span className="sd-card-label">My Schedule</span>
            <span className="sd-card-arrow" aria-hidden="true">→</span>
          </div>
          <div className="sd-card-big">
            {p3Today ? `P3 · ${p3Today.subject ?? "—"}` : "P3 · Maths"}
          </div>
          <div className="sd-card-trend">
            {p3Today
              ? `starts ${p3Today.start} · ${p3Today.room ?? ""} · ${p3Today.teacher ?? ""}`
              : "starts 10:00 · R201 · Mr Faisal"}
          </div>
          <div className="sd-card-rows">
            <div className="sd-card-row">
              <span>Next</span>
              <b>{p4Today ? `P4 · ${p4Today.subject ?? "—"}` : "P4 · Physics"}</b>
            </div>
            <div className="sd-card-row"><span>Today total</span><b>{todayPeriods.length} classes</b></div>
          </div>
        </Link>

        <Link href="/homework" className="sd-card">
          <div className="sd-card-head">
            <span className="sd-card-label">Homework</span>
            <span className="sd-card-arrow" aria-hidden="true">→</span>
          </div>
          <div className="sd-card-big">{hwDueCount}</div>
          <div className="sd-card-trend warn">
            {hwOverdue.length > 0
              ? `▲ ${hwOverdue.length} overdue · check today`
              : "▲ 1 due tomorrow · stay on track"}
          </div>
          <div className="sd-card-rows">
            {hwPreview.map(h => (
              <div key={h.id} className="sd-card-row">
                <span>{h.subject}</span>
                <b style={h.overdue ? { color: "var(--color-danger)" } : undefined}>
                  {h.overdue ? "overdue" : h.dueLabel}
                </b>
              </div>
            ))}
          </div>
        </Link>

        <Link href="/past-reports" className="sd-card">
          <div className="sd-card-head">
            <span className="sd-card-label">Past Reports</span>
            <span className="sd-card-arrow" aria-hidden="true">→</span>
          </div>
          <div className="sd-card-big">8</div>
          <div className="sd-card-trend">archive of previous months</div>
          <div className="sd-card-rows">
            <div className="sd-card-row"><span>Last opened</span><b>March 2026</b></div>
            <div className="sd-card-row"><span>Available</span><b>Sept &apos;25 → now</b></div>
          </div>
        </Link>

        <Link href="/growth" className="sd-card">
          <div className="sd-card-head">
            <span className="sd-card-label">My Growth</span>
            <span className="sd-card-arrow" aria-hidden="true">→</span>
          </div>
          <div className="sd-card-big">4.1<span style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 600 }}> / 5</span></div>
          <div className="sd-card-trend up">▲ 3 months rising</div>
          <div className="sd-card-rows">
            <div className="sd-card-row"><span>Strongest</span><b>Homework 4.6</b></div>
            <div className="sd-card-row"><span>Building</span><b>Written 2.8</b></div>
          </div>
        </Link>
      </div>
    </div>
  );
}
