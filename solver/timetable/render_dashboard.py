#!/usr/bin/env python3
"""Render plan.json into a standalone HTML timetable dashboard.

Self-contained file (no server, no dependencies) with a class picker and a
teacher picker, each showing a Mon-Fri x P1-P6 week grid.

Usage:  .venv/bin/python solver/timetable/render_dashboard.py
Writes: demo/mockups/timetable_dashboard.html
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "solver" / "timetable_out"

TEMPLATE = """<!doctype html>
<meta charset="utf-8">
<title>Manhaj — generated timetable (solver v%%VERSION%%)</title>
<style>
 body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
 h1 { font-size: 20px; font-weight: 600; }
 select { font-size: 14px; padding: 6px 10px; margin: 0 12px 16px 0; }
 table { border-collapse: collapse; width: 100%; max-width: 980px; }
 th, td { border: 1px solid #d8d5cc; padding: 6px 8px; font-size: 12.5px;
          vertical-align: top; min-width: 120px; height: 44px; }
 th { background: #f1efe8; font-weight: 600; }
 .lesson { background: #e1f5ee; border-radius: 4px; padding: 3px 6px; margin: 2px 0;
           display: block; }
 .lesson small { color: #555; }
 .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
</style>
<h1>Generated timetable — International School of Oman</h1>
<p class="meta">status: %%STATUS%% · %%NSLOTS%% lessons · spread violations: %%SPREAD%% ·
 balance violations: %%BALANCE%% · generated %%WHEN%%</p>
<label>Class: <select id="sec"></select></label>
<label>Teacher: <select id="tch"></select></label>
<div id="grid"></div>
<script>
const DATA = %%DATA%%;
const NAMES = %%NAMES%%;
const DAYS = %%DAYS%%, PERIODS = %%PERIODS%%;
function fill(sel, keys, labels) {
  sel.innerHTML = '<option value="">—</option>' + keys.map(k =>
    `<option value="${k}">${labels[k] || k}</option>`).join('');
}
const secs = [...new Set(DATA.map(s => s.section_id))]
  .sort((a, b) => (NAMES.sections[a] || a).localeCompare(NAMES.sections[b] || b));
const tchs = [...new Set(DATA.map(s => s.teacher_id))]
  .sort((a, b) => (NAMES.teachers[a] || a).localeCompare(NAMES.teachers[b] || b));
function render(filterKey, filterVal) {
  const rows = DATA.filter(s => s[filterKey] === filterVal);
  let html = '<table><tr><th></th>' + DAYS.map(d => `<th>${d}</th>`).join('') + '</tr>';
  for (let p = 1; p <= PERIODS; p++) {
    html += `<tr><th>P${p}</th>`;
    for (const d of DAYS) {
      const here = rows.filter(s => s.day === d && s.period_number === p);
      html += '<td>' + here.map(s =>
        `<span class="lesson">${NAMES.subjects[s.subject_id] || s.subject_id}<br>` +
        (filterKey === 'section_id'
          ? `<small>${NAMES.teachers[s.teacher_id] || s.teacher_id}</small>`
          : `<small>${NAMES.sections[s.section_id] || s.section_id}</small>`) +
        '</span>').join('') + '</td>';
    }
    html += '</tr>';
  }
  document.getElementById('grid').innerHTML = html + '</table>';
}
fill(document.getElementById('sec'), secs, NAMES.sections);
fill(document.getElementById('tch'), tchs, NAMES.teachers);
document.getElementById('sec').onchange = e => {
  if (e.target.value) { document.getElementById('tch').value = '';
                        render('section_id', e.target.value); } };
document.getElementById('tch').onchange = e => {
  if (e.target.value) { document.getElementById('sec').value = '';
                        render('teacher_id', e.target.value); } };
if (secs.length) { document.getElementById('sec').value = secs[0];
                   render('section_id', secs[0]); }
</script>
"""


def main():
    plan = json.loads((OUT_DIR / "plan.json").read_text())
    request = json.loads((OUT_DIR / "request.json").read_text())
    names = json.loads((OUT_DIR / "names.json").read_text())
    html = (TEMPLATE
            .replace("%%VERSION%%", plan["source"]["solver_version"])
            .replace("%%STATUS%%", plan["status"])
            .replace("%%NSLOTS%%", str(len(plan["slots"])))
            .replace("%%SPREAD%%", str(plan["quality"]["spread_violations"]))
            .replace("%%BALANCE%%", str(plan["quality"]["balance_violations"]))
            .replace("%%WHEN%%", plan["source"]["generated_at"][:16])
            .replace("%%DAYS%%", json.dumps(request["grid"]["days"]))
            .replace("%%PERIODS%%", str(request["grid"]["periods_per_day"]))
            .replace("%%NAMES%%", json.dumps(names))
            .replace("%%DATA%%", json.dumps(plan["slots"])))
    out = ROOT / "demo" / "mockups" / "timetable_dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
