/**
 * Shared constants + helpers for the admissions screen (client-safe).
 */

import type { AdmissionApplicant } from "@manhaj/lib/queries/admissions";

export const STAGE_LABEL: Record<string, string> = {
  new: "INQUIRY",
  review: "TOUR BOOKED",
  interview: "ASSESSMENT",
  offer: "OFFER SENT",
  accepted: "ENROLLED",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
};

export const STAGE_COLOR: Record<string, string> = {
  new: "adm-chip-blue",
  review: "adm-chip-blue",
  interview: "adm-chip-yellow",
  offer: "adm-chip-green",
  accepted: "adm-chip-green",
  rejected: "adm-chip-red",
  withdrawn: "adm-chip-grey",
};

/** The 5 funnel stages shown as bars (rejected/withdrawn stay table-only). */
export const PIPELINE_STAGES = ["new", "review", "interview", "offer", "accepted"] as const;

export const LEAVER_REASONS = [
  { value: "graduating", label: "Graduating" },
  { value: "relocating", label: "Relocating" },
  { value: "fees", label: "Fees" },
  { value: "dissatisfaction", label: "Dissatisfaction" },
  { value: "other", label: "Other" },
] as const;

export const LEAVER_REASON_LABEL: Record<string, string> = Object.fromEntries(
  LEAVER_REASONS.map(r => [r.value, r.label]),
);

export const AVATAR_BG = ["#3D5A80", "#C05621", "#2F855A", "#C53030", "#975A16", "#2C5282", "#6B46C1", "#B7791F"];

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

export function daysInStage(created_at: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(created_at).getTime()) / 86400000));
}

export const RISK_COLOR: Record<string, string> = {
  high: "#C53030",
  medium: "#C05621",
  low: "#975A16",
};

export function riskScore(flags: Array<{ severity: string }>): number {
  return flags.reduce((max, f) => {
    const s = f.severity === "high" ? 3 : f.severity === "medium" ? 2 : 1;
    return Math.max(max, s);
  }, 0);
}

/** Mock applicants — demo fallback while the applicants table is empty. */
export const MOCK_APPLICANTS: AdmissionApplicant[] = [
  { id: "demo-a1", full_name: "Reem Al-Halabi",    email: null, phone_e164: null, target_grade: "G11", stage: "accepted",  source: "Sibling referral",   notes: null, created_at: "2026-01-01", parent_id: null, parent_name: "Khalid Al-Halabi",  parent_email: null },
  { id: "demo-a2", full_name: "Laena Al-Sharif",   email: null, phone_e164: null, target_grade: "G7",  stage: "review",    source: "Open day",           notes: null, created_at: "2026-01-15", parent_id: null, parent_name: "Mona Al-Sharif",    parent_email: null },
  { id: "demo-a3", full_name: "Mohammed Al-Said",  email: null, phone_e164: null, target_grade: "G3",  stage: "interview", source: "Word of mouth",      notes: null, created_at: "2026-02-01", parent_id: null, parent_name: "Salim Al-Said",     parent_email: null },
  { id: "demo-a4", full_name: "Aisha Al-Balushi",  email: null, phone_e164: null, target_grade: "G5",  stage: "review",    source: "Website",            notes: null, created_at: "2026-02-10", parent_id: null, parent_name: "Huda Al-Balushi",   parent_email: null },
  { id: "demo-a5", full_name: "Yousef Al-Khalili", email: null, phone_e164: null, target_grade: "G9",  stage: "new",       source: "Parent of G8K",      notes: null, created_at: "2026-03-01", parent_id: null, parent_name: "Nasser Al-Khalili", parent_email: null },
  { id: "demo-a6", full_name: "Sama Al-Harthi",    email: null, phone_e164: null, target_grade: "G2",  stage: "offer",     source: "Google search",      notes: null, created_at: "2026-03-15", parent_id: null, parent_name: "Amal Al-Harthi",    parent_email: null },
  { id: "demo-a7", full_name: "Hassan Al-Amri",    email: null, phone_e164: null, target_grade: "G5",  stage: "review",    source: "Paid · Facebook ad", notes: null, created_at: "2026-04-01", parent_id: null, parent_name: "Said Al-Amri",      parent_email: null },
  { id: "demo-a8", full_name: "Faisal Al-Ansi",    email: null, phone_e164: null, target_grade: "G10", stage: "new",       source: "Walk in",            notes: null, created_at: "2026-04-10", parent_id: null, parent_name: "Layla Al-Ansi",     parent_email: null },
];

export function isDemoApplicant(a: AdmissionApplicant): boolean {
  return a.id.startsWith("demo-");
}

/** Build the mailto: draft for a retention call. */
export function retentionCallMailto(parentName: string, parentEmail: string, studentName: string): string {
  const subject = `Re-enrolment for ${studentName} — 2026/27`;
  const body =
    `Dear ${parentName},\n\n` +
    `As we plan for the 2026/27 academic year, we would love to schedule a short call ` +
    `about ${studentName}'s re-enrolment.\n\n` +
    `Would any of the following times work for you this week?\n\n` +
    `- [option 1]\n- [option 2]\n\n` +
    `Warm regards,\nAdmissions Office\nInternational School of Oman`;
  return `mailto:${encodeURIComponent(parentEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
