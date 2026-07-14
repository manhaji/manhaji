"use client";

/**
 * Section-mapping table — Tier 1 client component.
 *
 * Ports the demo's UX (Manhaj suggestion pre-fill, per-row Confirm, progress
 * counter) but drops the "Generate SQL" modal. The Save button now calls
 * /api/sections/save-mapping which writes directly to Postgres.
 *
 * Inputs: initialSections from the server (one row per section in DB).
 * Local state: an editable copy of each row + confirmed flag.
 */

import { useMemo, useState } from "react";
import type { Section } from "@manhaj/lib/data";

type Editable = {
  code: string;
  grade_level: string;
  label: string;
  stream: string;
  capacity: string;
  notes: string;
  confirmed: boolean;
  is_mapped: boolean; // initial server-side state, so we can show "saved earlier"
};

const GRADE_OPTIONS: { v: string; l: string }[] = [
  { v: "",     l: "— pick —" },
  { v: "KG1",  l: "KG1" },
  { v: "KG2",  l: "KG2" },
  { v: "1",    l: "Grade 1" },
  { v: "2",    l: "Grade 2" },
  { v: "3",    l: "Grade 3" },
  { v: "4",    l: "Grade 4" },
  { v: "5",    l: "Grade 5" },
  { v: "6",    l: "Grade 6" },
  { v: "7",    l: "Grade 7" },
  { v: "8",    l: "Grade 8" },
  { v: "9",    l: "Grade 9" },
  { v: "10",   l: "Grade 10" },
  { v: "11",   l: "Grade 11" },
  { v: "12",   l: "Grade 12" },
  { v: "1-2",  l: "Combined 1-2" },
  { v: "3-4",  l: "Combined 3-4" },
  { v: "5-6",  l: "Combined 5-6" },
  { v: "other", l: "Other" },
];

const STREAM_OPTIONS: { v: string; l: string }[] = [
  { v: "",            l: "— pick —" },
  { v: "regular",     l: "Regular" },
  { v: "AS",          l: "AS Level (Cambridge)" },
  { v: "A2",          l: "A2 / A-Level (Cambridge)" },
  { v: "AL_combined", l: "AL — Arabic Literature track" },
  { v: "AP",          l: "AP (Advanced Placement)" },
  { v: "IB",          l: "IB (Diploma)" },
  { v: "other",       l: "Other" },
];

/**
 * Mirror of parse_section_code() in etl/parse_workbook.py — used to pre-fill
 * an editable suggestion when the row hasn't been mapped yet.
 */
function suggestFromCode(code: string): { grade_level: string; label: string; stream: string } {
  const c = code.trim();
  if (c.startsWith("KG")) {
    return { grade_level: c.slice(0, 3), label: c.slice(3), stream: "regular" };
  }
  const m = c.match(/^([0-9]+(?:-[0-9]+)?)\s*(.*)$/);
  if (!m) return { grade_level: "", label: "", stream: "" };
  const [, grade, suffix] = m;
  let stream = "regular";
  if (suffix === "AS") stream = "AS";
  else if (suffix === "A2") stream = "A2";
  else if (suffix === "AL") stream = "AL_combined";
  return { grade_level: grade, label: suffix, stream };
}

type Filter = "all" | "pending" | "confirmed";
type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; updated: number }
  | { kind: "error"; message: string };

