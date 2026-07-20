"use client";

import { useState, useMemo, useTransition } from "react";
import type { CurrentSlotInfo, RollCallMark } from "@manhaj/lib/queries/attendance";
import { saveAttendanceMark, bulkSaveAttendance } from "../actions/attendance";

type Student = {
  id: string;
  full_name_en: string;
  external_ref: string | null;
};

type MarkStatus = "present" | "absent" | "late" | "excused" | "unknown";

type LocalMark = {
  status: MarkStatus | null;
  reason: string | null;
  notes: string | null;
};

type Props = {
  slot: CurrentSlotInfo | null;
  students: Student[];
  todayMarks: RollCallMark[];
  yesterdayMarks: RollCallMark[];
  teacherId: string;
  schoolId: string;
  today: string;
};

// ── Mock fallback ─────────────────────────────────────────────────────────
const MOCK_SLOT: CurrentSlotInfo = {
  slotId: "mock", sectionId: "mock", sectionCode: "G5B",
  gradeLevel: "Grade 5", subjectName: "Maths", roomCode: "Room 12",
  bellPeriodId: "mock", periodLabel: "P2", periodNumber: 2,
  startsAt: "09:00", endsAt: "09:45", isNow: true,
};
const MOCK_STUDENTS: Student[] = [
  { id: "s1",  full_name_en: "Ahmed Al-Amri",    external_ref: null },
  { id: "s2",  full_name_en: "Dana Al-Bulushi",   external_ref: null },
  { id: "s3",  full_name_en: "Fatima Al-Hinai",   external_ref: null },
  { id: "s4",  full_name_en: "Hassan Al-Kindi",   external_ref: null },
  { id: "s5",  full_name_en: "Khalil Al-Mahri",   external_ref: null },
  { id: "s6",  full_name_en: "Layla Al-Habsi",    external_ref: null },
  { id: "s7",  full_name_en: "Maya Al-Lawati",    external_ref: null },
  { id: "s8",  full_name_en: "Nasser Al-Rashidi", external_ref: null },
  { id: "s9",  full_name_en: "Salim Al-Lawati",   external_ref: null },
  { id: "s10", full_name_en: "Sara Al-Mughairi",  external_ref: null },
  { id: "s11", full_name_en: "Tariq Al-Balushi",  external_ref: null },
  { id: "s12", full_name_en: "Yusuf Al-Zaabi",    external_ref: null },
];
const MOCK_MARKS: RollCallMark[] = [
  { student_id: "s3", status: "late",   reason: "Bus late", notes: "arrived 9:08" },
  { student_id: "s5", status: "absent", reason: "Family informed", notes: "also absent Mon & Tue" },
  { student_id: "s8", status: "absent", reason: "Medical", notes: null },
];

const ABSENT_REASONS = ["Bus late", "Medical", "Family", "Other"];
const LATE_REASONS   = ["Medical", "Family informed", "Unknown", "Other"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}
const COLORS = ["#3D5A80","#C05621","#2F855A","#C53030","#975A16","#2C5282","#6B46C1","#B7791F","#276749","#553C9A"];

