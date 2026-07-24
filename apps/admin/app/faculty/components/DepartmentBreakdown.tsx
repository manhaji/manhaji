"use client";

import { useState } from "react";

import { MOCK_DEPARTMENTS, MOCK_TEACHERS } from "@manhaj/lib/mock-faculty";
import type { TeacherStatus } from "@manhaj/lib/mock-faculty";
import type { TeacherWithLoad } from "@manhaj/lib/queries/teachers";

/** Special (non-department) chip keys shared with FacultyPageClient. */
export const ALL_KEY = "__all__";
export const OVER_KEY = "__over__";
export const CONTRACTS_KEY = "__contracts__";

const CAP = 28;

export type BucketTeacher = {
  id: string;
  name: string;
  subject: string;
  load: number;
  sections: number;
  status: TeacherStatus;
};

export type DeptRow = {
  id: string;
  label: string;
  teacher_count: number;
  avg_load: number;
  over_capacity_count: number;
  with_slack_count: number;
  contracts_due_count: number;
  teachers: BucketTeacher[];
};

function statusOf(assigned: number, cap: number): TeacherStatus {
  if (assigned > cap) return "over";
  if (assigned < cap * 0.7) return "under";
  return "ok";
}

/**
 * Group teachers into department rows with per-dept teacher lists (used for the
 * expandable buckets) plus the aggregate metrics. Works on the real query shape;
 * falls back to the mock departments/teachers when no session data is present.
 * Exported so FacultyPageClient can build matching filter chips from the same
 * source of truth.
 */
export function computeDeptRows(teachers?: TeacherWithLoad[]): DeptRow[] {
  if (teachers && teachers.length > 0) {
    const map = new Map<string, TeacherWithLoad[]>();
    for (const t of teachers) {
      const key = t.primary_dept ?? "Other";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([dept, list]) => {
        const overCount  = list.filter(t => (t.weekly_period_assigned ?? 0) > (t.weekly_period_cap ?? CAP)).length;
        const slackCount = list.filter(t => (t.weekly_period_assigned ?? 0) < (t.weekly_period_cap ?? CAP) * 0.7).length;
        const dueCount   = list.filter(t => !t.has_contract).length;
        const avgLoad    = list.length > 0
          ? Math.round(list.reduce((s, t) => s + (t.weekly_period_assigned ?? 0), 0) / list.length)
          : 0;
        return {
          id: dept,
          label: dept,
          teacher_count: list.length,
          avg_load: avgLoad,
          over_capacity_count: overCount,
          with_slack_count: slackCount,
          contracts_due_count: dueCount,
          teachers: list.map(t => ({
            id: t.id,
            name: t.display_name ?? t.full_name,
            subject: t.primary_subject_text ?? "—",
            load: t.weekly_period_assigned ?? 0,
            sections: t.weekly_sections,
            status: statusOf(t.weekly_period_assigned ?? 0, t.weekly_period_cap ?? CAP),
          })),
        };
      })
      .sort((a, b) => b.teacher_count - a.teacher_count);
  }

  // Mock fallback (no session): group the representative teachers by department.
  return MOCK_DEPARTMENTS.map(d => {
    const list = MOCK_TEACHERS.filter(t => t.dept_id === d.id);
    return {
      id: d.id,
      label: d.label,
      teacher_count: d.teacher_count,
      avg_load: d.avg_load,
      over_capacity_count: d.over_capacity_count,
      with_slack_count: d.with_slack_count,
      contracts_due_count: list.filter(t => t.contract_status !== "active").length,
      teachers: list.map(t => ({
        id: t.id,
        name: t.full_name,
        subject: t.primary_subject,
        load: t.periods_per_week,
        sections: t.sections,
        status: t.status,
      })),
    };
  });
}

function StatusPill({ status }: { status: TeacherStatus }) {
  const map: Record<TeacherStatus, { label: string; cls: string }> = {
    over:  { label: "Over cap", cls: "fac-pill over" },
    ok:    { label: "OK",       cls: "fac-pill ok" },
    under: { label: "Slack",    cls: "fac-pill slack" },
  };
  const { label, cls } = map[status];
  return <span className={cls}>{label}</span>;
}

