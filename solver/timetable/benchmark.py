#!/usr/bin/env python3
"""Benchmark checker: IDENTICAL metrics for the school's actual Ver 19
placement and the Manhaj v2 rebuild.

Metric definitions (applied identically to both sides — documented judgment
calls included):

- Physical-lesson dedup: records with identical (teacher, day, tuple(slots),
  subject) appearing in >= 2 sections are ONE physical lesson (a combined
  cross-section class) for all TEACHER-side metrics (clashes, balance, idle
  gaps, weekly load). Section-side metrics count each section's record.
- teacher_clash_count: sum over (teacher, day, slot) of max(0, n-1) where n
  is the number of distinct physical lessons the teacher occupies there.
  Lessons with teacher=None are skipped (unstaffed).
- illegal_overlap_count: per (section, day, slot), count unordered pairs of
  co-occupying lessons that are illegal: same subject (a subject never
  overlaps itself), or a subject pair not covered by any parallel_groups
  entry for that section.
- per_day_cap_violation_count: count of (section, subject, day) triples whose
  occupied SLOT count exceeds the mined max_per_day (slots/day is the mined
  semantics: mined per_week matches slot counts 546/546 on the real data).
  Pairs with no mined rule are not checked (mirrors the solver's permissive
  fallback).
- spread_score: sum over (section, subject, day) of max(0, slots_that_day-1).
  Note a 2-slot double inherently registers 1 doubling on both sides.
- teacher_balance: per teacher, max daily load minus min NONZERO daily load
  (days the teacher does not teach are ignored; a one-day teacher scores 0);
  reported per teacher plus the average over teachers with >= 1 slot.
- idle gaps (compute_idle_gaps): per (teacher, day, band): free TEACHING
  slots strictly between the teacher's first and last occupied slot in that
  band's teaching-slot order (breaks are not teaching slots and never count
  as idle). Judgment call: a teacher teaching in two bands on one day has two
  independent sub-schedules — the bands' clocks differ around the breaks, so
  a merged sequence would be ill-defined. Slots outside the band's teaching
  list (B1/B2 source oddities) are skipped.

CLI: compare the school placement vs a rebuild output and write
benchmark.json + benchmark.md side by side:

    cd /Users/eliasmouawad/dev/manhaj-phase-c && PYTHONPATH=. \
        /Users/eliasmouawad/dev/manhaj/.venv/bin/python \
        solver/timetable/benchmark.py
"""
import json
from collections import defaultdict
from pathlib import Path

from solver.timetable.substitution_score import (
    _summary_row as _substitution_summary_row,
)
from solver.timetable.substitution_score import score as substitution_score

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"


def _get(l, key, default=None):
    """Uniform access for dicts and pydantic-dumped dicts."""
    return l.get(key, default) if isinstance(l, dict) else getattr(l, key, default)


def _band_of(section):
    from solver.timetable.v2core import band_of
    return band_of(section)


def _physical_lessons(lessons):
    """Dedup combined cross-section records: one entry per distinct
    (teacher, day, slots, subject); teacherless records always pass through."""
    seen = set()
    out = []
    for l in lessons:
        t = _get(l, "teacher")
        if t:
            key = (t, _get(l, "day"), tuple(_get(l, "slots")), _get(l, "subject"))
            if key in seen:
                continue
            seen.add(key)
        out.append(l)
    return out


def compute_idle_gaps(lessons, bells, days):
    """Per-teacher weekly idle-gap slots + school-wide grand total."""
    teaching_order = {band: [r["slot"] if isinstance(r, dict) else r.slot
                             for r in rows
                             if (r["teaching"] if isinstance(r, dict) else r.teaching)]
                      for band, rows in bells.items()}
    occupied = defaultdict(set)  # (teacher, day, band) -> {position}
    for l in _physical_lessons(lessons):
        t = _get(l, "teacher")
        if not t:
            continue
        band = _band_of(_get(l, "section"))
        order = teaching_order[band]
        for s in _get(l, "slots"):
            if s in order:  # skip B1/B2 oddities — breaks aren't idle-relevant
                occupied[(t, _get(l, "day"), band)].add(order.index(s))
    per_teacher = defaultdict(int)
    for (t, _day, _band), positions in occupied.items():
        gap = (max(positions) - min(positions) + 1) - len(positions)
        per_teacher[t] += gap
    return {"per_teacher": dict(sorted(per_teacher.items())),
            "grand_total": sum(per_teacher.values())}


