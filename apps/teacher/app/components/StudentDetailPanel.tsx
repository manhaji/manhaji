"use client";

/**
 * StudentDetailPanel — slide-over opened by the roster "Open" button.
 * Shows notes, missing homework, and recent grades for one student.
 * DB-first via the fetchStudentPanel server action; falls back to demo
 * content when the DB has no rows for the student (OR pattern).
 * Submission tracking itself is Phase 3 — "missing homework" here uses the
 * real gap in assessment_results for homework-kind assessments.
 */

import { useEffect, useState } from "react";
import type { StudentPanelData } from "@manhaj/lib/queries/studentpanel";
import { fetchStudentPanel } from "../actions/studentpanel";

type Props = {
  studentId: string;
  studentName: string;
  sectionCode: string;
  onClose: () => void;
};

const DEMO_PANEL: StudentPanelData = {
  notes: [
    { id: "d1", note: "Explained her fraction method to a peer with real confidence.", kind: "positive", observed_on: "2026-07-15", teacher_name: "Ms Swart" },
    { id: "d2", note: "Arrived without homework twice this week — flagged to follow up.", kind: "concern", observed_on: "2026-07-13", teacher_name: "Ms Swart" },
  ],
  recentGrades: [
    { label: "Ch. 4 quiz", subject: "History", held_on: "2026-07-14", score: 17, max_score: 20 },
    { label: "Source-analysis essay", subject: "History", held_on: "2026-07-07", score: 74, max_score: 100 },
    { label: "Map skills check", subject: "Geography", held_on: "2026-06-30", score: 8, max_score: 10 },
  ],
  missingHomework: [
    { label: "Primary-source worksheet", subject: "History", held_on: "2026-07-16" },
  ],
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

export default function StudentDetailPanel({ studentId, studentName, sectionCode, onClose }: Props) {
  // NOTE: the roster renders this panel with key={studentId}, so a different
  // student remounts the component and loading state resets naturally.
  const [data, setData] = useState<StudentPanelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchStudentPanel(studentId)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isEmpty = !data || (data.notes.length === 0 && data.recentGrades.length === 0 && data.missingHomework.length === 0);
  const panel = isEmpty ? DEMO_PANEL : data;
  const usingDemo = !loading && isEmpty;

  return (
    <div className="sdp-overlay" role="presentation" onClick={onClose}>
      <aside
        className="sdp-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Student detail — ${studentName}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="sdp-head">
          <span className="sdp-avatar" aria-hidden="true">{initials(studentName)}</span>
          <div className="sdp-head-info">
            <div className="sdp-name">{studentName}</div>
            <div className="sdp-meta">{sectionCode}{usingDemo ? " · sample data" : ""}</div>
          </div>
          <button type="button" className="sdp-close" onClick={onClose} aria-label="Close panel">✕</button>
        </header>

        {loading ? (
          <div className="sdp-loading">Loading student record…</div>
        ) : (
          <div className="sdp-body">
            <section className="sdp-section" aria-label="Notes">
              <h4 className="sdp-section-head">Notes</h4>
              {panel.notes.length === 0 ? (
                <p className="sdp-empty">No notes recorded.</p>
              ) : panel.notes.map(n => (
                <div key={n.id} className={`sdp-note sdp-note-${n.kind}`}>
                  <div className="sdp-note-text">{n.note}</div>
                  <div className="sdp-note-meta">
                    {n.teacher_name ? `${n.teacher_name} · ` : ""}{fmtDate(n.observed_on)}
                  </div>
                </div>
              ))}
            </section>

            <section className="sdp-section" aria-label="Missing homework">
              <h4 className="sdp-section-head">Missing homework</h4>
              {panel.missingHomework.length === 0 ? (
                <p className="sdp-empty">Nothing outstanding.</p>
              ) : panel.missingHomework.map((h, i) => (
                <div key={i} className="sdp-hw-row">
                  <span className="sdp-hw-label">{h.label}</span>
                  <span className="sdp-hw-meta">{h.subject ?? "—"} · set {fmtDate(h.held_on)}</span>
                  <span className="sdp-hw-pill">missing</span>
                </div>
              ))}
            </section>

            <section className="sdp-section" aria-label="Recent grades">
              <h4 className="sdp-section-head">Recent grades</h4>
              {panel.recentGrades.length === 0 ? (
                <p className="sdp-empty">No scored assessments yet.</p>
              ) : (
                <table className="sdp-grades">
                  <thead>
                    <tr><th>Assessment</th><th>Subject</th><th>Date</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {panel.recentGrades.map((g, i) => {
                      const pct = g.max_score > 0 ? Math.round((g.score / g.max_score) * 100) : 0;
                      return (
                        <tr key={i}>
                          <td>{g.label}</td>
                          <td>{g.subject ?? "—"}</td>
                          <td>{fmtDate(g.held_on)}</td>
                          <td><span className={`sdp-score ${pct >= 70 ? "good" : pct >= 50 ? "mid" : "low"}`}>{g.score}/{g.max_score}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