export default function DepartmentBreakdown({
  teachers, active = null,
}: {
  teachers?: TeacherWithLoad[];
  /** Active chip key — a dept id, OVER_KEY, CONTRACTS_KEY, or null/ALL_KEY. */
  active?: string | null;
}) {
  const allRows = computeDeptRows(teachers);
  const isDeptFilter = active != null && active !== ALL_KEY && active !== OVER_KEY && active !== CONTRACTS_KEY;

  // A specific department chip filters to that dept and auto-opens its bucket.
  // The parent remounts this component (key={active}) when the chip changes, so
  // this initializer re-seeds expansion without a state-syncing effect.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => (isDeptFilter && active ? new Set([active]) : new Set()),
  );

  const rows = allRows.filter(d => {
    if (active === OVER_KEY) return d.over_capacity_count > 0;
    if (active === CONTRACTS_KEY) return d.contracts_due_count > 0;
    if (isDeptFilter) return d.id === active;
    return true;
  });

  const maxLoad = Math.max(...allRows.map(d => d.avg_load), 1);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalDepts = allRows.length;
  const heading = rows.length === totalDepts
    ? `${totalDepts} departments`
    : `${rows.length} of ${totalDepts} departments`;

  return (
    <section className="fac-dept-card" aria-label="Department breakdown">
      <header className="fac-section-head">
        <h3>Department breakdown · {heading}</h3>
        <p className="fac-section-sub">
          Click a department to reveal its teachers · teacher count · avg load · capacity status.
        </p>
      </header>
      <div className="fac-dept-list">
        {rows.map(dept => {
          const isOpen = expanded.has(dept.id);
          return (
            <div key={dept.id} className="fac-dept-item">
              <button
                type="button"
                className={`fac-dept-row${isOpen ? " open" : ""}`}
                aria-expanded={isOpen}
                onClick={() => toggle(dept.id)}
              >
                <span className="fac-dept-caret" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                <span className="fac-dept-name">
                  <span className="fac-dept-label">{dept.label}</span>
                  <span className="fac-dept-head">
                    {dept.contracts_due_count > 0 ? `${dept.contracts_due_count} contract${dept.contracts_due_count > 1 ? "s" : ""} due` : "contracts on file"}
                  </span>
                </span>
                <span className="fac-dept-count">
                  <span className="fac-dept-n">{dept.teacher_count}</span>
                  <span className="fac-dept-n-label">teachers</span>
                </span>
                <span className="fac-dept-bar-wrap">
                  <span
                    className="fac-dept-bar"
                    style={{ width: `${Math.round((dept.avg_load / maxLoad) * 100)}%` }}
                    title={`Avg load: ${dept.avg_load} periods/wk`}
                  />
                  <span className="fac-dept-bar-val">{dept.avg_load} p/wk</span>
                </span>
                <span className="fac-dept-pills">
                  {dept.over_capacity_count > 0 && (
                    <span className="fac-pill over">{dept.over_capacity_count} over</span>
                  )}
                  {dept.with_slack_count > 0 && (
                    <span className="fac-pill slack">{dept.with_slack_count} slack</span>
                  )}
                  {dept.over_capacity_count === 0 && (
                    <span className="fac-pill ok">balanced</span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="fac-dept-bucket">
                  {dept.teachers.length === 0 ? (
                    <p className="fac-dept-bucket-empty">No teachers to show for this department.</p>
                  ) : (
                    <ul className="fac-dept-bucket-list">
                      {dept.teachers.map(t => (
                        <li key={t.id} className="fac-dept-bucket-row">
                          <span className="fac-dept-bucket-name">{t.name}</span>
                          <span className="fac-dept-bucket-subj">{t.subject}</span>
                          <span className="fac-dept-bucket-load">{t.sections} sec · {t.load} p/wk</span>
                          <StatusPill status={t.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="fac-dept-bucket-empty">No departments match the current filter.</p>
        )}
      </div>
    </section>
  );
}