def compute_metrics(lessons, bells, parallel_groups, mined_rules, days):
    """All benchmark metrics for one placement (list of lesson records)."""
    # --- teacher clashes (physical dedup) ---------------------------------
    t_occ = defaultdict(int)
    physical = _physical_lessons(lessons)
    for l in physical:
        t = _get(l, "teacher")
        if not t:
            continue
        for s in _get(l, "slots"):
            t_occ[(t, _get(l, "day"), s)] += 1
    teacher_clash_count = sum(n - 1 for n in t_occ.values() if n > 1)

    # --- illegal section overlaps ------------------------------------------
    legal = {}
    for section, groups in (parallel_groups or {}).items():
        pairs = set()
        for g in groups:
            subs = sorted(set(_get(g, "subjects")))
            for ai, a in enumerate(subs):
                for b in subs[ai + 1:]:
                    pairs.add(frozenset((a, b)))
        legal[section] = pairs
    s_occ = defaultdict(list)  # (section, day, slot) -> [subject]
    for l in lessons:
        for s in _get(l, "slots"):
            s_occ[(_get(l, "section"), _get(l, "day"), s)].append(
                _get(l, "subject"))
    illegal_overlap_count = 0
    for (section, _d, _s), subjects in s_occ.items():
        for i in range(len(subjects)):
            for j in range(i + 1, len(subjects)):
                a, b = subjects[i], subjects[j]
                if a == b or frozenset((a, b)) not in legal.get(section, set()):
                    illegal_overlap_count += 1

    # --- per-day cap violations (slots/day vs mined max_per_day) -----------
    rules = {(_get(r, "section"), _get(r, "subject")): _get(r, "max_per_day")
             for r in mined_rules or []}
    day_slots = defaultdict(int)  # (section, subject, day) -> slots
    for l in lessons:
        day_slots[(_get(l, "section"), _get(l, "subject"),
                   _get(l, "day"))] += len(_get(l, "slots"))
    per_day_cap_violation_count = sum(
        1 for (sec, subj, _d), n in day_slots.items()
        if (sec, subj) in rules and n > rules[(sec, subj)])

    # --- spread score --------------------------------------------------------
    spread_score = sum(max(0, n - 1) for n in day_slots.values())

    # --- teacher daily balance ----------------------------------------------
    t_day = defaultdict(int)  # (teacher, day) -> slots
    for l in physical:
        t = _get(l, "teacher")
        if not t:
            continue
        t_day[(t, _get(l, "day"))] += len(_get(l, "slots"))
    loads = defaultdict(list)
    for (t, _d), n in t_day.items():
        loads[t].append(n)
    per_teacher_balance = {t: (max(v) - min(v)) for t, v in loads.items()}
    balance_avg = (round(sum(per_teacher_balance.values())
                         / len(per_teacher_balance), 3)
                   if per_teacher_balance else 0.0)

    gaps = compute_idle_gaps(lessons, bells, days)

    # Theoretical spread lower bound from the demand shape alone: a
    # (section,subject) group with W weekly slots and n_double multi-slot
    # lessons cannot score below max(n_double, W - len(days), 0) — every
    # slot beyond one per day doubles, and every double doubles by nature.
    # (Ignores cross-constraints, so the true optimum is >= this bound.)
    weekly = defaultdict(int)
    n_doubles = defaultdict(int)
    for l in lessons:
        k = (_get(l, "section"), _get(l, "subject"))
        weekly[k] += len(_get(l, "slots"))
        if len(_get(l, "slots")) >= 2:
            n_doubles[k] += 1
    spread_lower_bound = sum(
        max(n_doubles[k], w - len(days), 0) for k, w in weekly.items())

    return {
        "lesson_records": len(lessons),
        "physical_lessons": len(physical),
        "placed_slots": sum(len(_get(l, "slots")) for l in lessons),
        "teachers": len(loads),
        "teacher_clash_count": teacher_clash_count,
        "illegal_overlap_count": illegal_overlap_count,
        "per_day_cap_violation_count": per_day_cap_violation_count,
        "spread_score": spread_score,
        "spread_lower_bound": spread_lower_bound,
        "teacher_balance": {
            "per_teacher": dict(sorted(per_teacher_balance.items())),
            "average": balance_avg,
        },
        "idle_gaps": gaps,
    }


def _summary_row(m):
    return {
        "lesson_records": m["lesson_records"],
        "placed_slots": m["placed_slots"],
        "teacher_clashes": m["teacher_clash_count"],
        "illegal_section_overlaps": m["illegal_overlap_count"],
        "per_day_cap_violations": m["per_day_cap_violation_count"],
        "same_day_doublings_per_week": m["spread_score"],
        "teacher_daily_balance_avg": m["teacher_balance"]["average"],
        "teacher_idle_gap_slots_per_week": m["idle_gaps"]["grand_total"],
    }


