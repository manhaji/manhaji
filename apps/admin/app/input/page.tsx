/**
 * Admin · Input data tab.
 *
 * Phase 3.2: Sections card added as the first card (moved from Admin Dashboard).
 * Other cards: Roster import · Schedule edits · Faculty edits · Bulk parent comms.
 */

export default function AdminInputPage() {
  return (
    <div className="container">
      <h1>Input data</h1>
      <p className="sub">Admin data-entry workflows · AY 2026-2027</p>

      <div className="ai-input-grid">

        {/* Section mapping — FIRST — moved from Admin Dashboard (Phase 3.2) */}
        <div className="ai-input-card ai-input-card-primary">
          <div className="ai-input-card-head">
            <h3>Section mapping</h3>
            <span className="ai-input-pill warn">Required before reports</span>
          </div>
          <p className="ai-input-card-body">
            Map workbook section codes to grade levels — required before reports can be sent.
          </p>
          <a href="/admin/section-mapping" className="ai-input-btn primary">Open section mapping →</a>
        </div>

        {/* Roster import */}
        <div className="ai-input-card">
          <div className="ai-input-card-head">
            <h3>Roster import</h3>
            <span className="ai-input-pill neutral">CSV / Excel</span>
          </div>
          <p className="ai-input-card-body">
            Drop a PowerSchool export or Excel sheet to sync the student roster.
            Last imported: <strong>14 May</strong>
          </p>
          <div className="ai-input-drop-zone">
            <span className="ai-input-drop-icon">📂</span>
            <span className="ai-input-drop-hint">Drag CSV / Excel here or click to browse</span>
          </div>
          <button type="button" className="ai-input-btn ghost" disabled>Upload file</button>
        </div>

        {/* Schedule edits */}
        <div className="ai-input-card">
          <div className="ai-input-card-head">
            <h3>Schedule edits</h3>
            <span className="ai-input-pill warn">8 pending changes</span>
          </div>
          <p className="ai-input-card-body">
            Review and approve timetable changes before publishing to teachers and students.
          </p>
          <a href="/admin/schedule" className="ai-input-btn ghost">Open schedule editor →</a>
        </div>

        {/* Faculty edits */}
        <div className="ai-input-card">
          <div className="ai-input-card-head">
            <h3>Faculty edits</h3>
            <span className="ai-input-pill bad">2 contracts expiring</span>
          </div>
          <p className="ai-input-card-body">
            Update teacher records, contract status, and subject assignments.
          </p>
          <a href="/admin/faculty" className="ai-input-btn ghost">Open faculty editor →</a>
        </div>

        {/* Bulk parent comms */}
        <div className="ai-input-card">
          <div className="ai-input-card-head">
            <h3>Bulk parent comms</h3>
            <span className="ai-input-pill neutral">17 templates</span>
          </div>
          <p className="ai-input-card-body">
            Select one or more sections and send a batch message to all parents via email.
          </p>
          <div className="ai-input-composer-placeholder">
            Select sections + compose message · 17 templates available
          </div>
          <button type="button" className="ai-input-btn ghost" disabled>Send batch →</button>
        </div>

      </div>
    </div>
  );
}
