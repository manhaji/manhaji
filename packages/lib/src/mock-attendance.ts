/**
 * Manhaj Phase 2.2 demo fixture — synthetic attendance series for the
 * Admin Attendance tab.
 *
 * Shape mirrors a future RPC return. Cross-references student IDs from
 * lib/mock-students.ts where needed (chronic absentees + take-attendance roll).
 */

// =========================
// Types
// =========================
export type DailyPoint   = { date: string; pct: number };
export type DayOfWeekRow = { week_label: string; mon: number; tue: number; wed: number; thu: number; fri: number };
export type PeriodAvg    = { period: 1|2|3|4|5|6|7; pct: number };
export type EventMarker  = { id: number; date: string; label: string; tone: "muted" | "neutral" | "warn" };
export type CauseCard    = { id: string; title: string; body: string; confidence: "high" | "medium" };
export type SectionWeekRow = { section_code: string; days: Array<"good"|"watch"|"bad">; week_pct: number };
export type SubjectMiss    = { subject: string; hours_missed: number };
export type ChronicRow = {
  student_id:  string;
  student_name: string;
  section_code: string;
  days_missed:  number;
  pattern:      string;
  cause:        string;
  status:       "support" | "watch" | "excused" | "contact";
};
export type BenchmarkRow = { label: string; pct: number; tone: "us" | "neutral" | "target" };
export type CalendarDay  = "p" | "l" | "a" | "x";
export type CalendarRow  = CalendarDay[];
export type LessonMissed = { date: string; period: string; subject: string; teacher: string; note: string };
export type ReEngagementDraft = {
  to:          string;
  template_id: string;
  subject:     string;
  body:        string;
};
export type RollCallStatus = "P" | "L" | "A";
export type RollCallRow = {
  student_id:    string;
  student_name:  string;
  preset_flag?:  "medical" | "religious" | "transport";
  preset_date?:  string;
};
export type AttendanceKpis = {
  this_week_pct:    number;
  chronic_count:    number;
  late_today_count: number;
  sub_coverage:     number;
};

// =========================
// Daily aggregate · last 30 school days
// Smooth band 95-97% with 3 visible dips: Eid (~70), mid-term week (~83), illness spike (~88).
// =========================
export const ATT_DAILY: DailyPoint[] = [
  { date: "2026-04-13", pct: 97.1 },
  { date: "2026-04-14", pct: 96.4 },
  { date: "2026-04-15", pct: 95.8 },
  { date: "2026-04-16", pct: 96.9 },
  { date: "2026-04-17", pct: 95.4 },
  { date: "2026-04-20", pct: 95.1 },
  { date: "2026-04-21", pct: 96.0 },
  { date: "2026-04-22", pct: 96.7 },
  { date: "2026-04-23", pct: 95.9 },
  { date: "2026-04-24", pct: 70.2 }, // Eid Al-Fitr
  { date: "2026-04-27", pct: 88.1 },
  { date: "2026-04-28", pct: 93.7 },
  { date: "2026-04-29", pct: 95.4 },
  { date: "2026-04-30", pct: 96.1 },
  { date: "2026-05-01", pct: 96.5 },
  { date: "2026-05-04", pct: 95.2 },
  { date: "2026-05-05", pct: 96.1 },
  { date: "2026-05-06", pct: 96.4 },
  { date: "2026-05-07", pct: 96.8 },
  { date: "2026-05-08", pct: 83.4 }, // mid-term assessment week
  { date: "2026-05-11", pct: 91.7 },
  { date: "2026-05-12", pct: 94.1 },
  { date: "2026-05-13", pct: 95.6 },
  { date: "2026-05-14", pct: 96.2 },
  { date: "2026-05-15", pct: 96.8 },
  { date: "2026-05-18", pct: 95.9 },
  { date: "2026-05-19", pct: 96.4 },
  { date: "2026-05-20", pct: 88.5 }, // illness spike
  { date: "2026-05-21", pct: 92.8 },
  { date: "2026-05-22", pct: 96.2 },
];

