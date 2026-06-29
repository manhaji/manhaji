/**
 * Admin Dashboard — AI briefing + 5 per-tab summary cards.
 * Server component. Fetches real data from DB for students, attendance, and reports.
 * Schedule section still uses mock data (no DB conflict/gap tracking yet).
 */

import { getDashboardData } from "@manhaj/lib/data";
import { composeSummary } from "@manhaj/lib/summary";
import { AiBriefingHeader, TabSummaryCard, type TabSummary } from "@manhaj/ui";
import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getStudentsForAdmin } from "@manhaj/lib/queries/students";
import { getDailyAttendanceTrend, getSectionAttendanceStats, getChronicAbsentees } from "@manhaj/lib/queries/attendance";
import { getCommDraftPipelineCounts } from "@manhaj/lib/queries/reports";
import { MOCK_ACTIONS } from "@manhaj/lib/mock-schedule";
import { MOCK_SECTIONS as RPT_SECTIONS } from "@manhaj/lib/mock-reports";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [data, academicYearId] = await Promise.all([
    getDashboardData(),
    getCurrentAcademicYearId(),
  ]);

  const today   = new Date();
  const to      = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dbStudents, dailyTrend, sectionStats, chronicAbsentees, pipelineCounts] = await Promise.all([
    academicYearId ? getStudentsForAdmin(academicYearId) : Promise.resolve([]),
    academicYearId ? getDailyAttendanceTrend(academicYearId, weekAgo, to) : Promise.resolve([]),
    getSectionAttendanceStats(weekAgo, to),
    academicYearId ? getChronicAbsentees(academicYearId, 10) : Promise.resolve([]),
    getCommDraftPipelineCounts(),
  ]);

  const summary = composeSummary("admin", data);
  const s = data.stats;
  const util = s.total_cap > 0 ? Math.round((100 * s.total_assigned) / s.total_cap) : 0;

  // Student stats from DB
  const enrolled = dbStudents.length;
  const flagged  = dbStudents.filter(st => st.risk_flags.length > 0).length;
  const hsRoster = dbStudents.filter(st => (st.grade_level ?? "").startsWith("1")).length;

  // Attendance stats from DB
  const weekPct = dailyTrend.length > 0
    ? Math.round(dailyTrend.reduce((acc, d) => acc + d.pct, 0) / dailyTrend.length * 10) / 10
    : 0;
  const worstSection = [...sectionStats].sort((a, b) => a.week_pct - b.week_pct)[0];
  const chronicCount = chronicAbsentees.length;

  // Reports pipeline from DB
  const sentCount   = pipelineCounts["sent"]   ?? 0;
  const openedCount = pipelineCounts["opened"] ?? 0;
  const openRate    = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;

  // Schedule still uses mock (no DB tracking for conflicts/gaps yet)
  const conflicts = MOCK_ACTIONS.filter(a => a.kind === "conflict").length;
  const gaps      = MOCK_ACTIONS.filter(a => a.kind === "gap").length;
  const urgentRpt = RPT_SECTIONS.filter(r => r.days_to_due <= 1).length;

  const cards: TabSummary[] = [
    {
      label: "Faculty",
      href: "/faculty",
      big: String(s.n_teachers),
      big_suffix: "teachers",
      trend: s.over_capacity > 0
        ? { text: `▲ ${s.over_capacity} over capacity`, tone: "down" }
        : { text: "All within capacity", tone: "up" },
      rows: [
        { label: "Load utilisation", value: `${util}%` },
        { label: "With slack",       value: String(s.under_utilised) },
      ],
    },
    {
      label: "Students",
      href: "/students",
      big: String(enrolled),
      trend: flagged > 0
        ? { text: `▲ ${flagged} flagged for support`, tone: "down" }
        : { text: "All on track", tone: "up" },
      rows: [
        { label: "HS roster",       value: String(hsRoster) },
        { label: "Course-sel done", value: "14" },
      ],
    },
    {
      label: "Attendance",
      href: "/attendance",
      big: weekPct > 0 ? String(weekPct) : "—",
      big_suffix: weekPct > 0 ? "%" : undefined,
      trend: { text: "— flat vs last week", tone: "flat" },
      rows: [
        { label: `${worstSection?.section_code ?? "—"} hotspot`, value: worstSection ? `${worstSection.week_pct}%` : "—" },
        { label: "Chronic absentees", value: String(chronicCount) },
      ],
    },
    {
      label: "Schedule",
      href: "/schedule",
      big: String(conflicts + gaps),
      trend: (conflicts + gaps) > 0
        ? { text: `▲ ${conflicts} conflict${conflicts !== 1 ? "s" : ""} · ${gaps} gap${gaps !== 1 ? "s" : ""}`, tone: "down" }
        : { text: "No conflicts", tone: "up" },
      rows: [
        { label: "Sub-needed today", value: "0" },
        { label: "Next free period", value: "P5 Tue" },
      ],
    },
    {
      label: "Reports",
      href: "/reports",
      big: String(sentCount),
      trend: { text: `▲ ${openRate}% opened this cycle`, tone: "up" },
      rows: [
        { label: "Urgent (≤1 day)", value: urgentRpt > 0 ? String(urgentRpt) : "None" },
        { label: "Next batch",       value: `${RPT_SECTIONS[0]?.days_to_due ?? 3}d` },
      ],
    },
  ];

  return (
    <div className="container">
      <h1>Good morning, Principal.</h1>
      <p className="sub">Dashboard · AY {process.env.ACADEMIC_YEAR}</p>

      <AiBriefingHeader summary={summary} />

      <div className="tab-summary-grid">
        {cards.map(c => <TabSummaryCard key={c.label} summary={c} />)}
      </div>
    </div>
  );
}