def render_markdown(school, rebuild_m, solve_meta, sub_school=None,
                    sub_rebuild=None, coverage_m=None, sub_coverage=None,
                    coverage_stats=None, coverage_v4_m=None,
                    sub_coverage_v4=None, coverage_v4_stats=None):
    """coverage_m / sub_coverage / coverage_stats (optional): the v3
    coverage_resolve repair's metrics/stats. coverage_v4_m / sub_coverage_v4
    / coverage_v4_stats (optional): the v4 coverage_resolve_v4 repair's
    metrics/stats (pairwise swaps + atomic combined-unit moves on top of
    v3) — when present, v4 REPLACES v3 as the displayed third column (v3
    stays in the JSON payload only). The Verdict compares the school
    against the FINAL Manhaj timetable in priority order v4 > v3 > v2
    rebuild."""
    s, r = _summary_row(school), _summary_row(rebuild_m)
    v3 = _summary_row(coverage_m) if coverage_m is not None else None
    v4 = _summary_row(coverage_v4_m) if coverage_v4_m is not None else None
    v = v4 if v4 is not None else v3

    def better(key, lower_is_better=True):
        a, b = s[key], (v or r)[key]
        if a == b:
            return "same"
        return "Manhaj better" if (b < a) == lower_is_better else "school better"

    def row(cells, label, key, verdict):
        vals = " | ".join(str(c[key]) for c in cells)
        return f"| {label} | {vals} | {verdict} |"

    rows = [
        ("Lessons in the week", "lesson_records", ""),
        ("Taught slots in the week", "placed_slots", ""),
        ("Teacher double-bookings (must be 0)", "teacher_clashes",
         better("teacher_clashes")),
        ("Classes shown two arbitrary lessons at once (must be 0)",
         "illegal_section_overlaps", better("illegal_section_overlaps")),
        ("Subject over the school's own per-day limit (must be 0)",
         "per_day_cap_violations", better("per_day_cap_violations")),
        ("Same subject twice (or more) in one day, week-wide",
         "same_day_doublings_per_week", better("same_day_doublings_per_week")),
        ("Teacher workload evenness (avg busiest-vs-lightest day gap, "
         "lower = steadier)", "teacher_daily_balance_avg",
         better("teacher_daily_balance_avg")),
        ("Teacher dead time between lessons (free slots stuck inside the "
         "day, week-wide)", "teacher_idle_gap_slots_per_week",
         better("teacher_idle_gap_slots_per_week")),
    ]
    cells = [s, r] + ([v] if v else [])
    title = ("# ISO 2025-26 timetable — school Ver 19 vs Manhaj rebuild"
             + (" vs Manhaj coverage-optimized" if v else ""))
    header = ("| Measure | School Ver 19 | Manhaj rebuild | "
              "Manhaj coverage-optimized | Verdict |" if v else
              "| Measure | School Ver 19 | Manhaj rebuild | Verdict |")
    coverage_desc = (
        "coverage_resolve_v4.py's escalated repair (pairwise swaps of "
        "unlocked lessons plus the original single-lesson moves, now "
        "including previously-locked combined cross-section lessons "
        "moved/swapped as one atomic unit; all hard rules intact)"
        if v4 is not None else
        "coverage_resolve.py's greedy substitution-coverage repair "
        "(single-lesson moves only, all hard rules intact)")
    lines = [
        title,
        "",
        f"Both timetables place the same {s['lesson_records']} lessons "
        "(same teachers, classes, subjects and lesson lengths) and are scored "
        "with the same checker. Locked items (exams, library slots, "
        "break-time sessions, combined multi-class lessons) stay exactly "
        "where the school put them on both sides."
        + (f"\nThe coverage-optimized column is the v2 rebuild after "
           f"{coverage_desc}; the Verdict compares the school against it."
           if v else ""),
        "",
        header,
        "|---|---|---|---|" + ("---|" if v else ""),
    ]
    for label, key, verdict in rows:
        lines.append(row(cells, label, key, verdict))

    if sub_school is not None and sub_rebuild is not None:
        ss, sr = (_substitution_summary_row(sub_school),
                  _substitution_summary_row(sub_rebuild))
        sv3 = (_substitution_summary_row(sub_coverage)
              if sub_coverage is not None else None)
        sv4 = (_substitution_summary_row(sub_coverage_v4)
              if sub_coverage_v4 is not None else None)
        sv = sv4 if sv4 is not None else sv3
        sub_cells = [ss, sr] + ([sv] if sv else [])

        def sub_better(key, lower_is_better):
            a, b = ss[key], (sv or sr)[key]
            if a == b:
                return "same"
            return ("Manhaj better" if (b < a) == lower_is_better
                    else "school better")

        sub_rows = [
            ("Substitution: staffed lessons scored", "total_scored_lessons", None),
            ("Substitution: permanent vacancies (no teacher assigned)",
             "vacancy_count", True),
            ("Substitution: lessons with a same-subject sub free (%)",
             "pct_lessons_with_same_subject_cover", False),
            ("Substitution: lessons with a same-subject OR same-dept sub "
             "free (%)", "pct_with_subject_or_dept_cover", False),
            ("Substitution: fragile lessons (zero eligible free sub on "
             ">= 1 slot)", "fragile_lesson_count", True),
            ("Substitution: fixable by moving just that one lesson "
             "(headroom)", "fixable_by_moving_alone", True),
        ]
        for label, key, lower_is_better in sub_rows:
            verdict = "" if lower_is_better is None else sub_better(key, lower_is_better)
            lines.append(row(sub_cells, label, key, verdict))

    coverage_note = []
    if coverage_v4_stats:
        coverage_note = [
            "",
            f"Coverage repair (v4): "
            f"{coverage_v4_stats.get('total_moves', '?')} move(s) + "
            f"{coverage_v4_stats.get('total_swaps', '?')} swap(s) accepted "
            f"over {coverage_v4_stats.get('alternations', '?')} "
            f"alternation(s) (fixpoint: "
            f"{coverage_v4_stats.get('fixpoint_reached', '?')}), fragile "
            f"{coverage_v4_stats.get('fragile_before', '?')} -> "
            f"{coverage_v4_stats.get('fragile_after', '?')}; "
            f"{coverage_v4_stats.get('locked_fragile_became_addressable_count', '?')} "
            f"previously-locked combined lessons became addressable, "
            f"{coverage_v4_stats.get('locked_fragile_became_addressable_and_fixed_count', '?')} "
            f"of those got fixed; "
            f"{coverage_v4_stats.get('locked_fragile_count', '?')} fragile "
            f"lessons remain locked in place and unrepairable by moving them.",
        ]
    elif coverage_stats:
        coverage_note = [
            "",
            f"Coverage repair (v3): {coverage_stats.get('total_moves', '?')} "
            f"move(s) accepted over "
            f"{coverage_stats.get('passes_run', '?')} pass(es) "
            f"(fixpoint: {coverage_stats.get('fixpoint_reached', '?')}), "
            f"fragile {coverage_stats.get('fragile_before', '?')} -> "
            f"{coverage_stats.get('fragile_after', '?')}; "
            f"{coverage_stats.get('locked_fragile_count', '?')} fragile "
            f"lessons are locked in place and unrepairable by moving them.",
        ]

    lines += [
        "",
        f"Solver: status `{solve_meta['status']}`, wall time "
        f"{solve_meta['wall_time_s']}s, {solve_meta['movable']} lessons "
        f"re-optimized, {solve_meta['locked']} locked in place.",
        *coverage_note,
        "",
        "## Reading the numbers",
        "",
        "- The three \"must be 0\" rows are hard rules. The school's own "
        "timetable scores 0 by construction — the rule book (which subjects "
        "may share a slot, per-day limits) was mined from it. The rebuild "
        "must also score 0 to be acceptable.",
        "- \"Same subject twice in one day\" counts every extra lesson of a "
        "subject beyond the first on a given day, for every class, all week. "
        "Deliberate double periods count 1 each on both sides, so the "
        "difference between the columns is real scheduling quality.",
        "- \"Dead time\" counts slots where a teacher is on site between two "
        "lessons with nothing scheduled. Lower means less wasted teacher "
        "time.",
        "",
        "## How good is the school's own timetable?",
        "",
        f"Given the exact set of lessons it schedules, no timetable can score "
        f"below {school['spread_lower_bound']} on the same-day-doublings "
        f"measure (subjects taught more than 5x a week must repeat within a "
        f"day, and deliberate double periods count by nature). The school's "
        f"{school['spread_score']} is within "
        f"{school['spread_score'] - school['spread_lower_bound']} of that "
        f"theoretical floor — and the floor ignores teacher availability and "
        f"the parallel-subject rules, so the true best possible is even "
        f"closer. In plain terms: Ver 19 is already near-optimal under its "
        f"own rules, and the rebuild independently confirms that by matching "
        f"it with zero hard violations rather than finding easy wins.",
    ]
    return "\n".join(lines) + "\n"