// =========================
// Event markers (numbered)
// =========================
export const ATT_EVENTS: EventMarker[] = [
  { id: 1, date: "2026-04-24", label: "24 Apr · Public holiday (Eid Al-Fitr)", tone: "muted" },
  { id: 2, date: "2026-05-08", label: "8 May · Mid-term assessment week",      tone: "neutral" },
  { id: 3, date: "2026-05-20", label: "20 May · Seasonal illness spike",       tone: "warn" },
];

// =========================
// Day-of-week · last 6 weeks (Mondays consistently weakest)
// =========================
export const ATT_DOW: DayOfWeekRow[] = [
  { week_label: "Wk 22", mon: 93, tue: 97, wed: 95, thu: 97, fri: 98 },
  { week_label: "Wk 21", mon: 94, tue: 96, wed: 95, thu: 97, fri: 99 },
  { week_label: "Wk 20", mon: 90, tue: 94, wed: 97, thu: 98, fri: 99 },
  { week_label: "Wk 19", mon: 93, tue: 95, wed: 96, thu: 97, fri: 98 },
  { week_label: "Wk 18", mon: 94, tue: 95, wed: 96, thu: 98, fri: 99 },
  { week_label: "Wk 17", mon: 95, tue: 97, wed: 97, thu: 98, fri: 99 },
];

// =========================
// Period-of-day · last 30 days (P1 and P7 lowest)
// =========================
export const ATT_PERIODS: PeriodAvg[] = [
  { period: 1, pct: 91 },
  { period: 2, pct: 96 },
  { period: 3, pct: 97 },
  { period: 4, pct: 97 },
  { period: 5, pct: 96 },
  { period: 6, pct: 95 },
  { period: 7, pct: 93 },
];

// =========================
// AI-attributed causes
// =========================
export const ATT_CAUSES: CauseCard[] = [
  { id: "flu", title: "Illness cluster", confidence: "high",
    body: "5 students in 10B (same wing, overlapping symptoms). Recommend a note to all 10B parents on hand-hygiene." },
  { id: "monday", title: "Monday dip pattern", confidence: "high",
    body: "Mondays consistently 2-3 pts below the week average. Worth reviewing the Monday P1 schedule (currently Maths/Arabic for HS)." },
  { id: "transport", title: "Transport delay", confidence: "medium",
    body: "Late arrivals concentrated in 2 sections served by the same bus route (Athaiba-North)." },
  { id: "religious", title: "Religious / cultural", confidence: "high",
    body: "3 students absent today aligned to Eid travel — already excused, parents notified." },
];

// =========================
// Section heat-strip · this week (5 school days per section)
// =========================
export const ATT_SECTIONS: SectionWeekRow[] = [
  { section_code: "9A",    days: ["good","good","good","watch","good"], week_pct: 97 },
  { section_code: "9B",    days: ["good","good","watch","good","good"], week_pct: 95 },
  { section_code: "10A",   days: ["good","good","good","good","good"],  week_pct: 98 },
  { section_code: "10B",   days: ["bad","bad","bad","watch","watch"],   week_pct: 87 },
  { section_code: "11 AS", days: ["watch","good","good","good","good"], week_pct: 94 },
  { section_code: "12 A2", days: ["good","good","good","good","good"],  week_pct: 99 },
];

// =========================
// Subject correlation · this term · hours missed
// =========================
export const ATT_SUBJECTS: SubjectMiss[] = [
  { subject: "Mathematics", hours_missed: 142 },
  { subject: "Arabic",      hours_missed: 128 },
  { subject: "English",     hours_missed: 96 },
  { subject: "Chemistry",   hours_missed: 76 },
  { subject: "PE",          hours_missed: 44 },
];

// =========================
// Chronic absentees (cross-ref MOCK_STUDENTS by id)
// =========================
export const ATT_CHRONIC: ChronicRow[] = [
  { student_id: "omar-saadi",      student_name: "Omar Saadi",      section_code: "11 AS", days_missed: 12, pattern: "Mondays + post-exam",   cause: "Disengagement", status: "support" },
  { student_id: "maya-habibi",     student_name: "Maya Habibi",     section_code: "10B",   days_missed:  9, pattern: "Cluster Apr 15-25",     cause: "Medical (flu)", status: "watch"   },
  { student_id: "rashid-al-saadi", student_name: "Rashid Al-Saadi", section_code: "9B",    days_missed:  7, pattern: "Fridays",               cause: "Religious",     status: "excused" },
  { student_id: "yasmin-naser",    student_name: "Yasmin Naser",    section_code: "11 AS", days_missed:  6, pattern: "Scattered",             cause: "Unknown",       status: "contact" },
  { student_id: "hala-mohsen",     student_name: "Hala Mohsen",     section_code: "9A",    days_missed:  6, pattern: "Post-exam slump",       cause: "Disengagement", status: "support" },
];

