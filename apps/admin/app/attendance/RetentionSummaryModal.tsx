"use client";

import { useEffect, useState } from "react";
import type { RetentionSummary } from "@manhaj/lib/queries/admissions";
import { fetchRetentionSummaryAction } from "../actions/admissions";
import { LEAVER_REASON_LABEL, RISK_COLOR } from "./admissions-shared";

export type SummaryTarget = {
  studentId: string;
  name: string;
  /** Pre-built summary for demo rows (no live student behind them). */
  demoSummary?: RetentionSummary;
};

type Props = {
  target: SummaryTarget;
  onClose: () => void;
};

export default function RetentionSummaryModal({ target, onClose }: Props) {
  const [summary, setSummary] = useState<RetentionSummary | null>(target.demoSummary ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!target.demoSummary);

  useEffect(() => {
    if (target.demoSummary) return;
    let cancelled = false;
    fetchRetentionSummaryAction(target.studentId).then(res => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setSummary(res.summary);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [target]);

  function handleDownload() {
    document.body.classList.add("adm-printing");
    const cleanup = () => {
      document.body.classList.remove("adm-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Fallback for browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 1000);
  }

  const s = summary;
  return (
    <div className="msg-modal-bg" onClick={onClose}>
      <div
        className="msg-modal adm-print-area"
        role="dialog"
        aria-modal="true"
        aria-label={`Retention summary for ${target.name}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="msg-modal-head">
          <h3>Retention summary — {target.name}</h3>
          <button className="msg-modal-close adm-no-print" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="msg-modal-body">
          {target.demoSummary && (
            <div className="adm-demo-note">Demo family — sample data shown until this family is in the live roster.</div>
          )}
          {loading && <div className="adm-modal-status">Loading family data…</div>}
          {error && <div className="adm-error-note">Could not load the summary: {error}</div>}
          {s && (
            <>
              <div className="adm-summary-grid">
                <div className="adm-summary-item">
                  <div className="adm-summary-label">Student</div>
                  <div className="adm-summary-val">
                    {s.student.name}
                    {s.student.grade_level ? ` · ${s.student.grade_level}` : ""}
                    {s.student.section_code ? ` (${s.student.section_code})` : ""}
                  </div>
                </div>
                <div className="adm-summary-item">
                  <div className="adm-summary-label">Primary contact</div>
                  <div className="adm-summary-val">
                    {s.parent
                      ? <>{s.parent.full_name}{s.parent.email ? ` · ${s.parent.email}` : " · no email on file"}</>
                      : "No parent linked on file"}
                  </div>
                </div>
                <div className="adm-summary-item">
                  <div className="adm-summary-label">Re-enrolment status</div>
                  <div className="adm-summary-val">
                    {s.student.final_enrollment_date
                      ? `Confirmed leaving (${LEAVER_REASON_LABEL[s.student.leaver_reason ?? ""] ?? s.student.leaver_reason ?? "no reason recorded"}) · last day ${s.student.final_enrollment_date}`
                      : s.student.re_enrolled_on
                        ? `Re-enrolled on ${s.student.re_enrolled_on}`
                        : "Pending — no decision recorded"}
                  </div>
                </div>
                <div className="adm-summary-item">
                  <div className="adm-summary-label">Attendance · last 90 days</div>
                  <div className="adm-summary-val">
                    {s.attendance
                      ? `${s.attendance.pct}% present · ${s.attendance.absences} absences · ${s.attendance.lates} lates (${s.attendance.marks} marks)`
                      : "No attendance records in this period"}
                  </div>
                </div>
                <div className="adm-summary-item">
                  <div className="adm-summary-label">Fee status</div>
                  <div className="adm-summary-val">
                    {s.fees === null
                      ? "Not available"
                      : s.fees.invoices === 0
                        ? "No invoices on file"
                        : s.fees.unpaid === 0
                          ? `All ${s.fees.invoices} invoices settled`
                          : `${s.fees.unpaid} open invoice${s.fees.unpaid === 1 ? "" : "s"} (${s.fees.overdue} overdue) · AED ${s.fees.owedAed.toLocaleString()} outstanding`}
                  </div>
                </div>
              </div>
              <div className="adm-summary-item">
                <div className="adm-summary-label">Open risk flags</div>
                {s.riskFlags.length === 0 && <div className="adm-summary-val">None</div>}
                {s.riskFlags.map((f, i) => (
                  <div key={i} className="adm-flag-row">
                    <span className="adm-risk-chip" style={{ color: RISK_COLOR[f.severity] ?? "#4A5568", background: (RISK_COLOR[f.severity] ?? "#4A5568") + "18" }}>
                      {f.severity.toUpperCase()} · {f.category.toUpperCase()}
                    </span>
                    <span className="adm-flag-reason">{f.reason}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="msg-modal-foot adm-no-print">
          <button className="adm-action-btn" onClick={onClose}>Close</button>
          <button className="adm-action-btn primary" onClick={handleDownload} disabled={!s}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
