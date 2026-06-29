"use client";

import { useState } from "react";
import { generateHomework, type Question } from "@manhaj/lib/homework-generator";

type StudentOption = { id: string; full_name: string; section_code: string };

type ClassOption = {
  id:      string;
  label:   string;
  section: string;
  subject: string;
};

const CLASS_OPTIONS: ClassOption[] = [
  { id: "10a-history-mon",   label: "10A · History · Mon P3",     section: "10A",   subject: "History"   },
  { id: "10a-geography-tue", label: "10A · Geography · Tue P4",   section: "10A",   subject: "Geography" },
  { id: "10a-mun-wed",       label: "10A · MUN club · Wed P5",    section: "10A",   subject: "MUN"       },
  { id: "9a-history-thu",    label: "9A · History · Thu P4",      section: "9A",    subject: "History"   },
  { id: "11as-english-tue",  label: "11 AS · English · Tue P3",   section: "11 AS", subject: "English"   },
  { id: "12a2-english-mon",  label: "12 A2 · English · Mon P5",   section: "12 A2", subject: "English"   },
];

type Severity = "minor" | "major" | "positive";

type StudentNote = {
  student_id:   string;
  student_name: string;
  section_code: string;
  note:         string;
  severity:     Severity;
};

export default function TeacherInputPageClient({ students }: { students: StudentOption[] }) {
  const [selectedClass, setSelectedClass] = useState<ClassOption>(CLASS_OPTIONS[0]);
  const [summary,       setSummary]       = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [notes,         setNotes]         = useState<StudentNote[]>([]);
  const [hwCount,       setHwCount]       = useState<5 | 8 | 10>(5);
  const [hwDifficulty,  setHwDifficulty]  = useState<"easy" | "medium" | "hard">("medium");
  const [hwExtra,       setHwExtra]       = useState("");
  const [generating,    setGenerating]    = useState(false);
  const [questions,     setQuestions]     = useState<Question[]>([]);
  const [editedQ,       setEditedQ]       = useState<Record<string, string>>({});
  const [pushed,        setPushed]        = useState(false);

  function handleClassChange(id: string) {
    const opt = CLASS_OPTIONS.find(c => c.id === id) ?? CLASS_OPTIONS[0];
    setSelectedClass(opt);
    setQuestions([]);
    setEditedQ({});
    setPushed(false);
  }

  function handleAddStudentNote(s: StudentOption) {
    if (notes.some(n => n.student_id === s.id)) return;
    setNotes(prev => [...prev, {
      student_id:   s.id,
      student_name: s.full_name,
      section_code: s.section_code,
      note:         "",
      severity:     "minor",
    }]);
    setStudentSearch("");
  }

  function handleNoteChange(student_id: string, note: string) {
    setNotes(prev => prev.map(n => n.student_id === student_id ? { ...n, note } : n));
  }

  function handleSeverityChange(student_id: string, severity: Severity) {
    setNotes(prev => prev.map(n => n.student_id === student_id ? { ...n, severity } : n));
  }

  function handleRemoveNote(student_id: string) {
    setNotes(prev => prev.filter(n => n.student_id !== student_id));
  }

  function handleGenerate() {
    setGenerating(true);
    setQuestions([]);
    setEditedQ({});
    setPushed(false);

    const topic = summary.trim()
      ? summary.trim().slice(0, 80).split(".")[0].trim()
      : "";

    setTimeout(() => {
      const result = generateHomework({
        section_id:  selectedClass.section,
        subject:     selectedClass.subject,
        topic,
        difficulty:  hwDifficulty,
        count:       hwCount,
        extraPrompt: hwExtra,
      });
      setQuestions(result.questions);
      setGenerating(false);
    }, 1500);
  }

  function getQuestionText(q: Question): string {
    return editedQ[q.id] !== undefined ? editedQ[q.id] : q.text;
  }

  const sectionStudentCount = students.filter(s => s.section_code === selectedClass.section).length;

  function handlePush() {
    console.log("[Teacher Input] Pushing homework to students", {
      class:     selectedClass.label,
      section:   selectedClass.section,
      subject:   selectedClass.subject,
      questions: questions.map(q => ({ id: q.id, text: getQuestionText(q), type: q.type })),
    });
    setPushed(true);
  }

  const searchResults = studentSearch.trim().length >= 2
    ? students
        .filter(s =>
          s.section_code === selectedClass.section &&
          s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) &&
          !notes.some(n => n.student_id === s.id)
        )
        .slice(0, 5)
    : [];

  return (
    <div className="container">
      <h1>Input data</h1>
      <p className="sub">Record this week&apos;s teaching · disciplinary notes · assign homework</p>

      <section className="ti-section">
        <h3 className="ti-section-head">A · Select class</h3>
        <div className="ti-select-wrap">
          <select
            className="ti-select"
            value={selectedClass.id}
            onChange={e => handleClassChange(e.target.value)}
            aria-label="Select class"
          >
            {CLASS_OPTIONS.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="ti-section">
        <h3 className="ti-section-head">B · Class summary</h3>
        <label className="ti-label" htmlFor="summary-input">
          What did you teach in this class?
        </label>
        <textarea
          id="summary-input"
          className="ti-textarea"
          rows={5}
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="e.g. Covered Chapter 7 — the rise of constitutional monarchies. Worked through the Magna Carta primary source. Will revisit prerogative powers next lesson."
        />
        <button
          type="button"
          className="ti-btn ghost"
          onClick={() => console.log("[Teacher Input] Summary saved:", summary)}
        >
          Save summary
        </button>
      </section>

      <section className="ti-section">
        <h3 className="ti-section-head">C · Disciplinary notes / observations</h3>
        <div className="ti-student-search-wrap">
          <input
            type="search"
            className="ti-search"
            placeholder="Search student in this section…"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            aria-label="Search students"
          />
          {searchResults.length > 0 && (
            <ul className="ti-search-results" role="listbox">
              {searchResults.map(s => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected="false"
                  className="ti-search-result"
                  onClick={() => handleAddStudentNote(s)}
                  onKeyDown={e => e.key === "Enter" && handleAddStudentNote(s)}
                  tabIndex={0}
                >
                  {s.full_name} <span className="ti-search-section">{s.section_code}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notes.length > 0 && (
          <div className="ti-notes-list">
            {notes.map(n => (
              <div key={n.student_id} className="ti-note-row">
                <div className="ti-note-header">
                  <span className="ti-note-name">{n.student_name}</span>
                  <span className="ti-note-section">{n.section_code}</span>
                  <div className="ti-severity-chips">
                    {(["minor", "major", "positive"] as Severity[]).map(sev => (
                      <button
                        key={sev}
                        type="button"
                        className={`ti-severity-chip ${sev} ${n.severity === sev ? "active" : ""}`}
                        onClick={() => handleSeverityChange(n.student_id, sev)}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ti-remove-btn"
                    onClick={() => handleRemoveNote(n.student_id)}
                    aria-label={`Remove note for ${n.student_name}`}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className="ti-textarea small"
                  rows={2}
                  value={n.note}
                  onChange={e => handleNoteChange(n.student_id, e.target.value)}
                  placeholder="Add a note about this student…"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="ti-btn ghost"
          onClick={() => console.log("[Teacher Input] Notes saved:", notes)}
        >
          Save notes
        </button>
      </section>

      <section className="ti-section">
        <h3 className="ti-section-head">D · Generate + assign homework</h3>
        <p className="ti-section-sub">
          The AI generates questions based on your class summary
          {summary.trim() ? ` (topic: "${summary.trim().slice(0, 60)}…")` : " (fill in a summary above for best results)"}.
          You can edit each question before pushing to students.
        </p>

        <div className="ti-hw-controls">
          <div className="ti-hw-group">
            <span className="ti-hw-label">Questions</span>
            <div className="ti-chip-row">
              {([5, 8, 10] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  className={`ti-chip ${hwCount === n ? "active" : ""}`}
                  onClick={() => setHwCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="ti-hw-group">
            <span className="ti-hw-label">Difficulty</span>
            <div className="ti-chip-row">
              {(["easy", "medium", "hard"] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  className={`ti-chip ${hwDifficulty === d ? "active" : ""}`}
                  onClick={() => setHwDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="ti-label" htmlFor="hw-extra">
          Anything else for the AI to consider? <span className="ti-label-opt">(optional)</span>
        </label>
        <textarea
          id="hw-extra"
          className="ti-textarea small"
          rows={2}
          value={hwExtra}
          onChange={e => setHwExtra(e.target.value)}
          placeholder="e.g. Focus on primary sources. Include one Arabic-language term. Avoid multiple-choice."
        />

        <button
          type="button"
          className="ti-btn primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "AI is generating questions…" : "Generate questions"}
        </button>

        {generating && (
          <div className="ti-thinking">
            <span className="ti-thinking-spinner" aria-hidden="true" />
            AI is generating questions based on your class summary…
          </div>
        )}

        {questions.length > 0 && !generating && (
          <div className="ti-questions-card">
            <div className="ti-questions-head">
              Generated {questions.length} questions for <strong>{selectedClass.label}</strong>
            </div>
            <ol className="ti-questions-list">
              {questions.map((q, i) => (
                <li key={q.id} className="ti-question-row">
                  <span className="ti-q-type-badge">{q.type}</span>
                  <input
                    type="text"
                    className="ti-q-input"
                    value={getQuestionText(q)}
                    onChange={e => setEditedQ(prev => ({ ...prev, [q.id]: e.target.value }))}
                    aria-label={`Question ${i + 1}`}
                  />
                </li>
              ))}
            </ol>

            {pushed ? (
              <div className="ti-push-success">
                ✓ Sent to {sectionStudentCount} students in {selectedClass.section} · they will see it on their Homework tab tomorrow morning.
              </div>
            ) : (
              <div className="ti-push-actions">
                <button type="button" className="ti-btn primary" onClick={handlePush}>
                  Push to students
                </button>
                <button type="button" className="ti-btn ghost" onClick={handleGenerate}>
                  Regenerate
                </button>
                <button type="button" className="ti-btn ghost" onClick={() => { setQuestions([]); setEditedQ({}); }}>
                  Discard
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
