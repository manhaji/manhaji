#!/usr/bin/env python3
"""Render the Phase C side-by-side dashboard: school Ver 19 vs Manhaj rebuild.

Self-contained HTML (no server, no dependencies), reusing the visual style of
demo/mockups/timetable_dashboard.html: a class picker and a teacher picker,
each showing a Sun-Thu week grid — plus a [School Ver 19 | Manhaj rebuild]
toggle that switches the data source, and the benchmark metrics table.

v2 data is keyed by human-readable names directly (no UUID indirection).

Usage:
    cd /Users/eliasmouawad/dev/manhaj-phase-c && PYTHONPATH=. \
        /Users/eliasmouawad/dev/manhaj/.venv/bin/python \
        solver/timetable/render_benchmark_dashboard.py
Writes: demo/mockups/tt2526_rebuild_dashboard.html
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

TEMPLATE = """<!doctype html>
<meta charset="utf-8">
<title>Manhaj — ISO 25-26 rebuild benchmark (solver v%%VERSION%%)</title>
<style>
 body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
 h1 { font-size: 20px; font-weight: 600; }
 h2 { font-size: 16px; font-weight: 600; margin-top: 28px; }
 select { font-size: 14px; padding: 6px 10px; margin: 0 12px 16px 0; }
 table { border-collapse: collapse; width: 100%; max-width: 980px; }
 th, td { border: 1px solid #d8d5cc; padding: 6px 8px; font-size: 12.5px;
          vertical-align: top; min-width: 120px; height: 44px; }
 th { background: #f1efe8; font-weight: 600; }
 .lesson { background: #e1f5ee; border-radius: 4px; padding: 3px 6px; margin: 2px 0;
           display: block; }
 .lesson.locked { background: #f1e8d8; }
 .lesson small { color: #555; }
 .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
 .toggle { display: inline-flex; border: 1px solid #b9b4a7; border-radius: 6px;
           overflow: hidden; margin: 0 0 16px 0; vertical-align: middle; }
 .toggle button { border: 0; background: #fff; padding: 7px 14px; font-size: 14px;
                  cursor: pointer; }
 .toggle button.on { background: #1b7a5e; color: #fff; font-weight: 600; }
 #metrics td, #metrics th { height: auto; min-width: 90px; }
 #metrics td.num { text-align: right; font-variant-numeric: tabular-nums; }
 .good { color: #1b7a5e; font-weight: 600; }
 .legend { color: #666; font-size: 12.5px; margin: 6px 0 0 0; }
</style>
<h1>ISO 25-26 timetable — school Ver 19 vs Manhaj rebuild</h1>
<p class="meta">rebuild status: %%STATUS%% · solve wall time %%WALL%%s ·
 %%MOVABLE%% lessons re-optimized, %%LOCKED%% locked at source ·
 generated %%WHEN%%</p>

<h2>Benchmark — same checker, both timetables</h2>
<div id="metrics"></div>

<h2>Week grids</h2>
<span class="toggle" id="src">
  <button data-src="school" class="on">School Ver 19</button>
  <button data-src="manhaj">Manhaj rebuild</button>
  <button data-src="coverage">Manhaj coverage-optimized</button>
</span>
<label>Class: <select id="sec"></select></label>
<label>Teacher: <select id="tch"></select></label>
<div id="grid"></div>
<p class="legend">Beige lessons are locked at the school's original placement
 (exams, library, break-time sessions, combined multi-class lessons); green
 lessons were placed by the solver (Manhaj view) or are the school's own
 placement (Ver 19 view).</p>
<script>
const DATASETS = { school: %%SCHOOL%%, manhaj: %%MANHAJ%%, coverage: %%COVERAGE%% };
const METRICS = %%METRICS%%;
const SUBSTITUTION_METRICS = %%SUBSTITUTION_METRICS%%;
const DAYS = %%DAYS%%, SLOTS = %%SLOTS%%;
let src = 'school', filterKey = null, filterVal = null;

const METRIC_ROWS = [
  ['Lessons in the week', 'lesson_records', false],
  ['Taught slots in the week', 'placed_slots', false],
  ['Teacher double-bookings (must be 0)', 'teacher_clashes', true],
  ['Classes shown two arbitrary lessons at once (must be 0)', 'illegal_section_overlaps', true],
  ['Subject over the per-day limit (must be 0)', 'per_day_cap_violations', true],
  ['Same subject twice+ in one day, week-wide', 'same_day_doublings_per_week', true],
  ['Teacher workload evenness (avg day gap, lower = steadier)', 'teacher_daily_balance_avg', true],
  ['Teacher dead time between lessons (slots/week)', 'teacher_idle_gap_slots_per_week', true],
];
const SUBSTITUTION_ROWS = [
  ['Substitution: staffed lessons scored', 'total_scored_lessons', false],
  ['Substitution: permanent vacancies (no teacher assigned)', 'vacancy_count', true],
  ['Substitution: lessons with a same-subject sub free (%)', 'pct_lessons_with_same_subject_cover', false],
  ['Substitution: lessons with a same-subject OR same-dept sub free (%)', 'pct_with_subject_or_dept_cover', false],
  ['Substitution: fragile lessons (zero eligible free sub on ≥ 1 slot)', 'fragile_lesson_count', true],
  ['Substitution: fixable by moving just that one lesson (headroom)', 'fixable_by_moving_alone', true],
];
function renderMetrics() {
  const s = METRICS.school_ver19, m = METRICS.manhaj_rebuild, c = METRICS.manhaj_coverage_v4;
  const sub = SUBSTITUTION_METRICS || {};
  const subS = sub.school_ver19 || {}, subM = sub.manhaj_rebuild || {},
        subC = sub.manhaj_coverage_v4 || {};
  const hasCoverage = !!c;
  let html = '<table><tr><th>Measure</th><th>School Ver 19</th>' +
             '<th>Manhaj rebuild</th>' +
             (hasCoverage ? '<th>Manhaj coverage-optimized</th>' : '') + '</tr>';
  for (const [label, key, lowerBetter] of METRIC_ROWS) {
    const a = s[key], b = m[key];
    const cls = (lowerBetter && b < a) ? ' class="num good"' : ' class="num"';
    html += `<tr><td>${label}</td><td class="num">${a}</td><td${cls}>${b}</td>`;
    if (hasCoverage) {
      const cv = c[key];
      const clsC = (lowerBetter && cv < a) ? ' class="num good"' : ' class="num"';
      html += `<td${clsC}>${cv}</td>`;
    }
    html += '</tr>';
  }
  for (const [label, key, lowerBetter] of SUBSTITUTION_ROWS) {
    const a = subS[key], b = subM[key];
    const cls = (lowerBetter && b < a) ? ' class="num good"'
              : (!lowerBetter && b > a) ? ' class="num good"' : ' class="num"';
    html += `<tr><td>${label}</td><td class="num">${a}</td><td${cls}>${b}</td>`;
    if (hasCoverage) {
      const cv = subC[key];
      const clsC = (lowerBetter && cv < a) ? ' class="num good"'
                 : (!lowerBetter && cv > a) ? ' class="num good"' : ' class="num"';
      html += `<td${clsC}>${cv}</td>`;
    }
    html += '</tr>';
  }
  document.getElementById('metrics').innerHTML = html + '</table>';
}

function fill(sel, keys) {
  sel.innerHTML = '<option value="">—</option>' + keys.map(k =>
    `<option value="${k}">${k}</option>`).join('');
}
function keysOf(field) {
  const all = new Set();
  for (const ds of Object.values(DATASETS))
    for (const l of ds) if (l[field]) all.add(l[field]);
  return [...all].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
}
function render() {
  if (!filterKey) { document.getElementById('grid').innerHTML = ''; return; }
  const rows = DATASETS[src].filter(l => l[filterKey] === filterVal);
  let html = '<table><tr><th></th>' + DAYS.map(d => `<th>${d}</th>`).join('') + '</tr>';
  for (const p of SLOTS) {
    html += `<tr><th>${p}</th>`;
    for (const d of DAYS) {
      const here = rows.filter(l => l.day === d && l.slots.includes(p));
      html += '<td>' + here.map(l =>
        `<span class="lesson${l.locked ? ' locked' : ''}">${l.subject}` +
        `${l.slots.length > 1 ? ' (double)' : ''}<br>` +
        (filterKey === 'section'
          ? `<small>${l.teacher || '(unstaffed)'}</small>`
          : `<small>${l.section}</small>`) +
        '</span>').join('') + '</td>';
    }
    html += '</tr>';
  }
  document.getElementById('grid').innerHTML = html + '</table>';
}
document.getElementById('src').onclick = e => {
  if (!e.target.dataset.src) return;
  src = e.target.dataset.src;
  for (const b of document.querySelectorAll('#src button'))
    b.classList.toggle('on', b.dataset.src === src);
  render();
};
const secSel = document.getElementById('sec'), tchSel = document.getElementById('tch');
fill(secSel, keysOf('section'));
fill(tchSel, keysOf('teacher'));
secSel.onchange = e => {
  if (e.target.value) { tchSel.value = ''; filterKey = 'section';
                        filterVal = e.target.value; render(); } };
tchSel.onchange = e => {
  if (e.target.value) { secSel.value = ''; filterKey = 'teacher';
                        filterVal = e.target.value; render(); } };
renderMetrics();
secSel.value = secSel.options[1] ? secSel.options[1].value : '';
if (secSel.value) { filterKey = 'section'; filterVal = secSel.value; render(); }
</script>
"""


def _slim(l, locked=False):
    return {"section": l["section"], "day": l["day"], "slots": l["slots"],
            "subject": l["subject"], "teacher": l.get("teacher"),
            "locked": bool(l.get("locked", locked))}


def main():
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    rebuild_out = json.loads((DERIVED / "rebuild_v2.json").read_text())
    benchmark = json.loads((DERIVED / "benchmark.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())

    # school view: mark the same lock categories for visual parity
    locked_keys = {(l["section"], l["day"], tuple(l["slots"]), l["subject"])
                   for l in rebuild_out["lessons"] if l["locked"]}
    school = [_slim(l, (l["section"], l["day"], tuple(l["slots"]),
                        l["subject"]) in locked_keys) for l in canonical]
    manhaj = [_slim(l) for l in rebuild_out["lessons"]]

    # v4 (coverage_resolve_v4: pairwise swaps + atomic combined-unit moves on
    # top of v3) — optional third dataset, the best variant we ship; v3 is
    # retained in benchmark.json but no longer rendered here.
    v4_path = DERIVED / "rebuild_v4_coverage.json"
    coverage = ([_slim(l) for l in json.loads(v4_path.read_text())["lessons"]]
               if v4_path.exists() else [])

    slot_order = []
    for rows in bells.values():
        for r in rows:
            if r["teaching"] and r["slot"] not in slot_order:
                slot_order.append(r["slot"])
    slot_order.sort(key=lambda s: int(s[1:]))
    # B-slots appear in source data (locked lessons) — show them last
    slot_order += ["B1", "B2"]

    meta = rebuild_out["solve_meta"]
    html = (TEMPLATE
            .replace("%%VERSION%%", rebuild_out["source"]["solver_version"])
            .replace("%%STATUS%%", meta["status"])
            .replace("%%WALL%%", str(meta["wall_time_s"]))
            .replace("%%MOVABLE%%", str(meta["movable"]))
            .replace("%%LOCKED%%", str(meta["locked"]))
            .replace("%%WHEN%%", rebuild_out["source"]["generated_at"][:16])
            .replace("%%DAYS%%", json.dumps(["Sun", "Mon", "Tue", "Wed", "Thu"]))
            .replace("%%SLOTS%%", json.dumps(slot_order))
            .replace("%%METRICS%%", json.dumps(benchmark["summary"]))
            .replace("%%SUBSTITUTION_METRICS%%",
                    json.dumps(benchmark.get("substitution_friendliness", {})))
            .replace("%%SCHOOL%%", json.dumps(school))
            .replace("%%MANHAJ%%", json.dumps(manhaj))
            .replace("%%COVERAGE%%", json.dumps(coverage)))
    out = ROOT / "demo" / "mockups" / "tt2526_rebuild_dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
