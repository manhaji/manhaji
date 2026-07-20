import TeacherMyWeek, { type TeacherWeekTab } from "./schedule-components/TeacherMyWeek";
import AskManhajCard from "./schedule-components/AskManhajCard";
import TeacherStudentRoster from "./components/TeacherStudentRoster";
import TeacherStudentInsights from "./components/TeacherStudentInsights";
import { SWART_STUDENTS } from "@manhaj/lib/mock-teacher-students";
import type { TeacherStudentRow } from "@manhaj/lib/mock-teacher-students";
import type { StudentStatus } from "@manhaj/lib/mock-students";
import { getCurrentTeacherId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTeacherWithSections, getDeptColleagues } from "@manhaj/lib/queries/teachers";
import { getStudentsForSections } from "@manhaj/lib/queries/students";
import { getAssessmentsForTeacher, getPendingGradingCount } from "@manhaj/lib/queries/assessments";
import { getTeacherTimetable, getEffectiveTimetableYearId } from "@manhaj/lib/queries/timetable";
import { getTeacherSectionAttendance } from "@manhaj/lib/queries/attendance";
import { getCoveringAssignments } from "@manhaj/lib/queries/substitute";

/** Max colleague tabs on My Week (plus the teacher's own tab). */
const MAX_COLLEAGUE_TABS = 4;

export const dynamic = "force-dynamic";

const SWART_SECTIONS = [...new Set(SWART_STUDENTS.map(s => s.section_code))].sort();

const MOCK_SPOTLIGHT = [
  { name: "Rania Khalifa",  section: "10A", note: "EAL flag · Written rubric dropped to 2.9 · needs scaffolding support",  tone: "warn" },
  { name: "Hala Mohsen",    section: "9A",  note: "Chronic absentee · 6 days missed · missed post-exam review session",      tone: "bad" },
  { name: "Tariq Said",     section: "10A", note: "Steady improvement in oral participation · acknowledge publicly",          tone: "good" },
];

