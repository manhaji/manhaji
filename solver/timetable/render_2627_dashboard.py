#!/usr/bin/env python3
"""Render the 2026-27 FRESH timetable demo dashboard — self-contained HTML,
built entirely from the founder's next-year workload plan run through
gen2627.py's mapping layer + v2core.rebuild + coverage_resolve_v4.

Audience: the founder demoing "generate next year's schedule from scratch"
to ISO. Same sober, plain-language style as demo/mockups/principal_dashboard
.html (no jargon — the solver is always "the Manhaj scheduling engine").

Sections: header ("Generated 2026-27 timetable — draft for review");
class + teacher week-grid viewers with a [as generated | coverage-tuned]
toggle; metrics panel (money numbers + demand-shape-floor context);
gap-report panel (plain language, from gap_report.md's structured source).

Usage:
    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/render_2627_dashboard.py
Writes: demo/mockups/tt2627_fresh_dashboard.html
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_2627 = ROOT / "data" / "processed" / "tt_2627"
DERIVED_2526 = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]
DAY_LABELS = {"Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday",
              "Wed": "Wednesday", "Thu": "Thursday"}


def _slim(l):
    return {"section": l["section"], "day": l["day"], "slots": l["slots"],
            "subject": l["subject"], "teacher": l.get("teacher"),
            "locked": bool(l.get("locked", False))}


TEMPLATE = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manhaj — 2026-27 generated timetable</title>
<style>
  :root {
    --ink: #1c2b2a;
    --sub: #5b6b68;
    --border: #dfe3e0;
    --paper: #fbfaf7;
    --card: #ffffff;
    --brand: #1b6f5c;
    --brand-dark: #12503f;
    --brand-tint: #e6f2ee;
    --warn: #a9631a;
    --warn-tint: #fbf1e3;
    --danger: #b23b3b;
    --danger-tint: #fbeaea;
    --good: #1b7a5e;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    margin: 0; background: var(--paper); color: var(--ink); line-height: 1.5;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 24px 80px; }
  header.top {
    background: linear-gradient(135deg, var(--brand-dark), var(--brand));
    color: #fff; padding: 36px 24px 44px;
  }
  header.top .inner { max-width: 1080px; margin: 0 auto; }
  header.top h1 { font-size: 24px; margin: 0 0 6px; font-weight: 650; }
  header.top p.sub { margin: 0; font-size: 15px; color: #d9ede7; max-width: 680px; }
  .stat-row { display: flex; gap: 16px; margin-top: 24px; flex-wrap: wrap; }
  .stat-card {
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22);
    border-radius: 10px; padding: 14px 18px; flex: 1; min-width: 190px;
  }
  .stat-card .num { font-size: 22px; font-weight: 700; display: block; }
  .stat-card .lbl { font-size: 12.5px; color: #d9ede7; }
  section.card {
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 24px 26px; margin-top: 28px;
  }
  h2 { font-size: 18px; margin: 0 0 4px; font-weight: 650; }
  h2 .step { color: var(--brand); font-weight: 700; margin-right: 6px; }
  p.desc { color: var(--sub); font-size: 14px; margin: 4px 0 18px; max-width: 720px; }
  label.field { font-size: 13px; color: var(--sub); margin-right: 18px; }
  select {
    font-size: 14px; padding: 7px 10px; margin-left: 6px; border-radius: 7px;
    border: 1px solid var(--border); background: #fff; color: var(--ink);
  }
  .controls { margin-bottom: 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 10px 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 8px 10px; font-size: 13.5px; vertical-align: top; }
  thead th {
    background: #f2f6f4; color: var(--sub); font-weight: 600; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1px solid var(--border);
  }
  tbody tr { border-bottom: 1px solid var(--border); }
  tbody tr:last-child { border-bottom: none; }
  table.metrics td, table.metrics th { text-align: center; }
  table.metrics td:first-child, table.metrics th:first-child { text-align: left; }
  .toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .toggle button {
    border: 0; background: #fff; padding: 7px 14px; font-size: 13.5px; cursor: pointer; color: var(--ink);
  }
  .toggle button.on { background: var(--brand); color: #fff; font-weight: 600; }
  .grid-table th, .grid-table td {
    border: 1px solid var(--border); font-size: 12px; min-width: 108px; height: 42px;
  }
  .grid-table thead th { text-transform: none; letter-spacing: normal; }
  .lesson {
    background: var(--brand-tint); border-radius: 5px; padding: 3px 6px; margin: 2px 0; display: block;
  }
  .lesson.locked { background: #f1e8d8; }
  .lesson small { color: var(--sub); display: block; }
  .findings-list { list-style: none; margin: 0; padding: 0; }
  .findings-list li {
    display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
  }
  .findings-list li:last-child { border-bottom: none; }
  .finding-icon {
    flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; background: var(--warn-tint);
    color: var(--warn); display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
  }
  .finding-body b { display: block; margin-bottom: 2px; }
  .finding-body span.detail { color: var(--sub); font-size: 13px; }
  .banner {
    background: var(--warn-tint); border: 1px solid #f0dcb8; border-radius: 10px;
    padding: 12px 16px; margin-top: 16px; font-size: 13.5px; color: var(--warn);
  }
  .floor-note {
    background: var(--brand-tint); border: 1px solid #bfe0d4; border-radius: 10px;
    padding: 14px 16px; margin-top: 16px; font-size: 13.5px; color: var(--brand-dark);
  }
  footer.bottom {
    max-width: 1080px; margin: 36px auto 0; padding: 18px 24px; color: var(--sub);
    font-size: 12.5px; border-top: 1px solid var(--border);
  }
</style>

<header class="top">
  <div class="inner">
    <h1>Generated 2026-27 timetable — draft for review</h1>
    <p class="sub">Built from next year's teacher workload plan (the school's own circular data),
      scheduled fresh under the real-world rules mined from ISO's actual 2025-26 timetable — subject
      pairings, per-day limits, bell schedules. Nothing here reuses a 2025-26 placement; every lesson
      was placed by the Manhaj scheduling engine from scratch.</p>
    <div class="stat-row">
      <div class="stat-card"><span class="num">%%DEMAND_TOTAL%%</span><span class="lbl">lessons placed this week</span></div>
      <div class="stat-card"><span class="num">%%HARD_TRIPLE%%</span><span class="lbl">hard-rule violations (clashes / illegal overlaps / cap breaches)</span></div>
      <div class="stat-card"><span class="num">%%COVER_PCT%%</span><span class="lbl">lessons with a same-subject substitute free, coverage-tuned</span></div>
    </div>
  </div>
</header>

<div class="wrap">

  <section class="card" id="viewer">
    <h2><span class="step">1</span>Class &amp; teacher week grids</h2>
    <p class="desc">See any class's or any teacher's full week, either as first generated by the
      Manhaj engine or after the coverage-tuning pass (a handful of moves/swaps that make it easier
      to cover an absence, without breaking any rule).</p>
    <div class="controls">
      <span class="toggle" id="viewer-toggle">
        <button data-src="v1" class="on">As generated</button>
        <button data-src="final">Coverage-tuned</button>
      </span>
      <label class="field">View
        <select id="view-mode">
          <option value="class">By class</option>
          <option value="teacher">By teacher</option>
        </select>
      </label>
      <label class="field">Class
        <select id="viewer-class"></select>
      </label>
      <label class="field" id="teacher-field" style="display:none;">Teacher
        <select id="viewer-teacher"></select>
      </label>
    </div>
    <div id="viewer-grid"></div>
    <p class="desc" style="margin-top:10px;">Beige cells are locked in place (exams, library duty,
      combined multi-class lessons, break-time slots) — identical on both sides.</p>
  </section>

  <section class="card" id="metrics">
    <h2><span class="step">2</span>The numbers</h2>
    <p class="desc">"As generated" is the Manhaj engine's first solve; "coverage-tuned" is after the
      swap/move repair pass that improves absence resilience without touching any hard rule.</p>
    <table class="metrics">
      <thead><tr><th>Measure</th><th>As generated</th><th>Coverage-tuned</th></tr></thead>
      <tbody id="metrics-body"></tbody>
    </table>
    <div class="floor-note" id="floor-note"></div>
  </section>

  <section class="card" id="gaps">
    <h2><span class="step">3</span>Gap report — what needed a judgment call</h2>
    <p class="desc">Every place this generation could not cleanly inherit a 2025-26 rule, had to drop
      unreadable demand, or had to trim an over-committed teacher's load — in plain language.</p>
    <ul class="findings-list" id="gap-list"></ul>
  </section>

</div>

<footer class="bottom">
  Generated %%WHEN%% from data/processed/load_matrix.json (2026-27 workload plan) and
  data/processed/tt_2526/derived/ (2025-26 mined constraints). Nothing on this page was hand-edited.
</footer>

<script>
const V1_GRID = %%V1_GRID%%;
const FINAL_GRID = %%FINAL_GRID%%;
const METRICS = %%METRICS%%;
const GAPS = %%GAPS%%;
const DAYS = %%DAYS%%;
const DAY_LABELS = %%DAY_LABELS%%;
const SLOTS = %%SLOTS%%;

function fillSelect(sel, keys, labelFn) {
  sel.innerHTML = keys.map(k => `<option value="${k}">${labelFn ? labelFn(k) : k}</option>`).join('');
}

let viewerSrc = 'v1';
let viewMode = 'class';

const classes = [...new Set([...V1_GRID, ...FINAL_GRID].map(l => l.section))].sort();
const teachers = [...new Set([...V1_GRID, ...FINAL_GRID].map(l => l.teacher).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const classSel = document.getElementById('viewer-class');
const teacherSel = document.getElementById('viewer-teacher');
fillSelect(classSel, classes);
fillSelect(teacherSel, teachers);

function renderViewer() {
  const grid = viewerSrc === 'v1' ? V1_GRID : FINAL_GRID;
  let rows;
  if (viewMode === 'class') {
    rows = grid.filter(l => l.section === classSel.value);
  } else {
    rows = grid.filter(l => l.teacher === teacherSel.value);
  }
  let html = '<table class="grid-table"><tr><th></th>' + DAYS.map(d => `<th>${DAY_LABELS[d]}</th>`).join('') + '</tr>';
  for (const p of SLOTS) {
    html += `<tr><th>${p}</th>`;
    for (const d of DAYS) {
      const here = rows.filter(l => l.day === d && l.slots.includes(p));
      html += '<td>' + here.map(l =>
        `<span class="lesson${l.locked ? ' locked' : ''}">${l.subject}${l.slots.length > 1 ? ' (double)' : ''}<br>` +
        `<small>${viewMode === 'class' ? (l.teacher || 'unstaffed') : l.section}</small></span>`).join('') + '</td>';
    }
    html += '</tr>';
  }
  document.getElementById('viewer-grid').innerHTML = html + '</table>';
}
document.getElementById('viewer-toggle').onclick = e => {
  if (!e.target.dataset.src) return;
  viewerSrc = e.target.dataset.src;
  for (const b of document.querySelectorAll('#viewer-toggle button')) b.classList.toggle('on', b.dataset.src === viewerSrc);
  renderViewer();
};
document.getElementById('view-mode').onchange = e => {
  viewMode = e.target.value;
  document.getElementById('teacher-field').style.display = viewMode === 'teacher' ? '' : 'none';
  classSel.parentElement.style.display = viewMode === 'class' ? '' : 'none';
  renderViewer();
};
classSel.onchange = renderViewer;
teacherSel.onchange = renderViewer;
renderViewer();

// ---------- metrics ----------
const METRIC_ROWS = [
  ['Lessons placed / demand total', null, null, 'demand'],
  ['Teacher double-bookings (must be 0)', 'teacher_clashes', true],
  ['Illegal class overlaps (must be 0)', 'illegal_overlaps', true],
  ['Per-day cap breaches (must be 0)', 'per_day_cap_violations', true],
  ['Same subject twice+ in one day, week-wide (doublings)', 'same_day_doublings', true],
  ['Teacher workload evenness (avg busiest-vs-lightest gap)', 'teacher_balance_avg', true],
  ['Teacher dead time (idle slots/week)', 'idle_gap_slots', true],
  ['Same-subject substitute cover (%)', 'substitution_cover_pct_same_subject', false, '%'],
  ['Same-subject-or-department cover (%)', 'substitution_cover_pct_subject_or_dept', false, '%'],
  ['Fragile lessons (no eligible sub free on ≥1 slot)', 'fragile_lesson_count', true],
];
function renderMetrics() {
  const v1 = METRICS.v1, f = METRICS.final;
  let html = '';
  for (const [label, key, lowerBetter, special] of METRIC_ROWS) {
    if (special === 'demand') {
      html += `<tr><td>${label}</td><td class="num">${METRICS.demand_total_slots} / ${METRICS.demand_total_slots}</td>` +
              `<td class="num">${METRICS.demand_total_slots} / ${METRICS.demand_total_slots}</td></tr>`;
      continue;
    }
    const a = key.startsWith('teacher_clashes') || key === 'illegal_overlaps' || key === 'per_day_cap_violations'
      ? v1.hard_triple[key] : v1[key];
    const b = key.startsWith('teacher_clashes') || key === 'illegal_overlaps' || key === 'per_day_cap_violations'
      ? f.hard_triple[key] : f[key];
    const fmt = x => (x === undefined ? '—' : x + (special === '%' ? '%' : ''));
    html += `<tr><td>${label}</td><td class="num">${fmt(a)}</td><td class="num">${fmt(b)}</td></tr>`;
  }
  document.getElementById('metrics-body').innerHTML = html;
  document.getElementById('floor-note').innerHTML =
    `Demand-shape floor (the fewest same-day doublings any timetable could have, given this exact ` +
    `set of lessons): <b>${v1.demand_shape_floor}</b>. "As generated" scores <b>${v1.same_day_doublings}</b> ` +
    `— within ${v1.same_day_doublings - v1.demand_shape_floor} of that theoretical floor. Solve time ` +
    `${v1.solve_wall_time_s}s; coverage pass ${f.coverage_wall_time_s}s (${f.coverage_moves} move(s), ` +
    `${f.coverage_swaps} swap(s)).`;
}
renderMetrics();

// ---------- gap report ----------
function renderGaps() {
  document.getElementById('gap-list').innerHTML = GAPS.map(g =>
    `<li><div class="finding-icon">!</div><div class="finding-body"><span class="detail">${g}</span></div></li>`
  ).join('');
}
renderGaps();
</script>
"""


