import fs from "node:fs";
import path from "node:path";

/**
 * Server-side reader for the pre-computed substitute-cover plans
 * (`data/processed/tt_2526/derived/cover_plans.json`, ~668 KB).
 *
 * The raw file is far too large to ship to the browser, so it is read from
 * disk here (server only), parsed + trimmed once, and memoised. The UI is
 * handed a lightweight picker index and, on demand, a single teacher's plan.
 *
 * This is a scripted demo over ISO's real AY 2025-26 timetable — static
 * pre-computed data, NOT a live solver call.
 */

const DATA_REL = "data/processed/tt_2526/derived/cover_plans.json";
const BELLS_REL = "data/processed/tt_2526/derived/bells.json";
export const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu"] as const;

export const FEATURED_COVER_TEACHER = "Sahar Mohamad";

export type CoverStatus = "solved" | "partial" | "infeasible";

export type CoverRow =
  | {
      filled: true;
      period: string;
      start: string | null;
      end: string | null;
      section: string;
      subject: string;
      substitute: string;
      alternatives: string[];
    }
  | {
      filled: false;
      period: string;
      start: string | null;
      end: string | null;
      section: string;
      subject: string;
      reason: string;
    };

export type CoverDay = {
  day: string;
  status: CoverStatus;
  total: number;
  filled: number;
  unfilled: number;
  rows: CoverRow[];
};

export type TeacherCoverPlan = {
  teacher: string;
  days: CoverDay[];
};

export type CoverIndexEntry = {
  teacher: string;
  subjects: string[];
  weeklyLessons: number;
  days: {
    day: string;
    total: number;
    filled: number;
    unfilled: number;
    status: CoverStatus;
  }[];
};

// --- raw shapes (as stored on disk) ---------------------------------------

type RawAssignment = {
  period: string;
  section: string;
  subject: string;
  substitute: string;
  alternatives?: string[];
};
type RawUnfilled = {
  period: string;
  section: string;
  subject: string;
  reason: string;
};
type RawDay = {
  assignments?: RawAssignment[];
  unfilled?: RawUnfilled[];
  summary: {
    slots_total: number;
    filled: number;
    unfilled: number;
    status: CoverStatus;
  };
};
type RawFile = { cover_plans: Record<string, Record<string, RawDay>> };
type BellSlot = { slot: string; start: string; end: string; teaching: boolean };
type BellsFile = Record<string, BellSlot[]>;

// --- file location + parsing ----------------------------------------------

function resolveFromRepo(rel: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 7; i++) {
    const candidate = path.join(dir, rel);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`cover data not found: ${rel} (searched up from ${process.cwd()})`);
}

function bandForSection(section: string): string {
  if (/^kg/i.test(section)) return "KG";
  const m = section.match(/(\d+)/);
  const g = m ? parseInt(m[1], 10) : 0;
  return g >= 7 ? "GR7_12" : "GR1_6";
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

type Loaded = { index: CoverIndexEntry[]; plans: Map<string, TeacherCoverPlan> };
let cache: Loaded | null = null;

function load(): Loaded {
  if (cache) return cache;

  const raw = JSON.parse(fs.readFileSync(resolveFromRepo(DATA_REL), "utf8")) as RawFile;
  const bells = JSON.parse(fs.readFileSync(resolveFromRepo(BELLS_REL), "utf8")) as BellsFile;

  const bell = (section: string, period: string): { start: string | null; end: string | null } => {
    const band = bells[bandForSection(section)] ?? bells["GR1_6"] ?? [];
    const hit = band.find((s) => s.slot === period);
    return hit ? { start: hit.start, end: hit.end } : { start: null, end: null };
  };
  const sortKey = (r: CoverRow): number => (r.start ? minutes(r.start) : 9999);

  const plans = new Map<string, TeacherCoverPlan>();
  const index: CoverIndexEntry[] = [];

  for (const teacher of Object.keys(raw.cover_plans)) {
    const rawDays = raw.cover_plans[teacher];
    const days: CoverDay[] = [];
    let weeklyLessons = 0;
    const subjectCount = new Map<string, number>();

    for (const day of DAY_ORDER) {
      const rd = rawDays[day];
      if (!rd) continue;

      const rows: CoverRow[] = [];
      for (const a of rd.assignments ?? []) {
        const t = bell(a.section, a.period);
        rows.push({
          filled: true,
          period: a.period,
          start: t.start,
          end: t.end,
          section: a.section,
          subject: a.subject,
          substitute: a.substitute,
          alternatives: (a.alternatives ?? []).slice(0, 3),
        });
        subjectCount.set(a.subject, (subjectCount.get(a.subject) ?? 0) + 1);
      }
      for (const u of rd.unfilled ?? []) {
        const t = bell(u.section, u.period);
        rows.push({
          filled: false,
          period: u.period,
          start: t.start,
          end: t.end,
          section: u.section,
          subject: u.subject,
          reason: u.reason,
        });
        subjectCount.set(u.subject, (subjectCount.get(u.subject) ?? 0) + 1);
      }
      rows.sort((x, y) => sortKey(x) - sortKey(y));

      weeklyLessons += rd.summary.slots_total;
      days.push({
        day,
        status: rd.summary.status,
        total: rd.summary.slots_total,
        filled: rd.summary.filled,
        unfilled: rd.summary.unfilled,
        rows,
      });
    }

    plans.set(teacher, { teacher, days });
    index.push({
      teacher,
      weeklyLessons,
      subjects: [...subjectCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([s]) => s),
      days: days.map((d) => ({
        day: d.day,
        total: d.total,
        filled: d.filled,
        unfilled: d.unfilled,
        status: d.status,
      })),
    });
  }

  index.sort((a, b) => a.teacher.localeCompare(b.teacher));
  cache = { index, plans };
  return cache;
}

/** Lightweight list for the teacher picker (~15 KB). */
export function getCoverIndex(): CoverIndexEntry[] {
  return load().index;
}

/** One teacher's trimmed cover plan (~4-6 KB). Returns null if unknown. */
export function getCoverPlan(teacher: string): TeacherCoverPlan | null {
  return load().plans.get(teacher) ?? null;
}
