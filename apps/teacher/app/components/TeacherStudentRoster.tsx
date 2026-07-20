"use client";

/**
 * TeacherStudentRoster
 *
 * Scoped student view for the Teacher Analyze page. Shows all students in
 * the teacher's sections with subject-specific columns:
 *   Avatar · Name · Section · Attendance % (in my class) · Last assessment
 *   score/band · Last submission status · My disciplinary notes count
 *
 * Includes a search + section filter matching the admin/students pattern.
 */

import { useState, useMemo } from "react";
import type { TeacherStudentRow, SubmissionStatus } from "@manhaj/lib/mock-teacher-students";
import StudentSearchFilter from "./StudentSearchFilter";
import StudentDetailPanel from "./StudentDetailPanel";

// ---- helpers ----------------------------------------------------------------

function scoreBand(score: number): string {
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 55) return "C+";
  return "C";
}

function initials(name: string): string {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  submitted:   "submitted",
  in_progress: "in progress",
  missing:     "missing",
};

const SUBMISSION_TONE: Record<SubmissionStatus, string> = {
  submitted:   "tsr-sub-ok",
  in_progress: "tsr-sub-wip",
  missing:     "tsr-sub-miss",
};

// ---- component --------------------------------------------------------------

interface Props {
  students: TeacherStudentRow[];
  sections: string[];
}

export default function TeacherStudentRoster({ students, sections }: Props) {
  const [searchValue,   setSearchValue]   = useState("");
  const [sectionValue,  setSectionValue]  = useState("");
  const [openStudent,   setOpenStudent]   = useState<TeacherStudentRow | null>(null);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return students.filter(s => {
      const matchesName    = q === "" || s.full_name.toLowerCase().includes(q);
      const matchesSection = sectionValue === "" || s.section_code === sectionValue;
      return matchesName && matchesSection;
    });
  }, [students, searchValue, sectionValue]);

  return (
    <section className="tsr-card" aria-label="My students roster">
      <header className="tsr-head">
        <div>
          <h3>My students · {students.length} across {sections.length} sections</h3>
          <p className="tsr-sub">Subject-specific data — attendance, assessments, and submission status in your classes.</p>
        </div>
      </header>

      <StudentSearchFilter
        searchValue={searchValue}
        sectionValue={sectionValue}
        onSearchChange={setSearchValue}
        onSectionChange={setSectionValue}
        sections={sections}
      />

      {filtered.length === 0 ? (
        <p className="ssf-empty">No students match the current filter.</p>
      ) : (
        <div className="tsr-tbl-wrap">
          <table className="tsr-tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Section</th>
                <th>Att. my class</th>
                <th>Last assessment</th>
                <th>Submission</th>
                <th>My notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="tsr-row">
                  {/* Avatar + name */}
                  <td className="tsr-name-cell">
                    <span className="tsr-avatar" aria-hidden="true">{initials(s.full_name)}</span>
                    <span className="tsr-name">{s.full_name}</span>
                  </td>

                  {/* Section */}
                  <td>
                    <span className="tsr-section">{s.section_code}</span>
                  </td>

                  {/* Attendance in teacher's class */}
                  <td>
                    <span className={`tsr-att ${s.teacher_att_pct >= 90 ? "tsr-att-good" : "tsr-att-warn"}`}>
                      {s.teacher_att_pct}%
                    </span>
                  </td>

                  {/* Last assessment score + band */}
                  <td className="tsr-assess-cell">
                    <span className="tsr-score">{s.last_assessment_score}%</span>
                    <span className="tsr-band">{scoreBand(s.last_assessment_score)}</span>
                    <span className="tsr-assess-label">{s.last_assessment_label}</span>
                  </td>

                  {/* Submission status */}
                  <td>
                    <span className={`tsr-sub-pill ${SUBMISSION_TONE[s.submission_status]}`}>
                      {SUBMISSION_LABEL[s.submission_status]}
                    </span>
                  </td>

                  {/* Disciplinary notes count */}
                  <td className="tsr-notes">
                    {s.discipline_notes_count === 0
                      ? <span className="tsr-notes-none">—</span>
                      : <span className={`tsr-notes-count ${s.discipline_notes_count >= 2 ? "tsr-notes-warn" : ""}`}>{s.discipline_notes_count}</span>
                    }
                  </td>

                  {/* Open button → student detail panel */}
                  <td>
                    <button
                      type="button"
                      className="tsr-open-btn"
                      onClick={() => setOpenStudent(s)}
                      aria-haspopup="dialog"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openStudent && (
        <StudentDetailPanel
          key={openStudent.id}
          studentId={openStudent.id}
          studentName={openStudent.full_name}
          sectionCode={openStudent.section_code}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </section>
  );
}
