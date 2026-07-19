"use client";

import { useState, useTransition } from "react";
import type { ParentChild } from "@manhaj/lib/queries/parents";
import type { ActivitySlip, StudentHealthInfo, ParentContactInfo } from "@manhaj/lib/queries/permissionslip";
import { saveDraftAction, signAndSubmitAction, declineSlipAction } from "./actions";

type ChildSlipEntry = {
  child: ParentChild;
  slips: ActivitySlip[];
  health: StudentHealthInfo | null;
  parentContact: ParentContactInfo | null;
};

interface Props {
  kids: ParentChild[];
  childSlipData: ChildSlipEntry[];
  isMock: boolean;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SLIP: ActivitySlip = {
  activityId: "mock-act-1",
  slipId: null,
  status: "not_started",
  slipNotes: null,
  signedAt: null,
  signedName: null,
  title: "Bait Al Zubair Museum, Muscat",
  location: "Muscat, Oman",
  activityDate: "2026-06-03",
  departTime: "08:30",
  returnTime: "13:30",
  transport: "School bus",
  costAed: 35,
  supervisorRatio: "1 staff per 8 students",
  curriculumLink: "History - G5 · Oman heritage unit",
  riskPdfPath: null,
  description: "Bring own lunch. No nuts allowed.",
  deadline: "2026-06-02",
};

const MOCK_HEALTH: StudentHealthInfo = {
  allergies: null,
  conditions: null,
  medications: null,
  emergencyContactName: "Ahmed Al-Habsi",
  emergencyContactPhone: "+968 9876 5432",
  emergencyContactRel: "Father",
};

const MOCK_PARENT: ParentContactInfo = {
  name: "Ahmed Al-Habsi",
  phone: "+968 9876 5432",
  relationship: "Father",
};

const MOCK_CHILD: ParentChild = {
  student_id: "mock-s1",
  full_name_en: "Layla Al-Habsi",
  initial: "L",
  section_id: "mock-sec",
  section_code: "10A",
  grade_level: "Grade 10",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function fmtTime(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00Z");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TripInfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ps-trip-cell">
      <div className="ps-trip-cell-label">{label}</div>
      <div className="ps-trip-cell-value">{value}</div>
      {sub && <div className="ps-trip-cell-sub">{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PermissionSlipClient({ kids, childSlipData, isMock }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentSlipId, setCurrentSlipId] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [signed, setSigned] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeEntry = isMock
    ? { child: MOCK_CHILD, slips: [MOCK_SLIP], health: MOCK_HEALTH, parentContact: MOCK_PARENT }
    : (childSlipData[selectedIdx] ?? null);

  const activeChild = activeEntry?.child ?? MOCK_CHILD;
  const health = activeEntry?.health ?? null;
  const parentContact = activeEntry?.parentContact ?? null;

  // Find first pending slip
  const pendingSlip = activeEntry?.slips.find(s => s.status === "not_started" || s.status === "draft") ?? null;
  const activeSlip = isMock ? MOCK_SLIP : pendingSlip;

  // Pre-fill form from existing draft notes
  function parseDraftNotes(notesJson: string | null) {
    if (!notesJson) return null;
    try { return JSON.parse(notesJson); } catch { return null; }
  }
  const draftNotes = parseDraftNotes(activeSlip?.slipNotes ?? null);

  const [attendance, setAttendance] = useState<"attend" | "stay_school" | "stay_home">(
    draftNotes?.attendance ?? "attend"
  );
  const [healthChange, setHealthChange] = useState<boolean>(draftNotes?.healthChange ?? false);
  const [healthExtra, setHealthExtra] = useState<string>(draftNotes?.healthExtra ?? "");
  const [emergencyName, setEmergencyName] = useState<string>(
    draftNotes?.emergencyName ?? health?.emergencyContactName ?? parentContact?.name ?? ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState<string>(
    draftNotes?.emergencyPhone ?? health?.emergencyContactPhone ?? parentContact?.phone ?? ""
  );
  const [emergencyRel, setEmergencyRel] = useState<string>(
    draftNotes?.emergencyRel ?? health?.emergencyContactRel ?? parentContact?.relationship ?? "Father"
  );
  const [emergencyBackup, setEmergencyBackup] = useState<string>(draftNotes?.emergencyBackup ?? "");

  function getNotesData() {
    return { attendance, healthChange, healthExtra, emergencyName, emergencyPhone, emergencyRel, emergencyBackup };
  }

  function handleSaveDraft() {
    if (!activeSlip || isMock) { setLastSaved(new Date()); return; }
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await saveDraftAction(
          activeSlip.activityId,
          activeChild.student_id,
          currentSlipId ?? activeSlip.slipId,
          getNotesData(),
        );
        setCurrentSlipId(result.slipId);
        setLastSaved(new Date());
      } catch (e) {
        console.error(e);
        setActionError("Couldn't save your draft — please try again.");
      }
    });
  }

  function handleSignAndSubmit() {
    if (!activeSlip || isMock) { setSigned(true); return; }
    setActionError(null);
    startTransition(async () => {
      try {
        await signAndSubmitAction(
          activeSlip.activityId,
          activeChild.student_id,
          currentSlipId ?? activeSlip.slipId,
          getNotesData(),
          parentContact?.name ?? emergencyName,
        );
        setSigned(true);
      } catch (e) {
        console.error(e);
        setActionError("Couldn't submit the form — please try again.");
      }
    });
  }

  function handleDecline() {
    if (!activeSlip || isMock) { setShowDeclineConfirm(false); setSigned(true); return; }
    setActionError(null);
    startTransition(async () => {
      try {
        await declineSlipAction(
          activeSlip.activityId,
          activeChild.student_id,
          currentSlipId ?? activeSlip.slipId,
        );
        setShowDeclineConfirm(false);
        setSigned(true);
      } catch (e) {
        console.error(e);
        setShowDeclineConfirm(false);
        setActionError("Couldn't record your decline — please try again.");
      }
    });
  }

  // ── No pending slips ──────────────────────────────────────────────────────
  if (!isMock && !signed && (!activeEntry || activeEntry.slips.filter(s => s.status === "not_started" || s.status === "draft").length === 0)) {
    const signedSlips = activeEntry?.slips.filter(s => s.status === "signed") ?? [];
    return (
      <div className="ps-root">
        <div className="ps-breadcrumb">
          <span>Home</span><span className="ps-bc-sep">›</span><span>Forms</span>
        </div>
        <div className="ps-empty">
          <div className="ps-empty-icon">✅</div>
          <div className="ps-empty-title">
            {signedSlips.length > 0 ? "All forms signed" : "No pending permission slips"}
          </div>
          <div className="ps-empty-sub">
            {signedSlips.length > 0
              ? `You've signed ${signedSlips.length} form${signedSlips.length > 1 ? "s" : ""} for ${activeChild.full_name_en.split(" ")[0]}.`
              : `Nothing needs your signature right now for ${activeChild.full_name_en.split(" ")[0]}.`}
          </div>
        </div>
      </div>
    );
  }

  // ── Signed/declined success ───────────────────────────────────────────────
  if (signed) {
    return (
      <div className="ps-root">
        <div className="ps-breadcrumb">
          <span>Home</span><span className="ps-bc-sep">›</span>
          <span>Forms</span><span className="ps-bc-sep">›</span>
          <span>Field-trip consent</span>
        </div>
        <div className="ps-empty">
          <div className="ps-empty-icon">✅</div>
          <div className="ps-empty-title">Form submitted</div>
          <div className="ps-empty-sub">We&apos;ve sent a copy to the school and locked it to {activeChild.full_name_en.split(" ")[0]}&apos;s record.</div>
        </div>
      </div>
    );
  }

  const slip = activeSlip!;
  const deadlineDays = slip.deadline ? daysUntil(slip.deadline) : null;
  const hasHealthConcern = health && (health.allergies || health.conditions || health.medications);

  return (
    <div className="ps-root">
      {/* ── Breadcrumb + child selector ── */}
      <div className="ps-topbar">
        <div className="ps-breadcrumb">
          <span>Home</span><span className="ps-bc-sep">›</span>
          <span>Forms</span><span className="ps-bc-sep">›</span>
          <span className="ps-bc-active">Field-trip consent</span>
        </div>
        {kids.length > 1 && (
          <div className="ps-child-selector">
            {kids.map((c, i) => (
              <button
                key={c.student_id}
                className={`ps-child-tab${i === selectedIdx ? " active" : ""}`}
                onClick={() => setSelectedIdx(i)}
              >
                <span className="ps-child-initial">{c.initial}</span>
                {c.full_name_en.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        {kids.length <= 1 && (
          <div className="ps-child-pill">
            <span className="ps-child-initial">{activeChild.initial}</span>
            <span>{activeChild.full_name_en}</span>
            <span className="ps-child-grade">· {activeChild.grade_level ?? activeChild.section_code}</span>
          </div>
        )}
      </div>

      <h1 className="ps-title">Field-trip consent</h1>
      <p className="ps-subtitle">Sign once. We&apos;ll share a copy with you and the school, and lock it to {activeChild.full_name_en.split(" ")[0]}&apos;s record.</p>

      {/* ── Deadline banner ── */}
      {slip.deadline && deadlineDays !== null && deadlineDays >= 0 && (
        <div className={`ps-banner${deadlineDays <= 2 ? " ps-banner--urgent" : ""}`}>
          <span className="ps-banner-icon">{deadlineDays <= 2 ? "⚠" : "ℹ"}</span>
          <span className="ps-banner-text">
            This needs your signature by {fmtDateShort(slip.deadline)} — the trip is on {fmtDateShort(slip.activityDate)}.
          </span>
          <span className="ps-banner-due">
            Due in {deadlineDays} day{deadlineDays !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Trip card ── */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left">
            <div className="ps-card-header-sublabel">TRIP</div>
            <div className="ps-card-header-title">{slip.title}</div>
          </div>
          <div className="ps-card-header-right">
            <div className="ps-card-header-sublabel">WHEN</div>
            <div className="ps-card-header-date">{fmtDate(slip.activityDate)}</div>
          </div>
        </div>
        <div className="ps-trip-grid ps-trip-grid--4">
          <TripInfoRow label="DEPART" value={fmtTime(slip.departTime)} sub="From school gate" />
          <TripInfoRow label="RETURN" value={fmtTime(slip.returnTime)} sub="Back at school" />
          <TripInfoRow label="TRANSPORT" value={slip.transport ?? "TBC"} sub="Supervised" />
          <TripInfoRow label="COST" value={slip.costAed > 0 ? `AED ${slip.costAed}` : "Free"} sub="Included in term fee" />
        </div>
        <div className="ps-trip-grid ps-trip-grid--4">
          <TripInfoRow
            label="SUPERVISORS"
            value={slip.supervisorRatio ? `${slip.supervisorRatio.split(" ")[0]} supervisors` : "TBC"}
            sub={slip.supervisorRatio ?? undefined}
          />
          <TripInfoRow
            label="LUNCH"
            value="Bring own"
            sub={slip.description ?? "No nuts allowed"}
          />
          <TripInfoRow
            label="CURRICULUM LINK"
            value={slip.curriculumLink ?? "—"}
          />
          <div className="ps-trip-cell">
            <div className="ps-trip-cell-label">RISK-ASSESSMENT</div>
            {slip.riskPdfPath ? (
              <a href={slip.riskPdfPath} className="ps-trip-pdf-link" target="_blank" rel="noreferrer">View PDF</a>
            ) : (
              <div className="ps-trip-cell-value">Reviewed by H&S officer</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Child attending ── */}
      <div className="ps-section">
        <div className="ps-section-title">Child attending</div>
        <div className="ps-child-card">
          <div className="ps-child-avatar">{activeChild.initial}</div>
          <div>
            <div className="ps-child-name">{activeChild.full_name_en}</div>
            <div className="ps-child-meta">
              {activeChild.grade_level ?? activeChild.section_code}
            </div>
          </div>
        </div>
        <div className="ps-question">Will {activeChild.full_name_en.split(" ")[0]} attend this trip? *</div>
        <div className="ps-radio-group">
          {(["attend", "stay_school", "stay_home"] as const).map(opt => (
            <button
              key={opt}
              className={`ps-radio-btn${attendance === opt ? " active" : ""}`}
              onClick={() => setAttendance(opt)}
              type="button"
            >
              {attendance === opt && <span className="ps-radio-check">✓</span>}
              {opt === "attend" ? "Yes, she'll attend" : opt === "stay_school" ? "No, she'll stay at school" : "No, she'll stay home"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Health & medical ── */}
      <div className="ps-section">
        <div className="ps-section-title">Health &amp; medical</div>
        <p className="ps-section-desc">
          We use these answers only for this trip. They don&apos;t replace {activeChild.full_name_en.split(" ")[0]}&apos;s full medical record on file.
        </p>
        {hasHealthConcern && (
          <div className="ps-health-existing">
            <span className="ps-health-icon">📋</span>
            On file: {[health!.allergies, health!.conditions, health!.medications].filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="ps-question">Are there any new allergies, conditions, or medications we should know about for this trip? *</div>
        <div className="ps-radio-group">
          <button
            className={`ps-radio-btn${!healthChange ? " active" : ""}`}
            onClick={() => setHealthChange(false)}
            type="button"
          >
            {!healthChange && <span className="ps-radio-check">✓</span>}
            No changes from her file
          </button>
          <button
            className={`ps-radio-btn${healthChange ? " active" : ""}`}
            onClick={() => setHealthChange(true)}
            type="button"
          >
            {healthChange && <span className="ps-radio-check">✓</span>}
            Yes — describe below
          </button>
        </div>
        <div className="ps-field">
          <label className="ps-field-label">Anything else the supervisors should know (optional)</label>
          <textarea
            className="ps-textarea"
            placeholder="E.g. Layla gets motion sickness on long bus rides — she should sit at the front."
            value={healthExtra}
            onChange={e => setHealthExtra(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* ── Emergency contact ── */}
      <div className="ps-section">
        <div className="ps-section-title">Emergency contact for the day</div>
        <p className="ps-section-desc">Pre-filled from your profile. Edit only if a different person is reachable on the trip day.</p>
        <div className="ps-field-row">
          <div className="ps-field">
            <label className="ps-field-label">Contact name *</label>
            <input
              className="ps-input"
              value={emergencyName}
              onChange={e => setEmergencyName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="ps-field">
            <label className="ps-field-label">Relationship *</label>
            <select
              className="ps-select"
              value={emergencyRel}
              onChange={e => setEmergencyRel(e.target.value)}
            >
              {["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Other"].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="ps-field-row">
          <div className="ps-field">
            <label className="ps-field-label">Phone number *</label>
            <input
              className="ps-input"
              value={emergencyPhone}
              onChange={e => setEmergencyPhone(e.target.value)}
              placeholder="+968 XXXX XXXX"
              type="tel"
            />
          </div>
          <div className="ps-field">
            <label className="ps-field-label">Backup phone (optional)</label>
            <input
              className="ps-input"
              value={emergencyBackup}
              onChange={e => setEmergencyBackup(e.target.value)}
              placeholder="+968 XXXX XXXX"
              type="tel"
            />
          </div>
        </div>
      </div>

      {/* ── Decline confirm modal ── */}
      {showDeclineConfirm && (
        <div className="ps-modal-overlay">
          <div className="ps-modal">
            <div className="ps-modal-title">Decline this trip?</div>
            <p className="ps-modal-body">
              {activeChild.full_name_en.split(" ")[0]} won&apos;t participate. You can contact the school if you change your mind.
            </p>
            <div className="ps-modal-actions">
              <button className="ps-modal-btn ps-modal-btn--ghost" onClick={() => setShowDeclineConfirm(false)}>
                Cancel
              </button>
              <button className="ps-modal-btn ps-modal-btn--danger" onClick={handleDecline} disabled={isPending}>
                {isPending ? "Submitting…" : "Yes, decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer bar ── */}
      {actionError && (
        <div className="ps-action-error" role="alert">⚠ {actionError}</div>
      )}
      <div className="ps-footer">
        <div className="ps-footer-meta">
          {lastSaved
            ? `Last saved just now · auto-save on`
            : slip.status === "draft" ? "Draft saved · auto-save on" : "Not yet saved"}
        </div>
        <div className="ps-footer-actions">
          <button
            className="ps-footer-btn ps-footer-btn--ghost"
            onClick={() => setShowDeclineConfirm(true)}
            disabled={isPending}
            type="button"
          >
            Decline
          </button>
          <button
            className="ps-footer-btn ps-footer-btn--outline"
            onClick={handleSaveDraft}
            disabled={isPending}
            type="button"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            className="ps-footer-btn ps-footer-btn--primary"
            onClick={handleSignAndSubmit}
            disabled={isPending}
            type="button"
          >
            {isPending ? "Submitting…" : "Sign and submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
