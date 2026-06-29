import { TrendChart, type TrendPoint } from "@manhaj/ui";
import TeacherMyWeek from "./schedule-components/TeacherMyWeek";
import AskManhajCard from "./schedule-components/AskManhajCard";
import TeacherStudentRoster from "./components/TeacherStudentRoster";
import TeacherStudentInsights from "./components/TeacherStudentInsights";
import { SWART_STUDENTS } from "@manhaj/lib/mock-teacher-students";
import type { TeacherStudentRow } from "@manhaj/lib/mock-teacher-students";
import type { StudentStatus } from "@manhaj/lib/mock-students";
import { getCurrentTeacherId, getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getTeacherWithSections } from "@manhaj/lib/queries/teachers";
import { getStudentsForSections } from "@manhaj/lib/queries/students";
import { getAssessmentsForTeacher } from "@manhaj/lib/queries/assessments";

export const dynamic = "force-dynamic";

const SWART_SECTIONS = [...new Set(SWART_STUDENTS.map(s => s.section_code))].sort();

const SWART_ATT: TrendPoint[] = [
  { date: "05-01", pct: 95 }, { date: "05-02", pct: 96 }, { date: "05-05", pct: 94 },
  { date: "05-06", pct: 97 }, { date: "05-07", pct: 96 }, { date: "05-08", pct: 98 },
  { date: "05-09", pct: 95 }, { date: "05-12", pct: 94 }, { date: "05-13", pct: 96 },
  { date: "05-14", pct: 97 }, { date: "05-15", pct: 95 }, { date: "05-16", pct: 94 },
  { date: "05-19", pct: 96 }, { date: "05-20", pct: 92 }, { date: "05-21", pct: 94 },
  { date: "05-22", pct: 95 }, { date: "05-23", pct: 96 },
];

const SPOTLIGHT = [
  { name: "Rania Khalifa",  section: "10A", note: "EAL flag · Written rubric dropped to 2.9 · needs scaffolding support",  tone: "warn" },
  { name: "Hala Mohsen",    section: "9A",  note: "Chronic absentee · 6 days missed · missed post-exam review session",      tone: "bad" },
  { name: "Tariq Said",     section: "10A", note: "Steady improvement in oral participation · acknowledge publicly",          tone: "good" },
];

export default async function TeacherAnalyzePage() {
  const [teacherId, academicYearId] = await Promise.all([
    getCurrentTeacherId(),
    getCurrentAcademicYearId(),
  ]);

  // Get teacher's sections then students
  const teacherSections = teacherId && academicYearId
    ? await getTeacherWithSections(teacherId, academicYearId)
    : [];

  const sectionIds = teacherSections
    .map(r => (r.sections as { id: string } | null)?.id)
    .filter((id): id is string => id != null);

  const dbStudents = sectionIds.length > 0 ? await getStudentsForSections(sectionIds) : [];

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
    ? await getAssessmentsForTeacher(teacherId, sectionIds)
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

  return (
    <div className="container">

      <section className="ta-greet-hero">
        <h1 className="ta-greet-name">Good morning.</h1>
        <p className="ta-greet-sub">
          Today: P3 History · 10A &nbsp;·&nbsp; P5 MUN club · 10A.
          &nbsp;Yesterday: 92% submission rate on Y10 essay.
        </p>
      </section>

      <div className="ta-kpi-row">
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">My periods this week</div>
          <div className="ta-kpi-v">{teacherSections.reduce((sum, r) => sum + (r.weekly_periods ?? 0), 0) || 22}</div>
          <div className="ta-kpi-d">across {sections.length || 4} sections</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">My sections</div>
          <div className="ta-kpi-v">{sections.length || 4}</div>
          <div className="ta-kpi-d">{sectionLabels}</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">Avg attendance my classes</div>
          <div className="ta-kpi-v">94%</div>
          <div className="ta-kpi-d">school avg 96%</div>
        </div>
        <div className="ta-kpi-card">
          <div className="ta-kpi-l">Pending grading</div>
          <div className="ta-kpi-v ta-kpi-warn">8</div>
          <div className="ta-kpi-d">essays · submitted yesterday</div>
        </div>
      </div>

      <h3 className="ta-section-head">My week</h3>
      <TeacherMyWeek />

      <h3 className="ta-section-head">Attendance · my classes · last 17 days</h3>
      <TrendChart points={SWART_ATT} target={95} title="Attendance · my sections" />

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
        {SPOTLIGHT.map((s, i) => (
          <div key={i} className={`ta-spotlight-row ta-spotlight-${s.tone}`}>
            <div className="ta-spotlight-name">{s.name} <span className="ta-spotlight-section">{s.section}</span></div>
            <div className="ta-spotlight-note">{s.note}</div>
          </div>
        ))}
      </div>

      <h3 className="ta-section-head">My students · full roster</h3>
      <TeacherStudentRoster students={students} sections={sections} />

      <TeacherStudentInsights students={students} />

      <h3 className="ta-section-head">Ask Manhaj</h3>
      <AskManhajCard />

    </div>
  );
}
