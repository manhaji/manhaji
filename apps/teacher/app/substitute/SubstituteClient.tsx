"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DaySlot, SlotLesson, StudentFlag, SubSheetRow, FreePeriod } from "@manhaj/lib/queries/substitute";
import { acknowledgeSheet } from "../actions/substitute";

type Props = {
  slots: DaySlot[];
  lessons: SlotLesson[];
  flags: StudentFlag[];
  sheet: SubSheetRow | null;
  freePeriods: FreePeriod[];
  teacherName: string;
  teacherId: string;
  forDate: string;
  today: string;
};

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_TEACHER = "Mr. Tariq";

const MOCK_SLOTS: DaySlot[] = [
  { slotId: "p1", sectionId: "g5b", sectionCode: "G5B", gradeLevel: "Grade 5", subjectName: "Maths", roomCode: "Room 12", bellPeriodId: "b1", periodLabel: "P1", periodNumber: 1, startsAt: "08:00", endsAt: "08:45" },
  { slotId: "p3", sectionId: "g5a", sectionCode: "G5A", gradeLevel: "Grade 5", subjectName: "Maths", roomCode: "Room 8",  bellPeriodId: "b3", periodLabel: "P3", periodNumber: 3, startsAt: "10:00", endsAt: "10:45" },
  { slotId: "p5", sectionId: "g5b", sectionCode: "G5B", gradeLevel: "Grade 5", subjectName: "Maths", roomCode: "Room 12", bellPeriodId: "b5", periodLabel: "P5", periodNumber: 5, startsAt: "10:45", endsAt: "11:45" },
  { slotId: "p6", sectionId: "g5c", sectionCode: "G5C", gradeLevel: "Grade 5", subjectName: "Maths", roomCode: "Room 14", bellPeriodId: "b6", periodLabel: "P6", periodNumber: 6, startsAt: "12:00", endsAt: "13:00" },
];

const MOCK_FREE: { periodNumber: number; startsAt: string; endsAt: string; label: string }[] = [
  { periodNumber: 2, startsAt: "08:45", endsAt: "09:00", label: "P2" },
  { periodNumber: 4, startsAt: "09:00", endsAt: "10:00", label: "P4" },
];

const MOCK_LESSONS: SlotLesson[] = [
  { id: "l1", sectionId: "g5b", topic: "Equivalent fractions · Introduction", learningObjective: "Open the fractions-strips activity (top in the sidebar), left side, named 'Fri Day 1'. Work through 3 benchmarks using the 'Equivalence visualiser'. These students may not have seen equivalent fractions yet — 22 students, 24 books. Ask one or two of the problems together — homework is to finish the last at home.", homeworkDescription: "Finish fraction strips problems 3–6 at home." },
  { id: "l3", sectionId: "g5a", topic: "Multiplication tables · weekly review", learningObjective: "Run the flash-card warm-up (cards in Room 8 cabinet). Run the times-table game from the laminator. Mr. Tariq usually rewards winners with stickers — the box is in the top drawer.", homeworkDescription: null },
  { id: "l5", sectionId: "g5b", topic: "Multiplication practice (continued from P1)", learningObjective: "Continue the multiplication from Period 1. Aim to finish problems 1–10 together. The last 10 problems are new questions — added at the door. Leave any unfinished. Note: I ran Period 1 with this group, so there's room for a little extra practice, as noted below.", homeworkDescription: null },
  { id: "l6", sectionId: "g5c", topic: "Decimal fractions · Introduction", learningObjective: "Open with a real-world example (money works well as an anchor). Teach the concept of 1/100 (one part in a hundred). Stop after Slide 8 and have students do examples 1–5 in groups of 8.", homeworkDescription: null },
];

const GENERIC_CHECKLIST_ITEMS = [
  "Take attendance at the start of class",
  "Follow the lesson plan outlined above",
  "Leave any collected work on the teacher's desk",
];

const MOCK_CHECKLIST: Record<string, string[]> = {
  g5b_p1: ["Fraction strips activity — open file 'Fri Day'", "Fraction strips — call 'Fri Day'", "Smartboard equivalence visualiser", "Homework task on Mr. Tariq's desk"],
  g5a:    ["Flash cards (cabinet, Room 8)", "Times-table game from laminator", "Stickers in top drawer"],
  g5b_p5: ["Multiplication worksheet printed", "Leave any unfinished problems for Period 6"],
  g5c:    ["Slides 1–8 loaded on board", "Group-work prompt on board (examples 1–5)"],
};