export default async function TeacherAnalyzePage() {
  // OR pattern: any DB failure (no session, no env, empty tables) degrades to
  // the Swart demo dataset instead of crashing the dashboard.
  const [teacherId, academicYearId] = await Promise.all([
    getCurrentTeacherId().catch(() => null),
    getCurrentAcademicYearId().catch(() => null),
  ]);

  // Resolve the academic year that actually holds the published timetable
  // (the demo timetable lives in the prior year — see getEffectiveTimetableYearId).
  const timetableYearId = academicYearId
    ? await getEffectiveTimetableYearId(academicYearId).catch(() => academicYearId)
    : null;

  // Get teacher's sections then students
  const teacherSections = teacherId && academicYearId
    ? await getTeacherWithSections(teacherId, academicYearId).catch(() => [])
    : [];

  const sectionIds = teacherSections
    .map(r => (r.sections as { id: string } | null)?.id)
    .filter((id): id is string => id != null);

  // Compute date window: last 30 days
  const today = new Date();
  const toStr  = today.toISOString().slice(0, 10);
  const fromStr = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dbStudents, timetableSlots, attResult, pendingGrading, colleagues, coveringSlots] = await Promise.all([
    sectionIds.length > 0 ? getStudentsForSections(sectionIds).catch(() => []) : Promise.resolve([]),
    teacherId && timetableYearId ? getTeacherTimetable(teacherId, timetableYearId).catch(() => []) : Promise.resolve([]),
    sectionIds.length > 0 ? getTeacherSectionAttendance(sectionIds, fromStr, toStr).catch(() => ({ avgPct: 0, trend: [] })) : Promise.resolve({ avgPct: 0, trend: [] }),
    teacherId && sectionIds.length > 0 ? getPendingGradingCount(teacherId, sectionIds).catch(() => 0) : Promise.resolve(0),
    teacherId ? getDeptColleagues(teacherId).catch(() => []) : Promise.resolve([]),
    teacherId ? getCoveringAssignments(teacherId).catch(() => []) : Promise.resolve([]),
  ]);

  // My Week tabs: the teacher first, then same-department (substitutable)
  // colleagues — each with their real timetable.
  const colleagueSubset = colleagues.slice(1, 1 + MAX_COLLEAGUE_TABS);
  const colleagueSlots = timetableYearId
    ? await Promise.all(
        colleagueSubset.map(c => getTeacherTimetable(c.id, timetableYearId).catch(() => [])),
      )
    : [];
  const weekTabs: TeacherWeekTab[] = timetableSlots.length > 0
    ? [
        { id: teacherId ?? "self", name: colleagues[0]?.name ?? "Me", slots: timetableSlots },
        ...colleagueSubset
          .map((c, i) => ({ id: c.id, name: c.name, slots: colleagueSlots[i] ?? [] }))
          .filter(t => t.slots.some(s => s.is_teaching)),
      ]
    : [];
  const deptLabel = colleagues[0]?.dept;

  // Map DB students to TeacherStudentRow shape (assessment/att fields default for now)
  const students: TeacherStudentRow[] = dbStudents.length > 0
    ? dbStudents.map(s => ({
        id: s.id,
        full_name: s.full_name_en,
        section_code: s.section_code,
        grade_band: ((s.grade_level ?? "").startsWith("1") ? "HS" : "MS") as "HS" | "MS",
        status: (s.risk_flags.some(f => f.severity === "high") ? "support"
          : s.risk_flags.some(f => f.severity === "medium") ? "watch"
          : "good") as StudentStatus,
        rubric: { analytical: 0, creative: 0, oral: 0, written: 0, participation: 0, homework: 0 },
        rubric_avg: 0,
        risk_score: 0,
        attendance: 0,
        flags: s.risk_flags.map(f => f.category),
        teacher_att_pct: 90,
        last_assessment_score: 75,
        last_assessment_label: "—",
        submission_status: "submitted" as const,
        discipline_notes_count: 0,
      }))
    : SWART_STUDENTS;

  const sections = dbStudents.length > 0
    ? [...new Set(dbStudents.map(s => s.section_code))].sort()
    : SWART_SECTIONS;

  const rawAssessments = teacherId && sectionIds.length > 0
    ? await getAssessmentsForTeacher(teacherId, sectionIds).catch(() => [])
    : [];

  const sectionCountMap = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.section_code] = (acc[s.section_code] ?? 0) + 1;
    return acc;
  }, {});

  const assessments = rawAssessments.map(a => ({
    ...a,
    pct_submitted: Math.round(a.submitted_count / Math.max(sectionCountMap[a.section] ?? 1, 1) * 100),
  }));

  const sectionLabels = teacherSections.length > 0
    ? teacherSections.map(r => {
        const sec = r.sections as { code: string } | null;
        return sec?.code ?? "—";
      }).filter(Boolean).join(" · ")
    : "10A · 9A · 10A MUN · 12 A2";

  // Derive spotlight from real student risk flags; fall back to mock when no DB students
  const spotlight = dbStudents.length > 0 ? (() => {
    const highRisk = dbStudents.filter(s => s.risk_flags.some(f => f.severity === "high")).slice(0, 1);
    const medRisk  = dbStudents.filter(s => !s.risk_flags.some(f => f.severity === "high") && s.risk_flags.some(f => f.severity === "medium")).slice(0, 1);
    const noRisk   = dbStudents.filter(s => s.risk_flags.length === 0).slice(0, 1);
    return [
      ...highRisk.map(s => ({ name: s.full_name_en, section: s.section_code, note: s.risk_flags.map(f => f.category).join(" · "), tone: "bad" })),
      ...medRisk.map(s => ({ name: s.full_name_en, section: s.section_code, note: s.risk_flags.map(f => f.category).join(" · "), tone: "warn" })),
      ...noRisk.map(s => ({ name: s.full_name_en, section: s.section_code, note: "No active risk flags", tone: "good" })),
    ];
  })() : MOCK_SPOTLIGHT;

  // Greeting sub-line: real "today" periods from the timetable, OR demo copy.
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[today.getDay()];
  const todaySlots = timetableSlots
    .filter(s => s.is_teaching && s.day.toLowerCase().startsWith(todayDay.toLowerCase()))
    .sort((a, b) => a.period.localeCompare(b.period));
  const greetSub = todaySlots.length > 0
    ? `Today: ${todaySlots.slice(0, 3).map(s => `${s.period} ${s.subject ?? "—"} · ${s.teacher ?? ""}`).join("  ·  ")}${todaySlots.length > 3 ? ` · +${todaySlots.length - 3} more` : ""}.`
    : timetableSlots.length > 0
      ? "No teaching periods today."
      : "Today: P3 History · 10A  ·  P5 MUN club · 10A.  Yesterday: 92% submission rate on Y10 essay.";

  // KPI: real weekly period count from the timetable, OR contract load, OR demo.
  const weeklyPeriods = timetableSlots.filter(s => s.is_teaching).length
    || teacherSections.reduce((sum, r) => sum + (r.weekly_periods ?? 0), 0)
    || 22;

  return (
    <div className="container">

      <section className="ta-greet-hero">
        <h1 className="ta-greet-name">Good morning.</h1>
        <p className="ta-greet-sub">{greetSub}</p>
      </section>

      <div className="ta-kpi-row">
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">My periods this week</div>
          <div className="ta-kpi-v">{weeklyPeriods}</div>
          <div className="ta-kpi-d">across {sections.length || 4} sections</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">My sections</div>
          <div className="ta-kpi-v">{sections.length || 4}</div>
          <div className="ta-kpi-d">{sectionLabels}</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">Avg attendance my classes</div>
          <div className="ta-kpi-v">{attResult.avgPct > 0 ? `${attResult.avgPct}%` : "94%"}</div>
          <div className="ta-kpi-d">last 30 days</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">Pending grading</div>
          <div className={`ta-kpi-v${pendingGrading > 0 ? " ta-kpi-warn" : ""}`}>{pendingGrading}</div>
          <div className="ta-kpi-d">unscored submissions</div>
        </div>
      </div>

      <h3 className="ta-section-head">My week</h3>
      <TeacherMyWeek
        tabs={weekTabs.length > 0 ? weekTabs : undefined}
        dept={deptLabel}
        covering={coveringSlots}
      />

      <TeacherStudentInsights students={students} />

      <h3 className="ta-section-head">Recent assessments</h3>
      <div className="ta-assess-card">
        <table className="ta-assess-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Subject</th>
              <th>Assessment</th>
              <th>% submitted</th>
              <th>Avg score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a, i) => (
              <tr key={i}>
                <td className="ta-assess-section">{a.section}</td>
                <td className="ta-assess-subj">{a.subject}</td>
                <td className="ta-assess-label">{a.label}</td>
                <td>
                  <span className={`ta-assess-pct ${a.pct_submitted >= 90 ? "good" : "warn"}`}>
                    {a.pct_submitted}%
                  </span>
                </td>
                <td className="ta-assess-score">{a.avg_score}%</td>
                <td>
                  <button type="button" className="ta-assess-btn">Review drafts</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="ta-section-head">Student spotlight · needs attention</h3>
      <div className="ta-spotlight-card">
        {spotlight.map((s, i) => (
          <div key={i} className={`ta-spotlight-row ta-spotlight-${s.tone}`}>
            <div className="ta-spotlight-name">{s.name} <span className="ta-spotlight-section">{s.section}</span></div>
            <div className="ta-spotlight-note">{s.note}</div>
          </div>
        ))}
      </div>

      <h3 className="ta-section-head">My students · full roster</h3>
      <TeacherStudentRoster students={students} sections={sections} />

      <h3 className="ta-section-head">Ask Manhaji</h3>
      <AskManhajCard />

    </div>
  );
}
