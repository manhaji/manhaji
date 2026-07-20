"use client";

import { useState } from "react";
import { confirmNoReEnrollmentAction } from "../actions/admissions";
import { LEAVER_REASONS } from "./admissions-shared";

export type ConfirmLeaveTarget = {
  studentId: string;
  name: string;
  gradeLabel: string | null;
  /** Demo rows can open the pop-up but cannot write. */
  demo?: boolean;
};

type Props = {
  target: ConfirmLeaveTarget;
  onClose: () => void;
  onConfirmed: (studentId: string, reason: string, comment: string) => void;
};

export default function ConfirmLeaveModal({ target, onClose, onConfirmed }: Props) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!reason || submitting || target.demo) return;
    setSubmitting(true);
    setError(null);
    const res = await confirmNoReEnrollmentAction(target.studentId, reason, comment);
    setSubmitting(false);
    if (res.ok) {
      onConfirmed(target.studentId, reason, comment);
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
        aria-label={`Confirm no re-enrolment for ${target.name}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="msg-modal-head">
          <h3>Confirm no re-enrolment</h3>
          <button className="msg-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="msg-modal-body">
          <p className="adm-confirm-warning">
            This records <strong>{target.name}</strong>{target.gradeLabel ? ` (${target.gradeLabel})` : ""} as{" "}
            <strong>not re-enrolling</strong> for 2026/27. Their final enrollment date will be set to the last
            day of the current academic year. This is written to the school record.
          </p>
          {target.demo && (
            <div className="adm-demo-note">Demo family — decisions can only be recorded for live students.</div>
          )}
          <div className="msg-field">
            <span className="msg-field-label">Reason *</span>
            <select value={reason} onChange={e => setReason(e.target.value)} aria-label="Leaver reason">
              <option value="">Choose a reason…</option>
              {LEAVER_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="msg-field">
            <span className="msg-field-label">Comment (optional)</span>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Anything worth remembering for next year's planning — destination school, family feedback…"
            />
          </div>
          {error && <div className="adm-error-note">{error}</div>}
        </div>
        <div className="msg-modal-foot">
          <button className="adm-action-btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="adm-danger-btn"
            onClick={handleConfirm}
            disabled={!reason || submitting || !!target.demo}
            title={target.demo ? "Demo family — no live student record to update" : undefined}
          >
            {submitting ? "Recording…" : "Yes — confirm no re-enrolment"}
          </button>
        </div>
      </div>
    </div>
  );
}