const MOCK_FLAGS: StudentFlag[] = [
  { studentId: "sf1", studentName: "Layla Al-Habel",  note: "Recent quiz top scorer. Uplifter — copy, school chair ask, add. She has been recently appointed class representative. If she finishes early, ask her to help peers with P3-P6.",  source: "behaviour",  tag: "RECOGNITION", sectionId: null },
  { studentId: "sf2", studentName: "Bilal Al-Mahri",  note: "About this — showing the chapter you passed. Hand the last catch-up sheet at the side of class and check homework with them especially.",                                               source: "followup",   tag: "FOLLOW-UP",   sectionId: null },
  { studentId: "sf3", studentName: "Fatima Al-Hinai", note: "Has done less this week. Make her own quality — doesn't make it on things. If she's stuck, sit next to her for 5 minutes.",                                                              source: "followup",   tag: "CONCERN",     sectionId: null },
  { studentId: "sf4", studentName: "Hassan Al-Said",  note: "Last had a chat last Thursday. Suggest he's doing adequately. Show him how his 3 is leading. Section: G5A.",                                                                              source: "behaviour",  tag: null,          sectionId: null },
  { studentId: "sf5", studentName: "Bilal Hassan",    note: "English language learner. He understands maths well but needs bilingual support when reading word problems. His marks are improving.",                                                     source: "followup",   tag: "ELL",         sectionId: null },
];

// Map sectionId → flags
function flagsForSection(sectionId: string, allFlags: StudentFlag[], isMock: boolean, mockSectionId: string): StudentFlag[] {
  if (isMock) {
    const map: Record<string, StudentFlag[]> = {
      g5b: MOCK_FLAGS.filter(f => ["sf1","sf2","sf3"].includes(f.studentId)),
      g5a: MOCK_FLAGS.filter(f => f.studentId === "sf4"),
      g5c: MOCK_FLAGS.filter(f => f.studentId === "sf5"),
    };
    return map[mockSectionId] ?? [];
  }
  return allFlags.filter(f => f.sectionId === sectionId);
}

function checklistKey(slot: DaySlot, periodIndex: number): string {
  if (slot.sectionCode === "G5B" && periodIndex === 0) return "g5b_p1";
  if (slot.sectionCode === "G5B") return "g5b_p5";
  if (slot.sectionCode === "G5A") return "g5a";
  if (slot.sectionCode === "G5C") return "g5c";
  return slot.sectionId;
}

const FLAG_COLORS: Record<string, string> = {
  "RECOGNITION": "#C6F6D5",
  "CONCERN":     "#FED7D7",
  "FOLLOW-UP":   "#BEE3F8",
  "ELL":         "#E9D8FD",
};

const EMERGENCY_CONTACTS = [
  { role: "School Reception",     name: "",              ext: "Ext 100", phone: "+968 1234 5588", location: "" },
  { role: "School Nurse",         name: "Ms. Aisha",     ext: "Ext 234", phone: "",               location: "room 3 · ground floor" },
  { role: "Head of Year",         name: "Mr. Khalid",    ext: "Ext 220", phone: "+968 1234 5588", location: "" },
  { role: "IT",                   name: "",              ext: "Ext 234", phone: "",               location: "room 7 · ground floor" },
];

const END_OF_DAY = [
  "Attendance must be submitted before you leave (Mr. Tariq will check from home · takes 2 minutes)",
  "Return attendance sheet to reception",
  "Any work collected from students — leave on Mr. Tariq's desk",
  "Put any student concerns in the Manhaj app (takes 5 minutes)",
  "Say \"Day's over\" in the app — Mr. Tariq is automatically notified",
];

