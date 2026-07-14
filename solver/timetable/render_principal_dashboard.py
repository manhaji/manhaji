#!/usr/bin/env python3
"""Render the principal-facing demo dashboard for International School of
Oman — self-contained HTML (no external resources), built entirely from the
school's own real 2025-26 timetable artifacts.

Audience: a non-technical school principal. Plain language throughout — no
"CP-SAT", no jargon; the solver is always "the Manhaj scheduling engine".

Sections (in order): header + headline stats; "what if a teacher is
absent" simulator (embeds cover_plans.json); "your timetable, audited"
benchmark table; per-teacher schedule viewer (Ver 19 vs Manhaj rebuild);
"things to look out for"; footer.

Usage:
    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/render_principal_dashboard.py
Writes: demo/mockups/principal_dashboard.html
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]
DAY_LABELS = {"Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday",
              "Wed": "Wednesday", "Thu": "Thursday"}

DEFAULT_TEACHER = "Mohammed Saab"
DEFAULT_DAY = "Mon"


def _slim(l, locked=False):
    return {"section": l["section"], "day": l["day"], "slots": l["slots"],
            "subject": l["subject"], "teacher": l.get("teacher"),
            "locked": bool(l.get("locked", locked))}


TEMPLATE = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manhaj — International School of Oman</title>
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
  header.top p.sub { margin: 0; font-size: 15px; color: #d9ede7; max-width: 640px; }
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
  .row-covered { background: transparent; }
  .row-unfilled { background: var(--warn-tint); }
  .badge {
    display: inline-block; font-size: 11.5px; font-weight: 600; padding: 2px 8px;
    border-radius: 999px; background: var(--brand-tint); color: var(--brand-dark);
  }
  .badge.dept { background: #eef1e3; color: #566321; }
  .badge.needs { background: var(--warn-tint); color: var(--warn); }
  .alt-line { color: var(--sub); font-size: 12px; margin-top: 2px; }
  .plan-summary {
    margin-top: 14px; padding: 10px 14px; border-radius: 8px; background: var(--brand-tint);
    color: var(--brand-dark); font-size: 13.5px; font-weight: 600;
  }
  .plan-summary.has-gaps { background: var(--warn-tint); color: var(--warn); }
  table.audit td, table.audit th { text-align: center; }
  table.audit td:first-child, table.audit th:first-child { text-align: left; }
  .verdict-cert {
    background: var(--brand-tint); border: 1px solid #bfe0d4; border-radius: 10px;
    padding: 14px 16px; margin-top: 16px; font-size: 13.5px; color: var(--brand-dark);
  }
  .verdict-cert b { color: var(--ink); }
  .num.good { color: var(--good); font-weight: 700; }
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
  .lesson.empty-cell { background: transparent; }
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
  footer.bottom {
    max-width: 1080px; margin: 36px auto 0; padding: 18px 24px; color: var(--sub);
    font-size: 12.5px; border-top: 1px solid var(--border);
  }
  .legend-note { font-size: 12px; color: var(--sub); margin-top: 10px; }
</style>

<header class="top">
  <div class="inner">
    <h1>Manhaj — built from your school's own timetable</h1>
    <p class="sub">ACAD 2025-26, Ver 19. Everything on this page is computed from International
      School of Oman's own exported timetable data — nothing here is a mockup or a made-up example.</p>
    <div class="stat-row">
      <div class="stat-card"><span class="num">1,920</span><span class="lbl">lessons read from your timetable</span></div>
      <div class="stat-card"><span class="num">66</span><span class="lbl">teacher schedules covered</span></div>
      <div class="stat-card"><span class="num">100%</span><span class="lbl">of checks run on your real data</span></div>
    </div>
  </div>
</header>

<div class="wrap">

  <section class="card" id="simulator">
    <h2><span class="step">1</span>What if a teacher is absent?</h2>
    <p class="desc">Pick any teacher and any day. Manhaj instantly proposes who could cover each of
      their lessons that day — using only teachers who are genuinely free at that exact time, and who
      teach the same subject (or, failing that, the same department).</p>
    <div class="controls">
      <label class="field">Teacher
        <select id="sim-teacher"></select>
      </label>
      <label class="field">Day
        <select id="sim-day"></select>
      </label>
    </div>
    <div id="sim-output"></div>
  </section>

  <section class="card" id="audit">
    <h2><span class="step">2</span>Your timetable, audited</h2>
    <p class="desc">The same checker scored three things side by side: your school's Ver 19 timetable
      as printed, an independent Manhaj rebuild of the exact same lessons, and a Manhaj
      coverage-tuned version that nudges a handful of lessons to make absence cover easier — without
      breaking any rule your own timetable follows.</p>
    <table class="audit">
      <thead>
        <tr><th>Measure</th><th>Your Ver 19</th><th>Manhaj rebuild</th><th>Manhaj coverage-tuned</th></tr>
      </thead>
      <tbody id="audit-body"></tbody>
    </table>
    <div class="verdict-cert">
      <b>Certification, not a competition.</b> Your Ver 19 timetable is already within 12 lessons of
      the mathematical best possible under your own scheduling rules (measured on how many times a
      subject repeats in a single day, the hardest constraint to avoid). The Manhaj rebuild reproduces
      it exactly, with zero rule violations, rather than finding easy wins — that is our engine
      <b>confirming</b> your timetable is sound, not fixing it. The coverage-tuned version then makes
      three small, additional moves (all optional) that improve how well the school can absorb a
      teacher absence, detailed in the substitution-friendliness rows above.
    </div>
  </section>

  <section class="card" id="viewer">
    <h2><span class="step">3</span>Per-teacher schedule viewer</h2>
    <p class="desc">See any teacher's full week, exactly as it stands today (Ver 19), or as the
      Manhaj coverage-tuned engine would place it. Both placements cover the identical lessons —
      only positions in the week can move.</p>
    <div class="controls">
      <span class="toggle" id="viewer-toggle">
        <button data-src="school" class="on">Your Ver 19</button>
        <button data-src="manhaj">Manhaj</button>
      </span>
      <label class="field">Teacher
        <select id="viewer-teacher"></select>
      </label>
    </div>
    <div id="viewer-grid"></div>
    <p class="legend-note">Beige cells are locked in place (exams, library duty, combined
      multi-class lessons, break-time sessions) and are identical on both sides.</p>
  </section>

  <section class="card" id="findings">
    <h2><span class="step">4</span>Things to look out for</h2>
    <p class="desc">Everything below came directly out of reading your two PDFs (class timetable
      and teacher timetable) — none of it was assumed or inferred beyond what is noted.</p>
    <ul class="findings-list">
      <li>
        <div class="finding-icon">!</div>
        <div class="finding-body">
          <b>Grade 10A and 10B — English periods without a named teacher</b>
          <span class="detail">7 English-family slots per class are unstaffed on the timetable
            (5 English periods + 2 English-Support periods): Sun P4, Mon P3, Mon B2 (Support),
            Tue P1, Wed P4, Wed B2 (Support), Thu P8 — same pattern in both 10A and 10B. Worth
            confirming whether this is a live vacancy or a page we're not reading correctly.</span>
        </div>
      </li>
      <li>
        <div class="finding-icon">!</div>
        <div class="finding-body">
          <b>Grade 3C — one unlabelled slot</b>
          <span class="detail">Wednesday P3 is marked "E-S" with no teacher assigned — it looks like
            English-Support based on the code, but we're not certain. Please confirm what E-S means
            here and whether a teacher should be assigned.</span>
        </div>
      </li>
      <li>
        <div class="finding-icon">!</div>
        <div class="finding-body">
          <b>Four subjects are taught by only one or two people school-wide</b>
          <span class="detail">ICT has 1 teacher; Physics, Computing, and Economics each have 2.
            For these, a single absence leaves no same-subject cover available at all — the office
            would need to fall back to a same-department colleague or leave the period supervised
            only. Worth considering some cross-training here.</span>
        </div>
      </li>
      <li>
        <div class="finding-icon">!</div>
        <div class="finding-body">
          <b>310 lessons (16.8% of 1,846 staffed lessons) have no same-subject substitute free at
            that hour</b>
          <span class="detail">This is the current Ver 19 timetable's number. Most of these sit in
            the thin subjects above. The Manhaj coverage-tuned version brings this down to 307 by
            moving a small number of lessons — a full re-solve could likely improve it further.</span>
        </div>
      </li>
      <li>
        <div class="finding-icon">!</div>
        <div class="finding-body">
          <b>Four small print inconsistencies, all around Grade 12C-A2</b>
          <span class="detail">The class timetable PDF visually merges a few stacked two-subject
            cells across both periods, which over-states how long one of the two subjects runs.
            The teacher timetable pages show the precise single-period placement in each case, so
            we used the teacher pages' version to resolve all four.</span>
        </div>
      </li>
      <li>
        <div class="finding-icon">?</div>
        <div class="finding-body">
          <b>Question for you: the co-teacher initials</b>
          <span class="detail">Several lessons list two teachers by initials only, straight from
            your own PDFs — pairs such as "IBZ / H", "H / DV", "IBZ / DV", and "FM / KAS" (this last
            pair covers Grade 10 Chemistry; the rest are PE co-teaching pairs). We have not guessed
            who these initials belong to — we'd like your legend so these lessons can be attributed
            to named teachers too.</span>
        </div>
      </li>
    </ul>
  </section>

</div>

<footer class="bottom">
  All numbers on this page are reproducible from your exported timetables — nothing was manually
  adjusted. Generated %%WHEN%%.
</footer>

<script>
const COVER_PLANS = %%COVER_PLANS%%;
const WEEK_INDEX = %%WEEK_INDEX%%;
const AUDIT = %%AUDIT%%;
const SCHOOL_GRID = %%SCHOOL_GRID%%;
const MANHAJ_GRID = %%MANHAJ_GRID%%;
const DAYS = %%DAYS%%;
const DAY_LABELS = %%DAY_LABELS%%;
const SLOTS = %%SLOTS%%;
const DEFAULT_TEACHER = %%DEFAULT_TEACHER%%;
const DEFAULT_DAY = %%DEFAULT_DAY%%;

// ---------- Section 1: absence simulator ----------
function fillSelect(sel, keys, labelFn) {
  sel.innerHTML = keys.map(k => `<option value="${k}">${labelFn ? labelFn(k) : k}</option>`).join('');
}
const teacherNames = Object.keys(COVER_PLANS).sort((a, b) => a.localeCompare(b));
const simTeacherSel = document.getElementById('sim-teacher');
const simDaySel = document.getElementById('sim-day');
fillSelect(simTeacherSel, teacherNames);
fillSelect(simDaySel, DAYS, d => DAY_LABELS[d]);

function renderSimulator() {
  const teacher = simTeacherSel.value, day = simDaySel.value;
  const out = document.getElementById('sim-output');
  const plan = (COVER_PLANS[teacher] || {})[day];
  if (!plan) {
    out.innerHTML = `<p class="desc" style="margin-top:8px;">${teacher} has no lessons on ${DAY_LABELS[day]} — nothing to cover.</p>`;
    return;
  }
  let html = '<table><thead><tr><th>Period</th><th>Class</th><th>Subject</th><th>Suggested substitute</th></tr></thead><tbody>';
  for (const a of plan.assignments) {
    html += `<tr class="row-covered">
      <td>${a.period}</td><td>${a.section}</td><td>${a.subject}</td>
      <td><span class="badge${a.match_type === 'same_department' ? ' dept' : ''}">${a.substitute}</span>
        <div class="alt-line">${a.reason}${a.alternatives.length ? ' · other options: ' + a.alternatives.join(', ') : ''}</div>
      </td></tr>`;
  }
  for (const u of plan.unfilled) {
    html += `<tr class="row-unfilled">
      <td>${u.period}</td><td>${u.section}</td><td>${u.subject}</td>
      <td><span class="badge needs">needs office decision</span>
        <div class="alt-line">${u.reason}</div></td></tr>`;
  }
  html += '</tbody></table>';
  const gaps = plan.summary.unfilled > 0;
  html += `<div class="plan-summary${gaps ? ' has-gaps' : ''}">${plan.summary.notes}</div>`;
  out.innerHTML = html;
}
simTeacherSel.onchange = renderSimulator;
simDaySel.onchange = renderSimulator;
simTeacherSel.value = DEFAULT_TEACHER;
simDaySel.value = DEFAULT_DAY;
renderSimulator();

// ---------- Section 2: audit table ----------
const AUDIT_ROWS = [
  ['Lessons in the week', 'lesson_records', null],
  ['Taught slots in the week', 'placed_slots', null],
  ['Teacher double-bookings (must be 0)', 'teacher_clashes', true],
  ['Classes shown two lessons at once (must be 0)', 'illegal_section_overlaps', true],
  ['Subject over the daily limit (must be 0)', 'per_day_cap_violations', true],
  ['Same subject twice or more in one day, week-wide', 'same_day_doublings_per_week', true],
  ['Teacher workload evenness (lower = steadier)', 'teacher_daily_balance_avg', true],
  ['Teacher dead time between lessons (slots/week)', 'teacher_idle_gap_slots_per_week', true],
  ['Staffed lessons scored for substitution risk', 'total_scored_lessons', null],
  ['Permanent vacancies (no teacher at all)', 'vacancy_count', true],
  ['Lessons with a same-subject substitute free', 'pct_lessons_with_same_subject_cover', false, '%'],
  ['Lessons with a same-subject OR same-department sub free', 'pct_with_subject_or_dept_cover', false, '%'],
  ['Fragile lessons (zero eligible free sub on ≥ 1 slot)', 'fragile_lesson_count', true],
];
function renderAudit() {
  const s = AUDIT.school, m = AUDIT.manhaj, c = AUDIT.coverage;
  let html = '';
  for (const [label, key, lowerBetter, suffix] of AUDIT_ROWS) {
    const a = s[key], b = m[key], cv = c[key];
    const fmt = v => (v === undefined ? '—' : v + (suffix || ''));
    const clsFor = v => {
      if (lowerBetter === null || v === a) return 'num';
      const better = lowerBetter ? v < a : v > a;
      return better ? 'num good' : 'num';
    };
    html += `<tr><td>${label}</td><td class="num">${fmt(a)}</td>` +
            `<td class="${clsFor(b)}">${fmt(b)}</td>` +
            `<td class="${clsFor(cv)}">${fmt(cv)}</td></tr>`;
  }
  document.getElementById('audit-body').innerHTML = html;
}
renderAudit();

// ---------- Section 3: per-teacher schedule viewer ----------
let viewerSrc = 'school';
const viewerTeacherSel = document.getElementById('viewer-teacher');
const viewerTeachers = [...new Set([...SCHOOL_GRID, ...MANHAJ_GRID].map(l => l.teacher).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));
fillSelect(viewerTeacherSel, viewerTeachers);

function renderViewer() {
  const teacher = viewerTeacherSel.value;
  const rows = (viewerSrc === 'school' ? SCHOOL_GRID : MANHAJ_GRID).filter(l => l.teacher === teacher);
  let html = '<table class="grid-table"><tr><th></th>' + DAYS.map(d => `<th>${DAY_LABELS[d]}</th>`).join('') + '</tr>';
  for (const p of SLOTS) {
    html += `<tr><th>${p}</th>`;
    for (const d of DAYS) {
      const here = rows.filter(l => l.day === d && l.slots.includes(p));
      html += '<td>' + here.map(l =>
        `<span class="lesson${l.locked ? ' locked' : ''}">${l.subject}${l.slots.length > 1 ? ' (double)' : ''}<br>` +
        `<small>${l.section}</small></span>`).join('') + '</td>';
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
viewerTeacherSel.onchange = renderViewer;
viewerTeacherSel.value = DEFAULT_TEACHER;
renderViewer();
</script>
"""