export default function OneTapClient({ slot, students, todayMarks, yesterdayMarks, teacherId, schoolId, today }: Props) {
  const activeSlot = (slot && students.length > 0) ? slot : MOCK_SLOT;
  const activeStudents = students.length > 0 ? students : MOCK_STUDENTS;

  // Build initial mark map from DB marks or mock
  const initialMarks = useMemo((): Record<string, LocalMark> => {
    const source = students.length > 0 ? todayMarks : MOCK_MARKS;
    const map: Record<string, LocalMark> = {};
    activeStudents.forEach(s => { map[s.id] = { status: null, reason: null, notes: null }; });
    source.forEach(m => {
      map[m.student_id] = { status: m.status as MarkStatus, reason: m.reason, notes: m.notes };
    });
    return map;
  }, [activeStudents, todayMarks, students.length]);

  const [marks, setMarks] = useState<Record<string, LocalMark>>(initialMarks);
  const [showAll, setShowAll] = useState(false);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    let present = 0, absent = 0, late = 0;
    activeStudents.forEach(s => {
      const st = marks[s.id]?.status;
      if (st === "present" || st === null) present++;
      else if (st === "absent" || st === "excused") absent++;
      else if (st === "late") late++;
    });
    return { present, absent, late };
  }, [marks, activeStudents]);

  function buildPayload(studentId: string, m: LocalMark) {
    return {
      student_id:    studentId,
      section_id:    activeSlot.sectionId,
      bell_period_id: activeSlot.bellPeriodId,
      school_id:     schoolId,
      teacher_id:    teacherId,
      marked_on:     today,
      status:        (m.status ?? "present") as MarkStatus,
      reason:        m.reason,
      notes:         m.notes,
    };
  }

  function setStatus(studentId: string, status: MarkStatus) {
    const newMark: LocalMark = {
      status,
      reason: status === "present" ? null : marks[studentId]?.reason ?? null,
      notes:  marks[studentId]?.notes ?? null,
    };
    setMarks(prev => ({ ...prev, [studentId]: newMark }));
    if (schoolId && teacherId && activeSlot.bellPeriodId !== "mock") {
      startTransition(() => saveAttendanceMark(buildPayload(studentId, newMark)).catch(() => {}));
    }
  }

  function setReason(studentId: string, reason: string) {
    const newMark: LocalMark = { ...marks[studentId], reason };
    setMarks(prev => ({ ...prev, [studentId]: newMark }));
    if (schoolId && teacherId && activeSlot.bellPeriodId !== "mock") {
      startTransition(() => saveAttendanceMark(buildPayload(studentId, newMark)).catch(() => {}));
    }
  }

  function markAllPresent() {
    const updated: Record<string, LocalMark> = {};
    activeStudents.forEach(s => { updated[s.id] = { status: "present", reason: null, notes: null }; });
    setMarks(updated);
    setAiBannerDismissed(true);
    if (schoolId && teacherId && activeSlot.bellPeriodId !== "mock") {
      startTransition(() =>
        bulkSaveAttendance(activeStudents.map(s => buildPayload(s.id, updated[s.id]))).catch(() => {})
      );
    }
  }

  /**
   * Submit the roll call as it stands: unmarked students default to present,
   * marked exceptions (absent/late/excused) are kept — unlike markAllPresent,
   * which overwrites exceptions.
   */
  function submitAttendance() {
    const updated: Record<string, LocalMark> = {};
    activeStudents.forEach(s => {
      const m = marks[s.id];
      updated[s.id] = m?.status
        ? m
        : { status: "present", reason: null, notes: m?.notes ?? null };
    });
    setMarks(updated);
    setAiBannerDismissed(true);
    if (schoolId && teacherId && activeSlot.bellPeriodId !== "mock") {
      startTransition(() =>
        bulkSaveAttendance(activeStudents.map(s => buildPayload(s.id, updated[s.id]))).catch(() => {})
      );
    }
  }

  function clearAll() {
    const updated: Record<string, LocalMark> = {};
    activeStudents.forEach(s => { updated[s.id] = { status: null, reason: null, notes: null }; });
    setMarks(updated);
  }

  function fromYesterday() {
    const ydayMap = new Map(yesterdayMarks.map(m => [m.student_id, m]));
    const updated: Record<string, LocalMark> = { ...marks };
    activeStudents.forEach(s => {
      const yd = ydayMap.get(s.id);
      if (yd) updated[s.id] = { status: yd.status as MarkStatus, reason: yd.reason, notes: yd.notes };
    });
    setMarks(updated);
  }

  // Split students: non-present (always shown) + present-only (collapsed)
  const nonPresent = activeStudents.filter(s => {
    const st = marks[s.id]?.status;
    return st !== null && st !== "present";
  });
  const presentStudents = activeStudents.filter(s => {
    const st = marks[s.id]?.status;
    return st === null || st === "present";
  });
  const collapsedCount = showAll ? 0 : presentStudents.length;
  const visiblePresent = showAll ? presentStudents : [];
  const visibleStudents = [...nonPresent, ...visiblePresent];

  return (
    <div className="tap-page">
      {/* Class header */}
      <div className="tap-class-header">
        <div className="tap-class-top">
          {activeSlot.isNow
            ? <span className="tap-now-chip">NOW · {activeSlot.periodLabel}</span>
            : <span className="tap-period-chip">{activeSlot.periodLabel}</span>
          }
          <h1 className="tap-class-name">
            {activeSlot.sectionCode} {activeSlot.subjectName ?? ""}
          </h1>
        </div>
        <div className="tap-class-meta">
          {activeSlot.startsAt} — {activeSlot.endsAt}
          {activeSlot.roomCode && <> · {activeSlot.roomCode}</>}
          {" · "}{activeStudents.length} students
          {isPending && <span className="tap-saving"> · saving…</span>}
        </div>
      </div>

      {/* KPI counters */}
      <div className="tap-kpi-row">
        <div className="tap-kpi present">
          <div className="tap-kpi-val">{counts.present}</div>
          <div className="tap-kpi-label">PRESENT</div>
        </div>
        <div className="tap-kpi absent">
          <div className="tap-kpi-val">{counts.absent}</div>
          <div className="tap-kpi-label">ABSENT</div>
        </div>
        <div className="tap-kpi late">
          <div className="tap-kpi-val">{counts.late}</div>
          <div className="tap-kpi-label">LATE</div>
        </div>
      </div>

      {/* AI suggestion banner */}
      {!aiBannerDismissed && counts.absent === 0 && counts.late === 0 && (
        <div className="tap-ai-banner">
          <div className="tap-ai-avatar">M</div>
          <div className="tap-ai-text">
            Most days you mark all present then change exceptions.
            Want to apply that and just edit the few who aren&rsquo;t?
          </div>
          <button className="tap-ai-btn" onClick={markAllPresent}>
            Yes, mark all present
          </button>
          <button className="tap-ai-dismiss" onClick={() => setAiBannerDismissed(true)}>✕</button>
        </div>
      )}

      {/* Roll call header */}
      <div className="tap-roll-head">
        <span className="tap-roll-label">ROLL CALL · {activeStudents.length} STUDENTS</span>
        <span className="tap-sort-hint">Sort by name</span>
      </div>
      <div className="tap-quick-actions">
        <button className="tap-quick-btn" onClick={markAllPresent}>✓ All present</button>
        <button className="tap-quick-btn" onClick={clearAll}>✕ Clear all</button>
        <button className="tap-quick-btn" onClick={fromYesterday}>↩ From yesterday</button>
      </div>

      {/* Student rows */}
      <div className="tap-roll-list">
        {visibleStudents.map((s, i) => {
          const mark = marks[s.id] ?? { status: null, reason: null, notes: null };
          const st = mark.status;
          const isAbsent = st === "absent" || st === "excused";
          const isLate   = st === "late";
          const reasons  = isAbsent ? ABSENT_REASONS : isLate ? LATE_REASONS : [];
          const allIdx   = activeStudents.findIndex(x => x.id === s.id);

          return (
            <div key={s.id} className={`tap-row${isAbsent ? " is-absent" : isLate ? " is-late" : ""}`}>
              <div className="tap-row-main">
                <span className="tap-roll-num">{allIdx + 1}</span>
                <div
                  className="tap-avatar"
                  style={{ background: COLORS[(allIdx) % COLORS.length] }}
                >
                  {initials(s.full_name_en)}
                </div>
                <div className="tap-student-info">
                  <div className="tap-student-name">{s.full_name_en}</div>
                  <div className="tap-student-meta">
                    {activeSlot.sectionCode} · Roll #{allIdx + 1}
                    {mark.notes && <span className="tap-student-note"> · {mark.notes}</span>}
                  </div>
                </div>
                <div className="tap-status-btns">
                  <button
                    className={`tap-btn tap-present${st === "present" || st === null ? " active" : ""}`}
                    onClick={() => setStatus(s.id, "present")}
                    aria-label="Present"
                  >✓</button>
                  <button
                    className={`tap-btn tap-absent${isAbsent ? " active" : ""}`}
                    onClick={() => setStatus(s.id, "absent")}
                    aria-label="Absent"
                  >✕</button>
                  <button
                    className={`tap-btn tap-late${isLate ? " active" : ""}`}
                    onClick={() => setStatus(s.id, "late")}
                    aria-label="Late"
                  >🕐</button>
                </div>
              </div>

              {/* Reason chips */}
              {(isAbsent || isLate) && (
                <div className="tap-reason-row">
                  <span className="tap-reason-label">REASON:</span>
                  {reasons.map(r => (
                    <button
                      key={r}
                      className={`tap-reason-chip${mark.reason === r ? " active" : ""}`}
                      onClick={() => setReason(s.id, r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Collapsed present students */}
        {collapsedCount > 0 && (
          <div className="tap-collapsed" onClick={() => setShowAll(true)}>
            <div className="tap-collapsed-avatars">
              {presentStudents.slice(0, 3).map((s, i) => (
                <div
                  key={s.id}
                  className="tap-collapsed-avatar"
                  style={{ background: COLORS[activeStudents.findIndex(x => x.id === s.id) % COLORS.length], left: i * 18 }}
                >
                  {initials(s.full_name_en)}
                </div>
              ))}
            </div>
            <span className="tap-collapsed-text">
              {collapsedCount} more student{collapsedCount !== 1 ? "s" : ""} — all marked present
            </span>
            <button className="tap-show-btn">show</button>
          </div>
        )}
      </div>

      {/* Submit footer */}
      <div className="tap-footer">
        <div className="tap-footer-summary">
          {counts.present} present · {counts.absent} absent · {counts.late} late
        </div>
        <button
          className="tap-submit-btn"
          onClick={submitAttendance}
        >
          Submit attendance
        </button>
      </div>
    </div>
  );
}