function fmtDateLong(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function offsetDate(d: string, days: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function SubstituteClient({ slots, lessons, flags, sheet, freePeriods, teacherName, teacherId, forDate, today }: Props) {
  const isMock = slots.length === 0;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkDone, setCheckDone]   = useState<Record<string, boolean>>({});
  const [endDone, setEndDone]       = useState<boolean[]>(END_OF_DAY.map(() => false));
  const [acknowledged, setAcknowledged] = useState(!!sheet?.ack_at);

  const activeSlots = isMock ? MOCK_SLOTS : slots;
  const activeLessons: SlotLesson[] = isMock ? MOCK_LESSONS : lessons;
  const activeFlags: StudentFlag[] = isMock ? MOCK_FLAGS : flags;
  const displayName = teacherName || MOCK_TEACHER;

  // Build a map: sectionId → lesson
  const lessonMap = new Map(activeLessons.map(l => [l.sectionId, l]));

  // All periods (teaching + free) merged and sorted
  type PeriodEntry = { type: "teaching"; slot: DaySlot; mockIdx: number } | { type: "free"; periodNumber: number; startsAt: string; endsAt: string; label: string };
  const allPeriods: PeriodEntry[] = [];
  if (isMock) {
    let si = 0;
    for (let p = 1; p <= 6; p++) {
      const slot = MOCK_SLOTS.find(s => s.periodNumber === p);
      const free = MOCK_FREE.find(f => f.periodNumber === p);
      if (slot) { allPeriods.push({ type: "teaching", slot, mockIdx: si++ }); }
      else if (free) { allPeriods.push({ type: "free", ...free }); }
    }
  } else {
    const periodNums = [
      ...activeSlots.map(s => s.periodNumber),
      ...freePeriods.map(f => f.periodNumber),
    ].sort((a, b) => a - b).filter((v, i, arr) => arr.indexOf(v) === i);
    let si = 0;
    for (const p of periodNums) {
      const slot = activeSlots.find(s => s.periodNumber === p);
      const free = freePeriods.find(f => f.periodNumber === p);
      if (slot) allPeriods.push({ type: "teaching", slot, mockIdx: si++ });
      else if (free) allPeriods.push({ type: "free", ...free });
    }
  }

  function navigate(d: string) {
    router.push(`/teacher/substitute?date=${d}`);
  }

  function handleAck() {
    setAcknowledged(true);
    if (sheet?.id) {
      startTransition(() => acknowledgeSheet(sheet.id).catch(() => {}));
    }
  }

  return (
    <div className="sub-page">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="sub-header">
        <div className="sub-header-left">
          <div className="sub-header-title">{displayName}&apos;s classes — {fmtDateLong(forDate)}</div>
          {sheet?.sub_teacher_id && (
            <div className="sub-notif">
              Substitute assigned · handoff sheet active
            </div>
          )}
        </div>
        <div className="sub-header-nav">
          <button className="sub-nav-btn" onClick={() => navigate(offsetDate(forDate, -1))}>← Prev</button>
          <button className={`sub-nav-btn${forDate === today ? " active" : ""}`} onClick={() => navigate(today)}>Today</button>
          <button className="sub-nav-btn" onClick={() => navigate(offsetDate(forDate, 1))}>Next →</button>
          {isPending && <span className="sub-saving">saving…</span>}
        </div>
      </div>

      {/* ── Period strip ─────────────────────────────────────────────────── */}
      <div className="sub-period-strip">
        {allPeriods.map((entry, i) => {
          if (entry.type === "free") {
            return (
              <div key={`free-${entry.periodNumber}`} className="sub-period-pill free">
                <div className="sub-pill-period">{entry.label}</div>
                <div className="sub-pill-label">Free</div>
                <div className="sub-pill-time">{entry.startsAt}</div>
              </div>
            );
          }
          const { slot } = entry;
          return (
            <div key={slot.slotId} className="sub-period-pill teaching">
              <div className="sub-pill-period">{slot.periodLabel}</div>
              <div className="sub-pill-section">{slot.sectionCode}</div>
              <div className="sub-pill-subject">{slot.subjectName}</div>
              <div className="sub-pill-time">{slot.startsAt}</div>
            </div>
          );
        })}
      </div>

      {/* ── Period cards ─────────────────────────────────────────────────── */}
      <div className="sub-cards">
        {allPeriods.map((entry, i) => {
          if (entry.type === "free") {
            return (
              <div key={`free-card-${entry.periodNumber}`} className="sub-free-card">
                <span className="sub-free-label">Free period</span>
                <span className="sub-free-time">{entry.startsAt} — {entry.endsAt}</span>
              </div>
            );
          }

          const { slot, mockIdx } = entry;
          const lesson = lessonMap.get(slot.sectionId);
          const ck = checklistKey(slot, mockIdx);
          const checkItems = MOCK_CHECKLIST[ck] ?? GENERIC_CHECKLIST_ITEMS;
          const sectionFlags = isMock
            ? flagsForSection(slot.sectionId, activeFlags, true, slot.sectionCode.toLowerCase())
            : flagsForSection(slot.sectionId, activeFlags, false, "");
          const isFirstOfSection = activeSlots.findIndex(s => s.sectionId === slot.sectionId) === mockIdx;
          const isSameClass = !isFirstOfSection && activeSlots.filter(s => s.sectionId === slot.sectionId).length > 1;

          return (
            <div key={slot.slotId} className="sub-period-card">
              {/* Card header */}
              <div className="sub-card-header">
                <div className="sub-card-header-left">
                  <span className="sub-card-period">{slot.periodLabel} — {slot.sectionCode}</span>
                  {isSameClass && <span className="sub-same-chip">same class as P1</span>}
                  <span className="sub-card-time">{slot.startsAt} — {slot.endsAt}</span>
                </div>
                <div className="sub-card-header-right">
                  <span className="sub-card-class">{slot.sectionCode} {slot.subjectName}</span>
                  {slot.roomCode && <span className="sub-card-room">· {slot.roomCode}</span>}
                </div>
              </div>

              {/* Lesson plan */}
              {(lesson || isMock) && (
                <div className="sub-lesson-block">
                  <div className="sub-lesson-label">LESSON PLAN</div>
                  <div className="sub-lesson-topic">{lesson?.topic ?? "—"}</div>
                  {lesson?.learningObjective && (
                    <div className="sub-lesson-obj">{lesson.learningObjective}</div>
                  )}
                </div>
              )}

              {/* Checklist */}
              {checkItems.length > 0 && (
                <div className="sub-checks-block">
                  {checkItems.map((c, ci) => {
                    const key = `${slot.slotId}-${ci}`;
                    return (
                      <label key={key} className="sub-check-item">
                        <input
                          type="checkbox"
                          checked={checkDone[key] ?? false}
                          onChange={() => setCheckDone(prev => ({ ...prev, [key]: !prev[key] }))}
                        />
                        <span className={checkDone[key] ? "sub-check-text done" : "sub-check-text"}>{c}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Student flags */}
              {sectionFlags.length > 0 && (
                <div className="sub-flags-block">
                  {sectionFlags.map(f => (
                    <div key={f.studentId} className="sub-flag-row">
                      <div className="sub-flag-name">
                        {f.studentName}
                        {f.tag && (
                          <span className="sub-flag-chip" style={{ background: FLAG_COLORS[f.tag] ?? "#EDF2F7" }}>
                            {f.tag}
                          </span>
                        )}
                      </div>
                      <div className="sub-flag-note">{f.note}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Homework note */}
              {lesson?.homeworkDescription && (
                <div className="sub-hw-note">
                  <span className="sub-hw-label">HOMEWORK TO SET:</span> {lesson.homeworkDescription}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Emergency contacts ─────────────────────────────────────────── */}
        <div className="sub-emergency-card">
          <div className="sub-emergency-head">⚠ Who to call if something happens</div>
          <div className="sub-emergency-grid">
            {EMERGENCY_CONTACTS.map((c, i) => (
              <div key={i} className="sub-emergency-item">
                <div className="sub-ec-role">{c.role}{c.name && ` · ${c.name}`}</div>
                <div className="sub-ec-detail">
                  {c.ext}{c.phone && ` · ${c.phone}`}{c.location && ` · ${c.location}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── End of day checklist ───────────────────────────────────────── */}
        <div className="sub-endday-card">
          <div className="sub-endday-head">End of day — before you leave</div>
          {END_OF_DAY.map((item, i) => (
            <label key={i} className="sub-endday-row">
              <input
                type="checkbox"
                checked={endDone[i]}
                onChange={() => setEndDone(prev => prev.map((v, j) => j === i ? !v : v))}
              />
              <span className={endDone[i] ? "sub-endday-text done" : "sub-endday-text"}>{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="sub-footer">
        <div className="sub-footer-meta">
          {activeSlots.length} teaching period{activeSlots.length !== 1 ? "s" : ""} · {activeSlots.length > 0 ? `${activeSlots[0].startsAt} — ${activeSlots[activeSlots.length - 1].endsAt}` : ""}
        </div>
        <div className="sub-footer-actions">
          <button className="sub-pdf-btn" onClick={() => window.print()}>Save as PDF</button>
          <button
            className={`sub-ack-btn${acknowledged ? " done" : ""}`}
            onClick={handleAck}
            disabled={acknowledged}
          >
            {acknowledged ? "✓ I've read this" : "I've read this →"}
          </button>
        </div>
      </div>
    </div>
  );
}