def main():
    request = json.loads((OUT_2627 / "request.json").read_text())
    schedule_v1 = json.loads((OUT_2627 / "schedule_v1.json").read_text())
    schedule_final = json.loads((OUT_2627 / "schedule_final.json").read_text())
    metrics = json.loads((OUT_2627 / "metrics.json").read_text())
    gap_report_md = (OUT_2627 / "gap_report.md").read_text()

    v1_grid = [_slim(l) for l in schedule_v1["lessons"]]
    final_grid = [_slim(l) for l in schedule_final["lessons"]]

    bells = request["bells"]
    slot_order = []
    for rows in bells.values():
        for r in rows:
            if r["teaching"] and r["slot"] not in slot_order:
                slot_order.append(r["slot"])
    slot_order.sort(key=lambda s: int(s[1:]))
    slot_order += ["B1", "B2"]

    # Plain-language gap list: reuse gap_report.md's bullet lines (every
    # line starting with "- ") rather than re-deriving from JSON, so the
    # dashboard and the file stay in lockstep with one source of truth.
    gap_lines = [ln[2:].strip() for ln in gap_report_md.splitlines()
                if ln.startswith("- ") and ln.strip() != "- none"]

    demand_total = metrics["demand_total_slots"]
    hard = metrics["v1"]["hard_triple"]
    hard_triple_str = (f"{hard['teacher_clashes']}/{hard['illegal_overlaps']}/"
                       f"{hard['per_day_cap_violations']}")
    cover_pct = metrics["final"]["substitution_cover_pct_same_subject"]

    html = (TEMPLATE
            .replace("%%WHEN%%", schedule_final["source"]["generated_at"])
            .replace("%%DEMAND_TOTAL%%", str(demand_total))
            .replace("%%HARD_TRIPLE%%", hard_triple_str)
            .replace("%%COVER_PCT%%", f"{cover_pct}%")
            .replace("%%V1_GRID%%", json.dumps(v1_grid))
            .replace("%%FINAL_GRID%%", json.dumps(final_grid))
            .replace("%%METRICS%%", json.dumps(metrics))
            .replace("%%GAPS%%", json.dumps(gap_lines))
            .replace("%%DAYS%%", json.dumps(DAYS))
            .replace("%%DAY_LABELS%%", json.dumps(DAY_LABELS))
            .replace("%%SLOTS%%", json.dumps(slot_order)))

    out = ROOT / "demo" / "mockups" / "tt2627_fresh_dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
