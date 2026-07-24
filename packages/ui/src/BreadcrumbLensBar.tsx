"use client";

/**
 * Breadcrumb + lens-toggle bar used at the top of every Phase 2 admin tab.
 *
 * The breadcrumb is a static visual chain (steps[].active marks the current
 * step). The lens toggle is interactive — a set of pills the caller chooses
 * via `lenses` (defaults to all three). Any lens listed in `comingSoon` is
 * rendered as an inert pill with a "Soon" ribbon: it does not call
 * onLensChange and cannot become the active view.
 */

export type BreadcrumbStep = { label: string; href?: string; active?: boolean };
export type Lens = "principal" | "advisor" | "teacher";

const LENS_LABELS: Record<Lens, string> = {
  principal: "Principal",
  advisor:   "Student Advisor",
  teacher:   "Teacher",
};

const DEFAULT_LENSES: Lens[] = ["principal", "advisor", "teacher"];

export default function BreadcrumbLensBar({
  steps, lens, onLensChange, lenses = DEFAULT_LENSES, comingSoon = [],
}: {
  steps:        BreadcrumbStep[];
  lens:         Lens;
  onLensChange: (next: Lens) => void;
  /** Which lens pills to render, in order. Defaults to all three. */
  lenses?:      Lens[];
  /** Lenses shown but inert, carrying a "Soon" ribbon. */
  comingSoon?:  Lens[];
}) {
  const soon = new Set(comingSoon);
  return (
    <>
      <nav aria-label="Breadcrumb" className="bclens-crumb">
        {steps.map((step, i) => (
          <span key={`${i}-${step.label}`} className="bclens-crumb-row">
            {i > 0 && <span className="bclens-crumb-arrow" aria-hidden="true">▸</span>}
            <span className={`bclens-step ${step.active ? "active" : ""}`}>{step.label}</span>
          </span>
        ))}
      </nav>
      <div role="tablist" aria-label="Switch lens" className="bclens-lens">
        {lenses.map(l => {
          const isSoon = soon.has(l);
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={!isSoon && l === lens}
              aria-disabled={isSoon || undefined}
              disabled={isSoon}
              title={isSoon ? `${LENS_LABELS[l]} — coming soon` : undefined}
              onClick={() => { if (!isSoon) onLensChange(l); }}
              className={`bclens-lens-pill ${!isSoon && l === lens ? "active" : ""} ${isSoon ? "soon" : ""}`}
            >
              {LENS_LABELS[l]}
              {isSoon && <span className="bclens-lens-ribbon">Soon</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