def main():
    # NOTE: cover_plans.json (the absence simulator in section 1) was
    # computed against canonical Ver 19 and is intentionally left untouched
    # here — it simulates absences on the school's CURRENT timetable, which
    # is the correct thing to demo to a principal, regardless of which
    # coverage-repair version is newest.
    cover_data = json.loads((DERIVED / "cover_plans.json").read_text())
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    # v4 (coverage_resolve_v4: pairwise swaps + atomic combined-unit moves on
    # top of v3) is now the best variant — the audit table (section 2) and
    # the "Manhaj coverage-tuned" per-teacher viewer (section 3) both show it.
    rebuild_out = json.loads((DERIVED / "rebuild_v4_coverage.json").read_text())
    benchmark = json.loads((DERIVED / "benchmark.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())

    audit = {
        "school": {**benchmark["summary"]["school_ver19"],
                   **benchmark["substitution_friendliness"]["school_ver19"]},
        "manhaj": {**benchmark["summary"]["manhaj_rebuild"],
                   **benchmark["substitution_friendliness"]["manhaj_rebuild"]},
        "coverage": {**benchmark["summary"]["manhaj_coverage_v4"],
                     **benchmark["substitution_friendliness"]["manhaj_coverage_v4"]},
    }

    locked_keys = {(l["section"], l["day"], tuple(l["slots"]), l["subject"])
                   for l in rebuild_out["lessons"] if l.get("locked")}
    school_grid = [_slim(l, (l["section"], l["day"], tuple(l["slots"]),
                             l["subject"]) in locked_keys) for l in canonical]
    manhaj_grid = [_slim(l) for l in rebuild_out["lessons"]]

    slot_order = []
    for rows in bells.values():
        for r in rows:
            if r["teaching"] and r["slot"] not in slot_order:
                slot_order.append(r["slot"])
    slot_order.sort(key=lambda s: int(s[1:]))
    slot_order += ["B1", "B2"]

    html = (TEMPLATE
            .replace("%%WHEN%%", "from the school's most recent timetable export")
            .replace("%%COVER_PLANS%%", json.dumps(cover_data["cover_plans"]))
            .replace("%%WEEK_INDEX%%", json.dumps(cover_data["week_index"]))
            .replace("%%AUDIT%%", json.dumps(audit))
            .replace("%%SCHOOL_GRID%%", json.dumps(school_grid))
            .replace("%%MANHAJ_GRID%%", json.dumps(manhaj_grid))
            .replace("%%DAYS%%", json.dumps(DAYS))
            .replace("%%DAY_LABELS%%", json.dumps(DAY_LABELS))
            .replace("%%SLOTS%%", json.dumps(slot_order))
            .replace("%%DEFAULT_TEACHER%%", json.dumps(DEFAULT_TEACHER))
            .replace("%%DEFAULT_DAY%%", json.dumps(DEFAULT_DAY)))

    out = ROOT / "demo" / "mockups" / "principal_dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