export default function SectionMappingClient({ initialSections }: { initialSections: Section[] }) {
  const [rows, setRows] = useState<Editable[]>(() =>
    initialSections.map(s => {
      const sug = suggestFromCode(s.code);
      return {
        code: s.code,
        grade_level: s.grade_level ?? (s.is_mapped ? "" : sug.grade_level),
        label: s.label ?? (s.is_mapped ? "" : sug.label),
        stream: s.stream ?? (s.is_mapped ? "" : sug.stream),
        capacity: "",
        notes: "",
        confirmed: s.is_mapped, // pre-confirm rows that the DB already has saved
        is_mapped: s.is_mapped,
      };
    }),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const total = rows.length;
  const confirmed = useMemo(() => rows.filter(r => r.confirmed).length, [rows]);
  const pct = total ? Math.round((100 * confirmed) / total) : 0;

  const visible = rows.filter(r => {
    if (filter === "pending") return !r.confirmed;
    if (filter === "confirmed") return r.confirmed;
    return true;
  });

  function updateRow(idx: number, patch: Partial<Editable>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function toggleConfirm(idx: number) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, confirmed: !r.confirmed } : r)));
  }

  function confirmVisible() {
    const visibleCodes = new Set(visible.map(r => r.code));
    setRows(prev => prev.map(r => (visibleCodes.has(r.code) ? { ...r, confirmed: true } : r)));
  }

  function resetSuggestions() {
    if (!window.confirm("Reset all unconfirmed rows back to Manhaj suggestions? (Confirmed rows are preserved.)")) {
      return;
    }
    setRows(prev =>
      prev.map(r => {
        if (r.confirmed) return r;
        const sug = suggestFromCode(r.code);
        return { ...r, ...sug };
      }),
    );
  }

  async function handleSave() {
    const confirmedRows = rows.filter(r => r.confirmed);
    if (confirmedRows.length === 0) {
      setSave({ kind: "error", message: "No rows confirmed yet. Click “Confirm row” on at least one section first." });
      return;
    }
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/admin/api/sections/save-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: confirmedRows.map(r => ({
            code: r.code,
            grade_level: r.grade_level,
            label: r.label,
            stream: r.stream,
            capacity: r.capacity ? Number(r.capacity) : null,
            notes: r.notes,
          })),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error || `Save failed (HTTP ${res.status})`);
      }
      setSave({ kind: "ok", updated: payload.updated_count });
      // mark them as persisted in local state so the UI badge updates
      setRows(prev =>
        prev.map(r => (r.confirmed ? { ...r, is_mapped: true } : r)),
      );
    } catch (err) {
      setSave({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const reminder =
    confirmed === 0
      ? "Pre-filled with Manhaj suggestions. Edit if wrong, then confirm rows."
      : confirmed < total
        ? `${total - confirmed} section${total - confirmed === 1 ? "" : "s"} still pending`
        : "All sections confirmed — save mapping below";

  return (
    <>
      <div className="banner">
        Each school&apos;s section codes mean different things. Tell Manhaj how yours map —
        Manhaj&apos;s best guess is pre-filled, adjust where needed, then confirm and save.
      </div>

      <div className="card">
        <div className="filter-bar">
          <span className="stat">
            <b>{confirmed}</b> / <span>{total}</span> confirmed
          </span>
          <div className="progress" style={{ maxWidth: 200 }} aria-hidden="true">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <label htmlFor="filter" className="sr-only">Filter rows</label>
          <select id="filter" value={filter} onChange={e => setFilter(e.target.value as Filter)}>
            <option value="all">All sections</option>
            <option value="pending">Pending only</option>
            <option value="confirmed">Confirmed only</option>
          </select>
          <button type="button" className="btn ghost" onClick={resetSuggestions}>
            Re-suggest all from codes
          </button>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table className="map-tbl">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Code</th>
                <th style={{ width: 130 }}>Grade level</th>
                <th style={{ width: 90 }}>Label</th>
                <th style={{ width: 180 }}>Stream</th>
                <th style={{ width: 90 }}>Capacity</th>
                <th>Notes (optional)</th>
                <th style={{ width: 60, textAlign: "center" }}>Status</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const idx = rows.indexOf(r);
                return (
                  <tr key={r.code} className={r.confirmed ? "confirmed" : "pending"}>
                    <td className="code">{r.code}</td>
                    <td>
                      <label className="sr-only" htmlFor={`g-${idx}`}>Grade level for {r.code}</label>
                      <select id={`g-${idx}`} value={r.grade_level} onChange={e => updateRow(idx, { grade_level: e.target.value })}>
                        {GRADE_OPTIONS.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`l-${idx}`}>Label for {r.code}</label>
                      <input id={`l-${idx}`} type="text" maxLength={6} placeholder="A, AS, AL"
                        value={r.label} onChange={e => updateRow(idx, { label: e.target.value })} />
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`s-${idx}`}>Stream for {r.code}</label>
                      <select id={`s-${idx}`} value={r.stream} onChange={e => updateRow(idx, { stream: e.target.value })}>
                        {STREAM_OPTIONS.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`c-${idx}`}>Capacity for {r.code}</label>
                      <input id={`c-${idx}`} type="number" min={1} max={60} placeholder="—"
                        value={r.capacity} onChange={e => updateRow(idx, { capacity: e.target.value })} />
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`n-${idx}`}>Notes for {r.code}</label>
                      <input id={`n-${idx}`} type="text" placeholder="(optional)"
                        value={r.notes} onChange={e => updateRow(idx, { notes: e.target.value })} />
                    </td>
                    <td className={`status ${r.confirmed ? "confirmed" : "pending"}`}>
                      {r.confirmed ? "✓" : "⊙"}
                    </td>
                    <td>
                      <button type="button"
                        className={`row-confirm ${r.confirmed ? "confirmed" : ""}`}
                        onClick={() => toggleConfirm(idx)}>
                        {r.confirmed ? "Confirmed" : "Confirm row"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="toolbar">
          <button type="button" className="btn ghost" onClick={confirmVisible}>
            Confirm all visible
          </button>
          <button type="button" className="btn primary"
            onClick={handleSave}
            disabled={save.kind === "saving"}
            aria-busy={save.kind === "saving"}>
            {save.kind === "saving" ? "Saving…" : "Save mapping"}
          </button>
          <span className="progress-text" style={{ marginLeft: "auto" }}>{reminder}</span>
        </div>

        <div role="status" aria-live="polite" style={{ marginTop: 12 }}>
          {save.kind === "ok" && (
            <div className="banner" style={{ background: "#F0FFF4", borderColor: "#9AE6B4", color: "#22543D" }}>
              <b>Saved.</b> {save.updated} section{save.updated === 1 ? "" : "s"} updated.
              Reports, scheduling and parent forms can use these sections now.
            </div>
          )}
          {save.kind === "error" && (
            <div className="banner" role="alert" style={{ background: "#FED7D7", borderColor: "#FC8181", color: "#742A2A" }}>
              <b>Couldn&apos;t save.</b> {save.message}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
