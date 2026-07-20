"use client";

import { useMemo, useRef, useState } from "react";
import type { AdmissionApplicant, ParentOption } from "@manhaj/lib/queries/admissions";
import { saveApplicantAction } from "../actions/admissions";
import { STAGE_LABEL } from "./admissions-shared";

type Props = {
  /** null = add a new applicant; otherwise edit this one. */
  applicant: AdmissionApplicant | null;
  parentOptions: ParentOption[];
  onClose: () => void;
  onSaved: () => void;
};

const MAX_PARENT_RESULTS = 40;

export default function ApplicantModal({ applicant, parentOptions, onClose, onSaved }: Props) {
  const editing = applicant !== null;
  const [fullName, setFullName] = useState(applicant?.full_name ?? "");
  const [targetGrade, setTargetGrade] = useState(applicant?.target_grade ?? "");
  const [stage, setStage] = useState(applicant?.stage ?? "new");
  const [source, setSource] = useState(applicant?.source ?? "");
  const [notes, setNotes] = useState(applicant?.notes ?? "");

  // Parent select state — searchable dropdown over the real parents table,
  // with an inline "add new parent" option.
  const [parentId, setParentId] = useState<string | null>(applicant?.parent_id ?? null);
  const [parentQuery, setParentQuery] = useState("");
  const [parentOpen, setParentOpen] = useState(false);
  const [addingParent, setAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedParent = useMemo(
    () => parentOptions.find(p => p.id === parentId) ?? null,
    [parentOptions, parentId],
  );

  const filteredParents = useMemo(() => {
    const q = parentQuery.trim().toLowerCase();
    const pool = q
      ? parentOptions.filter(p =>
          p.full_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q))
      : parentOptions;
    return pool.slice(0, MAX_PARENT_RESULTS);
  }, [parentOptions, parentQuery]);

  function pickParent(p: ParentOption) {
    setParentId(p.id);
    setParentQuery("");
    setParentOpen(false);
    setAddingParent(false);
  }

  async function handleSave() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await saveApplicantAction({
      id: applicant?.id,
      full_name: fullName,
      target_grade: targetGrade,
      stage,
      source,
      notes,
      parent_id: addingParent ? null : parentId,
      new_parent: addingParent && newParentName.trim()
        ? { full_name: newParentName, email: newParentEmail, phone_e164: newParentPhone }
        : null,
    });
    setSubmitting(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="msg-modal-bg" onClick={onClose}>
      <div
        className="msg-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Edit applicant ${applicant.full_name}` : "Add applicant"}
        onClick={e => e.stopPropagation()}
      >
        <div className="msg-modal-head">
          <h3>{editing ? `Edit applicant — ${applicant.full_name}` : "Add applicant"}</h3>
          <button className="msg-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="msg-modal-body">
          <div className="msg-field">
            <span className="msg-field-label">Applicant name *</span>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Salim Al-Rawahi" />
          </div>
          <div className="adm-field-row">
            <div className="msg-field">
              <span className="msg-field-label">Target grade *</span>
              <input value={targetGrade} onChange={e => setTargetGrade(e.target.value)} placeholder="e.g. G7" />
            </div>
            <div className="msg-field">
              <span className="msg-field-label">Stage</span>
              <select value={stage} onChange={e => setStage(e.target.value)} aria-label="Pipeline stage">
                {Object.keys(STAGE_LABEL).map(k => (
                  <option key={k} value={k}>{STAGE_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="msg-field">
            <span className="msg-field-label">Source</span>
            <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Open day, sibling referral, website…" />
          </div>

          {/* Parent — searchable over the real parents table, or add new inline */}
          <div className="msg-field">
            <span className="msg-field-label">Parent</span>
            {!addingParent && selectedParent && (
              <div className="adm-parent-selected">
                <span>
                  {selectedParent.full_name}
                  {selectedParent.email ? ` · ${selectedParent.email}` : ""}
                </span>
                <button type="button" className="adm-link-btn" onClick={() => setParentId(null)}>
                  Change
                </button>
              </div>
            )}
            {!addingParent && !selectedParent && (
              <div className="adm-parent-select">
                <input
                  value={parentQuery}
                  onChange={e => { setParentQuery(e.target.value); setParentOpen(true); }}
                  onFocus={() => setParentOpen(true)}
                  onBlur={() => { blurTimer.current = setTimeout(() => setParentOpen(false), 150); }}
                  placeholder={`Search ${parentOptions.length || "existing"} parents by name or email…`}
                  role="combobox"
                  aria-expanded={parentOpen}
                  aria-controls="adm-parent-listbox"
                  aria-label="Search parents"
                />
                {parentOpen && (
                  <div id="adm-parent-listbox" role="listbox" className="adm-parent-opts" onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
                    <button
                      type="button"
                      className="adm-parent-opt adm-parent-opt-new"
                      onClick={() => { setAddingParent(true); setParentOpen(false); setNewParentName(parentQuery); }}
                    >
                      ＋ Add new parent{parentQuery.trim() ? ` “${parentQuery.trim()}”` : "…"}
                    </button>
                    {filteredParents.map(p => (
                      <button type="button" key={p.id} className="adm-parent-opt" onClick={() => pickParent(p)}>
                        <span className="adm-parent-opt-name">{p.full_name}</span>
                        <span className="adm-parent-opt-meta">{p.email ?? "no email on file"}</span>
                      </button>
                    ))}
                    {filteredParents.length === 0 && (
                      <div className="adm-parent-opt-empty">
                        {parentOptions.length === 0
                          ? "No parents loaded — you can add one above."
                          : "No matches — try a different spelling, or add a new parent."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {addingParent && (
              <div className="adm-new-parent">
                <div className="msg-field">
                  <span className="msg-field-label">New parent name *</span>
                  <input value={newParentName} onChange={e => setNewParentName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="adm-field-row">
                  <div className="msg-field">
                    <span className="msg-field-label">Email</span>
                    <input type="email" value={newParentEmail} onChange={e => setNewParentEmail(e.target.value)} placeholder="parent@example.com" />
                  </div>
                  <div className="msg-field">
                    <span className="msg-field-label">Phone</span>
                    <input value={newParentPhone} onChange={e => setNewParentPhone(e.target.value)} placeholder="+968…" />
                  </div>
                </div>
                <button type="button" className="adm-link-btn" onClick={() => setAddingParent(false)}>
                  ← Back to parent search
                </button>
              </div>
            )}
          </div>

          <div className="msg-field">
            <span className="msg-field-label">Notes</span>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything the admissions team should know…" />
          </div>
          {error && <div className="adm-error-note">{error}</div>}
        </div>
        <div className="msg-modal-foot">
          <button className="adm-action-btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="adm-action-btn primary"
            onClick={handleSave}
            disabled={submitting || !fullName.trim() || !targetGrade.trim() || (addingParent && !newParentName.trim())}
          >
            {submitting ? "Saving…" : editing ? "Save changes" : "Add applicant"}
          </button>
        </div>
      </div>
    </div>
  );
}