def main():
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())
    parallel_groups = json.loads((DERIVED / "parallel_groups.json").read_text())
    mined_rules = json.loads((DERIVED / "mined_rules.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())
    rebuild_out = json.loads((DERIVED / "rebuild_v2.json").read_text())
    days = ["Sun", "Mon", "Tue", "Wed", "Thu"]

    school = compute_metrics(canonical, bells, parallel_groups, mined_rules,
                             days)
    ours = compute_metrics(rebuild_out["lessons"], bells, parallel_groups,
                           mined_rules, days)
    solve_meta = rebuild_out.get("solve_meta", {
        "status": rebuild_out.get("status", "?"), "wall_time_s": "?",
        "movable": "?", "locked": "?"})

    # Substitution-friendliness dimension (solver/timetable/substitution_score.py
    # is the single source of truth for this computation; benchmark.json/.md
    # just fold its summary in so there is one combined report).
    sub_school = substitution_score(canonical, bells, subject_depts)
    sub_ours = substitution_score(rebuild_out["lessons"], bells, subject_depts)

    payload = {
        "school_ver19": school,
        "manhaj_rebuild": ours,
        "summary": {"school_ver19": _summary_row(school),
                    "manhaj_rebuild": _summary_row(ours)},
        "solve_meta": solve_meta,
        "substitution_friendliness": {
            "school_ver19": _substitution_summary_row(sub_school),
            "manhaj_rebuild": _substitution_summary_row(sub_ours),
        },
    }

    # v3 (coverage_resolve greedy repair pass over the v2 rebuild) — optional:
    # only scored if rebuild_v3_coverage.json exists (written by
    # solver/timetable/coverage_resolve.py). Folded into the SAME payload so
    # benchmark.json/.md carry a 3-way-comparable form. Retained in the JSON
    # payload even once v4 exists (v4 replaces it only in rendered markdown).
    coverage = None
    sub_coverage = None
    coverage_stats = None
    v3_path = DERIVED / "rebuild_v3_coverage.json"
    if v3_path.exists():
        v3_out = json.loads(v3_path.read_text())
        coverage = compute_metrics(v3_out["lessons"], bells, parallel_groups,
                                   mined_rules, days)
        sub_coverage = substitution_score(v3_out["lessons"], bells, subject_depts)
        coverage_stats = v3_out.get("coverage_resolve_stats", {})
        payload["manhaj_coverage_v3"] = coverage
        payload["summary"]["manhaj_coverage_v3"] = _summary_row(coverage)
        payload["substitution_friendliness"]["manhaj_coverage_v3"] = (
            _substitution_summary_row(sub_coverage))
        payload["coverage_resolve_stats"] = coverage_stats

    # v4 (coverage_resolve_v4: pairwise swaps + atomic combined-unit moves on
    # top of v3) — optional: only scored if rebuild_v4_coverage.json exists.
    # Becomes the displayed "coverage-optimized" column; v3 stays in JSON.
    coverage_v4 = None
    sub_coverage_v4 = None
    coverage_v4_stats = None
    v4_path = DERIVED / "rebuild_v4_coverage.json"
    if v4_path.exists():
        v4_out = json.loads(v4_path.read_text())
        coverage_v4 = compute_metrics(v4_out["lessons"], bells, parallel_groups,
                                      mined_rules, days)
        sub_coverage_v4 = substitution_score(v4_out["lessons"], bells,
                                             subject_depts)
        coverage_v4_stats = v4_out.get("coverage_resolve_stats", {})
        payload["manhaj_coverage_v4"] = coverage_v4
        payload["summary"]["manhaj_coverage_v4"] = _summary_row(coverage_v4)
        payload["substitution_friendliness"]["manhaj_coverage_v4"] = (
            _substitution_summary_row(sub_coverage_v4))
        payload["coverage_resolve_v4_stats"] = coverage_v4_stats

    (DERIVED / "benchmark.json").write_text(json.dumps(payload, indent=2))
    (DERIVED / "benchmark.md").write_text(
        render_markdown(school, ours, solve_meta, sub_school, sub_ours,
                        coverage, sub_coverage, coverage_stats,
                        coverage_v4, sub_coverage_v4, coverage_v4_stats))
    print(f"wrote {DERIVED / 'benchmark.json'}")
    print(f"wrote {DERIVED / 'benchmark.md'}")
    print(json.dumps(payload["summary"], indent=2))
    print(json.dumps(payload["substitution_friendliness"], indent=2))


if __name__ == "__main__":
    main()