// =========================
// Benchmark
// =========================
export const ATT_BENCHMARK: BenchmarkRow[] = [
  { label: "HS · this term",          pct: 96.2, tone: "us"      },
  { label: "HS · last term",          pct: 94.1, tone: "neutral" },
  { label: "HS · same time last year", pct: 93.7, tone: "neutral" },
  { label: "School target",            pct: 95.0, tone: "target"  },
];

// =========================
// Per-student calendar heat · 20 weeks for Omar Saadi
// 5 days/week × 20 weeks = 100 cells. Last 8 weeks intensify near exam periods.
// =========================
const _omarCal: CalendarDay[][] = [
  ["p","p","p","l","p"], ["p","p","p","a","a"], ["p","p","l","p","p"], ["p","p","p","p","p"],
  ["a","a","p","p","p"], ["p","p","l","p","x"], ["a","p","p","p","p"], ["p","a","a","a","a"],
  ["p","p","p","l","p"], ["p","p","p","p","p"], ["p","l","a","p","p"], ["p","p","a","p","p"],
  ["p","p","p","l","p"], ["p","l","a","a","p"], ["p","p","p","p","p"], ["p","p","p","l","p"],
  ["a","a","p","p","p"], ["p","p","l","p","p"], ["p","a","p","p","p"], ["l","p","a","a","p"],
];
export const ATT_CAL_OMAR: CalendarRow[] = _omarCal;

// =========================
// Lessons missed (Omar · last 14 days)
// =========================
export const ATT_LESSONS: LessonMissed[] = [
  { date: "2026-05-22", period: "P3", subject: "Calculus",  teacher: "Mr Saab",   note: "limits unit-test review" },
  { date: "2026-05-22", period: "P5", subject: "Chemistry", teacher: "Mr Salim",  note: "organic reactions lab"   },
  { date: "2026-05-17", period: "P1", subject: "Mathematics", teacher: "Mr Saab", note: "15 min late"             },
  { date: "2026-05-15", period: "P2", subject: "History",   teacher: "Ms Swart",  note: "essay feedback session"  },
];

// =========================
// AI-drafted parent message (re-engagement after unexplained absence · T-11)
// =========================
export const ATT_DRAFT_OMAR: ReEngagementDraft = {
  to:          "Omar Saadi's parent",
  template_id: "T-11",
  subject:     "Re: Omar — could we arrange a short call?",
  body:        "Dear Mr Saadi,\n\nWe noticed Omar missed school on 22 May without an explanation, following 3 other unexplained absences this month. We'd like to understand if anything is happening so we can support him. Could we arrange a short call this week?\n\nManhaj is also attaching the lessons Omar missed so he can catch up.\n\nBest,\nMs Swart · Student Advisor · International School of Oman",
};

// =========================
// Today's roll call · 10A
// =========================
export const ATT_ROLL_10A: RollCallRow[] = [
  { student_id: "layla-al-habsi",  student_name: "Layla Al-Habsi"  },
  { student_id: "aya-mansour",     student_name: "Aya Mansour"     },
  { student_id: "khalil-al-mansoor", student_name: "Khalil Al-Mansoor" },
  { student_id: "rania-khalifa",   student_name: "Rania Khalifa", preset_flag: "medical", preset_date: "22 May" },
  { student_id: "tariq-said",      student_name: "Tariq Said"      },
];

// =========================
// KPIs (precomputed for the page header)
// =========================
export const ATT_KPIS: AttendanceKpis = {
  this_week_pct:    96.2,
  chronic_count:    5,
  late_today_count: 14,
  sub_coverage:     2,
};
