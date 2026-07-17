"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  CoverDay,
  CoverIndexEntry,
  CoverRow,
  TeacherCoverPlan,
} from "@manhaj/lib/queries/cover";
import { loadCoverPlan } from "../cover-actions";

type Props = {
  index: CoverIndexEntry[];
  featured: TeacherCoverPlan;
};

const DAY_LONG: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Strongest day to feature: most lessons covered, then most lessons. */
function strongestDay(plan: TeacherCoverPlan): string {
  const best = [...plan.days].sort(
    (a, b) => b.filled - a.filled || b.total - a.total,
  )[0];
  return best?.day ?? plan.days[0]?.day ?? "Sun";
}

export default function CoverPlannerView({ index, featured }: Props) {
  const [cache, setCache] = useState<Record<string, TeacherCoverPlan>>({
    [featured.teacher]: featured,
  });
  const [teacher, setTeacher] = useState(featured.teacher);
  const [day, setDay] = useState(strongestDay(featured));
  const [pending, startTransition] = useTransition();

  const plan = cache[teacher];

  function pickTeacher(name: string) {
    setTeacher(name);
    const cached = cache[name];
    if (cached) {
      setDay(strongestDay(cached));
      return;
    }
    startTransition(async () => {
      const loaded = await loadCoverPlan(name);
      if (loaded) {
        setCache((c) => ({ ...c, [name]: loaded }));
        setDay(strongestDay(loaded));
      }
    });
  }

  const activeDay: CoverDay | undefined = useMemo(
    () => plan?.days.find((d) => d.day === day) ?? plan?.days[0],
    [plan, day],
  );

  return (
    <div>
      {/* Picker + provenance */}
      <div className="sch-cover-controls">
        <div className="sch-cover-field">
          <label htmlFor="cover-teacher">Absent teacher</label>
          <select
            id="cover-teacher"
            value={teacher}
            onChange={(e) => pickTeacher(e.target.value)}
          >
            {index.map((t) => (
              <option key={t.teacher} value={t.teacher}>
                {t.teacher}
                {t.subjects.length ? ` — ${t.subjects.join(", ")}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sch-cover-field">
          <label htmlFor="cover-day">Day</label>
          <select
            id="cover-day"
            value={activeDay?.day ?? day}
            onChange={(e) => setDay(e.target.value)}
          >
            {(plan?.days ?? []).map((d) => (
              <option key={d.day} value={d.day}>
                {DAY_LONG[d.day] ?? d.day} · {d.filled}/{d.total} covered
              </option>
            ))}
          </select>
        </div>

        <span className="sch-cover-provenance">
          Pre-computed on ISO&rsquo;s 2025-26 timetable · read-only preview
        </span>
      </div>

      {pending && !activeDay ? (
        <div className="sch-cover-loading">Loading cover plan…</div>
      ) : activeDay && plan ? (
        <CoverDayPanel teacher={plan.teacher} day={activeDay} muted={pending} />
      ) : (
        <div className="sch-cover-loading">No cover plan available for this teacher.</div>
      )}
    </div>
  );
}

function CoverDayPanel({
  teacher,
  day,
  muted,
}: {
  teacher: string;
  day: CoverDay;
  muted: boolean;
}) {
  const dayLong = DAY_LONG[day.day] ?? day.day;
  const fullyCovered = day.unfilled === 0;
  const subs = new Set(
    day.rows.filter((r): r is Extract<CoverRow, { filled: true }> => r.filled).map((r) => r.substitute),
  );
  const classes = new Set(day.rows.map((r) => r.section)).size;

  return (
    <div style={muted ? { opacity: 0.55, transition: "opacity .15s" } : undefined}>
      {/* Proposed-cover banner */}
      <div className="sch-banner">
        <div className="sch-banner-avatar">M</div>
        <div className="sch-banner-body">
          <div className="sch-banner-title">
            If {teacher} is absent on {dayLong}, Manhaji auto-covers{" "}
            {day.filled} of {day.total} lesson{day.total !== 1 ? "s" : ""}
            {fullyCovered
              ? " — every class has a subject-qualified substitute."
              : ` · ${day.unfilled} period${day.unfilled !== 1 ? "s" : ""} need a manual decision.`}
          </div>
          <div className="sch-banner-sub">
            {subs.size} substitute{subs.size !== 1 ? "s" : ""} proposed, each free that period and
            qualified in the subject · nothing is booked yet.
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="sch-kpi-strip">
        <div className="sch-kpi-card">
          <div className="sch-kpi-val">{day.total}</div>
          <div className="sch-kpi-label">Lessons to cover</div>
          <div className="sch-kpi-sub">across {classes} classes</div>
        </div>
        <div className="sch-kpi-card good">
          <div className="sch-kpi-val">{day.filled}</div>
          <div className="sch-kpi-label">Covered</div>
          <div className="sch-kpi-sub">subject-qualified subs</div>
        </div>
        <div className={`sch-kpi-card ${day.unfilled > 0 ? "bad" : "good"}`}>
          <div className="sch-kpi-val">{day.unfilled}</div>
          <div className="sch-kpi-label">Open gaps</div>
          <div className="sch-kpi-sub">
            {day.unfilled === 0 ? "fully covered" : "no free qualified sub"}
          </div>
        </div>
        <div className="sch-kpi-card">
          <div className="sch-kpi-val">{subs.size}</div>
          <div className="sch-kpi-label">Substitutes used</div>
          <div className="sch-kpi-sub">no double-booking</div>
        </div>
      </div>

      {/* Period-by-period plan */}
      <div className="sch-sub-section">
        <div className="sch-sub-section-head">
          <span className="sch-sub-section-label">Manhaji-proposed cover · {dayLong}</span>
          <span className="sch-sub-section-count">
            {day.filled} of {day.total} covered
          </span>
        </div>

        <div className="sch-teacher-row">
          <div className="sch-teacher-avatar">{initials(teacher)}</div>
          <div className="sch-teacher-info">
            <div className="sch-teacher-name">{teacher}</div>
            <div className="sch-teacher-meta">
              Absent {dayLong} · {day.total} teaching period{day.total !== 1 ? "s" : ""} across {classes} class
              {classes !== 1 ? "es" : ""}
            </div>
          </div>
          <div className="sch-teacher-right">
            {fullyCovered ? (
              <span className="sch-covered-badge">FULLY COVERED</span>
            ) : (
              <span className="sch-gap-badge">
                {day.unfilled} OPEN GAP{day.unfilled !== 1 ? "S" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="sch-periods">
          {day.rows.map((r, i) => (
            <div key={i} className={`sch-period-row${r.filled ? "" : " gap"}`}>
              <div className="sch-period-time">
                <span className="sch-time">{r.period}</span>
                {r.start && <span className="sch-dur">{r.start}–{r.end}</span>}
              </div>
              <div className="sch-period-body">
                <div className="sch-period-class">
                  <span className="sch-class-name">{r.section}</span>
                  <span className="sch-class-detail">· {r.subject}</span>
                </div>
                {r.filled && r.alternatives.length > 0 && (
                  <div className="sch-period-topic">
                    Backup: {r.alternatives.join(", ")}
                  </div>
                )}
                {!r.filled && (
                  <div className="sch-period-flags">
                    <span className="sch-flag-chip">NO QUALIFIED SUB FREE</span>
                  </div>
                )}
              </div>
              <div className="sch-period-sub">
                {r.filled ? (
                  <>
                    <div className="sch-sub-avatar">{initials(r.substitute)}</div>
                    <div className="sch-sub-info">
                      <div className="sch-sub-name">{r.substitute}</div>
                      <div className="sch-sub-match">Same subject · free this period</div>
                    </div>
                    <span className="sch-check">✓</span>
                  </>
                ) : (
                  <span className="sch-cover-gap">Needs manual cover</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="sch-sub-footer">
          <div className="sch-footer-note">
            Manhaji proposal from the timetable solver · read-only preview. Booking &amp; staff
            notifications happen when a school admin confirms.
          </div>
        </div>
      </div>
    </div>
  );
}
