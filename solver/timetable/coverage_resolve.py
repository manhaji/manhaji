#!/usr/bin/env python3
"""COVERAGE-RESOLVE: a deterministic greedy repair pass that starts from an
existing timetable placement (e.g. the v2 CP-SAT rebuild) and tries to
improve tier-1 (same-subject) substitution coverage — see
solver/timetable/substitution_score.py for the coverage metric itself and
solver/timetable/v2core.py for the hard-rule authority this module mirrors.

This is intentionally NOT a monolithic re-optimizer: it is a lightweight,
fully-deterministic greedy pass. It only ever considers moving ONE fragile
lesson at a time to ONE alternative (day, slot-run) within its own band, and
only accepts a move that both fixes the lesson itself and never strips tier-1
cover from any other lesson.

ALGORITHM (see resolve_coverage() below for the exact mechanics):

1. Score the current placement with substitution_score.score(). The repair
   target is `covered_same_subject is False` (tier-1 fragile) lessons;
   tier-2/department-only cover is reported in the final stats but never
   chased by a move.
2. Within one pass, iterate fragile lessons in a FIXED, DOCUMENTED order:
   sorted by (section, subject, day, tuple(slots)) of their placement at the
   START of the pass. A lesson that became covered by an EARLIER move in the
   same pass (side-effect repair) is skipped, not moved.
3. Locked lessons are NEVER moved. A lesson is locked if its INPUT record
   says locked (rebuild_v2.json's flags are authoritative) OR
   v2core.detect_locks flags it (non_teaching, break-slot source data,
   combined cross-section) — belt and braces; on the real rebuild output the
   two coincide. If a locked lesson is still tier-1 uncovered at the END of
   the run it is reported in coverage_resolve_stats["locked_fragile"] /
   ["locked_fragile_count"] — never silently treated as fixed.
4. For each movable fragile lesson, enumerate every candidate (day, run) in
   its OWN band via the same legal contiguous-run rule as v2core
   (substitution_score._band_teaching_runs, reused verbatim), for every day
   in `days` order, runs in bell-table row order, EXCLUDING its current
   (day, slots). A candidate must pass ALL hard rules, checked against the
   CURRENT working placement with this lesson notionally removed from its
   old slot:
     (i)   teacher clash-free — BOTH wall-clock (cross-band clock overlap;
           the physical reality substitution cover relies on) AND slot-LABEL
           (benchmark.py's hard teacher-clash metric keys on
           (teacher, day, slot label) across bands, and the real bell tables
           contain same-label DISJOINT-clock slots, e.g. KG P5 11:55-12:35
           vs GR1_6 P5 11:15-11:55), against every OTHER lesson currently
           placed, locked or movable, non_teaching included (locks consume
           occupancy, exactly as in v2core).
     (ii)  section-overlap legality at the target: no same-subject lesson of
           this section already there, and any different-subject lesson
           already there must form a legal parallel pair per parallel_groups.
     (iii) mined per-day cap respected at the target day (the vacated day
           only decreases; a same-day move keeps the day total unchanged
           because candidates have the lesson's own run length).
     (iv)  band grid — automatically satisfied, since candidates are drawn
           from _band_teaching_runs for the lesson's own band.
5. Among LEGAL candidates (in the fixed order from step 4), accept the FIRST
   one that:
     (a) makes the lesson itself tier-1 covered at EVERY slot of the new
         position. Checked twice: a cheap exact pre-filter (a same-subject
         candidate other than the lesson's own teacher, free per the
         metric's wall-clock semantics, at every slot of the run — exact
         because moving this lesson never changes any OTHER teacher's
         freeness), then confirmed on a full substitution_score.score() of
         the hypothetical after-move placement.
     (b) strips tier-1 cover from NO other lesson: diffing
         covered_same_subject over ALL scored lessons (positionally aligned
         before/after full rescores), no lesson other than the moved one may
         go covered -> uncovered. This is deliberately STRONGER than "total
         covered count must not decrease": a move that fixes itself while
         breaking another lesson is churn, not improvement, and the
         no-victim rule makes every accepted move increase the school-wide
         covered count by >= 1, giving a strictly-increasing bounded
         potential — termination is guaranteed, the pass cap is a
         belt-and-braces guard. The global diff also catches victims reached
         through the moved teacher's OTHER subjects (teacher teaches Math
         and Physics; moving a Physics lesson can strip a Math lesson's
         cover) and victims in other bands via wall-clock overlap —
         "be generous with the affected set" taken to its correct limit,
         the whole school. Correctness over speed: one full score() per
         candidate that survives the cheap (a) pre-filter (~0.7 s on the
         real 1920-lesson data), which keeps the real run in minutes.
   If no candidate satisfies both (a) and (b), the lesson is left in place.
6. The accepted move (if any) is applied immediately to the WORKING
   placement list before continuing to the next fragile lesson in this same
   pass — moves compound within a pass, and the coverage baseline for (b)
   is refreshed from the accepted move's own rescore.
7. Repeat full passes (re-scoring fresh each pass) until a full pass makes
   ZERO moves (fixpoint), capped at MAX_PASSES total passes.

CLI: read rebuild_v2.json + derived inputs, run the repair pass, write
rebuild_v3_coverage.json (same shape as rebuild_v2.json plus
"coverage_moves" and "coverage_resolve_stats").

    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/coverage_resolve.py
"""
import json
import time
from collections import defaultdict
from pathlib import Path

from solver.timetable.substitution_score import (
    DAYS as DEFAULT_DAYS,
    _band_teaching_runs,
    _build_wallclock_index,
    _get,
    _overlaps,
    score,
)
from solver.timetable.v2core import band_of, detect_locks
from solver.timetable.v2models import PlacedLesson

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

MAX_PASSES = 5


# ---------------------------------------------------------------------------
# Lock detection — input `locked` flags are authoritative (rebuild_v2.json),
# additionally unioned with v2core.detect_locks (reused verbatim, never
# reimplemented) as a belt-and-braces guard.
# ---------------------------------------------------------------------------

def _locked_flags(lessons, bells):
    band_teaching = {band: {_get(r, "slot") for r in rows if _get(r, "teaching")}
                     for band, rows in bells.items()}
    objs = [PlacedLesson(section=_get(l, "section"), day=_get(l, "day"),
                         slots=list(_get(l, "slots")),
                         subject=_get(l, "subject"),
                         teacher=_get(l, "teacher"),
                         non_teaching=bool(_get(l, "non_teaching", False)),
                         unstaffed=bool(_get(l, "unstaffed", False)))
            for l in lessons]
    reasons = detect_locks(objs, band_teaching)
    return [bool(_get(l, "locked", False)) or (r is not None)
            for l, r in zip(lessons, reasons)]


# ---------------------------------------------------------------------------
# Hard-rule legality + cheap coverage checks for ONE candidate move,
# mirroring v2core's constraints (checked against the CURRENT working
# placement — this module only ever verifies, never searches a CP model).
# ---------------------------------------------------------------------------

def _legal_pairs_for(parallel_groups):
    """Mirror v2core's legal_pairs construction: section -> set of
    frozenset({subjectA, subjectB}) pairs that may legally co-occur."""
    legal_pairs = {}
    for section, groups in (parallel_groups or {}).items():
        pairs = set()
        for g in groups:
            subs = sorted(set(_get(g, "subjects")))
            for ai, a in enumerate(subs):
                for b in subs[ai + 1:]:
                    pairs.add(frozenset((a, b)))
        legal_pairs[section] = pairs
    return legal_pairs


def _mined_caps(mined_rules):
    return {(_get(r, "section"), _get(r, "subject")): _get(r, "max_per_day")
            for r in (mined_rules or [])}


class _WorkingIndex:
    """Occupancy indexes over the CURRENT working placement, rebuilt once per
    fragile lesson considered, so every candidate check for that lesson sees
    a consistent snapshot (the mover's own old occupancy is excluded
    explicitly per check, never removed from the index)."""

    def __init__(self, lessons, bells):
        self.wallclock = _build_wallclock_index(bells)
        # (teacher, day) -> list of (band, slot, non_teaching flag)
        self.teacher_occ = defaultdict(list)
        # (section, day, slot) -> list of subject
        self.section_occ = defaultdict(list)
        # (section, subject, day) -> slot count
        self.day_slot_count = defaultdict(int)
        for l in lessons:
            band = band_of(_get(l, "section"))
            day = _get(l, "day")
            teacher = _get(l, "teacher")
            subject = _get(l, "subject")
            section = _get(l, "section")
            slots = _get(l, "slots")
            non_teaching = bool(_get(l, "non_teaching", False))
            if teacher:
                for s in slots:
                    self.teacher_occ[(teacher, day)].append(
                        (band, s, non_teaching))
            for s in slots:
                self.section_occ[(section, day, s)].append(subject)
            self.day_slot_count[(section, subject, day)] += len(slots)

    def teacher_free_hard(self, teacher, day, band, slot,
                          exclude_day, exclude_band, exclude_slots):
        """Hard-rule freeness for the MOVER's own teacher: busy if any other
        lesson of theirs (non_teaching included — locks consume occupancy)
        overlaps by wall-clock OR shares the slot LABEL on that day (any
        band — benchmark's clash metric is label-based across bands)."""
        window = self.wallclock.get((band, slot))
        for (obs_band, obs_slot, _nt) in self.teacher_occ.get((teacher, day), ()):
            if (day == exclude_day and obs_band == exclude_band
                    and obs_slot in exclude_slots):
                continue  # the mover's own current occupancy
            if obs_slot == slot:
                return False  # label clash (cross-band label collision)
            if window is None:
                continue
            obs_window = self.wallclock.get((obs_band, obs_slot))
            if obs_window is None:
                continue
            if _overlaps(window[0], window[1], obs_window[0], obs_window[1]):
                return False
        return True

    def teacher_free_metric(self, teacher, day, band, slot):
        """Substitute-candidate freeness, exactly substitution_score's
        semantics: wall-clock only, non_teaching lessons ignored. Never
        needs a self-exclusion — it is only called for teachers OTHER than
        the mover's own, whose occupancy a move never changes."""
        window = self.wallclock.get((band, slot))
        if window is None:
            return True
        for (obs_band, obs_slot, nt) in self.teacher_occ.get((teacher, day), ()):
            if nt:
                continue
            obs_window = self.wallclock.get((obs_band, obs_slot))
            if obs_window is None:
                continue
            if _overlaps(window[0], window[1], obs_window[0], obs_window[1]):
                return False
        return True

    def section_subjects_excluding(self, section, day, slot,
                                   exclude_day, exclude_slots,
                                   exclude_subject):
        """Subjects occupying (section, day, slot) other than the moved
        lesson's own current occupancy."""
        subs = list(self.section_occ.get((section, day, slot), ()))
        if day == exclude_day and slot in exclude_slots:
            # remove exactly one occurrence of the mover's own subject (its
            # current placement), not every same-subject record.
            try:
                subs.remove(exclude_subject)
            except ValueError:
                pass
        return subs

    def day_count_excluding(self, section, subject, day, exclude_day,
                            exclude_len):
        n = self.day_slot_count.get((section, subject, day), 0)
        if day == exclude_day:
            n -= exclude_len
        return n


def _candidate_legal(idx, lesson, alt_day, run, legal_pairs, caps):
    """ALL hard rules for moving `lesson` to (alt_day, run), against the
    working index (which still contains the lesson's old occupancy — that is
    excluded explicitly via exclude_day/exclude_slots)."""
    section = _get(lesson, "section")
    subject = _get(lesson, "subject")
    teacher = _get(lesson, "teacher")
    band = band_of(section)
    old_day = _get(lesson, "day")
    old_slots = tuple(_get(lesson, "slots"))

    # (i) teacher clash-free (wall-clock AND label, see _WorkingIndex)
    if teacher:
        for s in run:
            if not idx.teacher_free_hard(
                    teacher, alt_day, band, s,
                    exclude_day=old_day, exclude_band=band,
                    exclude_slots=old_slots):
                return False

    # (ii) section-overlap legality
    pairs = legal_pairs.get(section, set())
    for s in run:
        others = idx.section_subjects_excluding(
            section, alt_day, s, exclude_day=old_day,
            exclude_slots=old_slots, exclude_subject=subject)
        for other_subj in others:
            if other_subj == subject:
                return False  # a subject never overlaps itself
            if frozenset((subject, other_subj)) not in pairs:
                return False  # not a legal parallel pair

    # (iii) mined per-day cap at the target day (vacated day only decreases;
    # same-day moves keep the total constant since run length == old length)
    if (section, subject) in caps:
        cap = caps[(section, subject)]
        target_count = idx.day_count_excluding(
            section, subject, alt_day, exclude_day=old_day,
            exclude_len=len(old_slots))
        if target_count + len(run) > cap:
            return False

    return True


def _cheap_tier1_cover(idx, lesson, alt_day, run, tier1_teachers):
    """(a) pre-filter, exact: at every slot of the candidate run there must
    be >= 1 same-subject teacher (other than the lesson's own) free per the
    metric's semantics. Exact because a move never changes any OTHER
    teacher's occupancy (still confirmed on the full rescore afterwards)."""
    subject = _get(lesson, "subject")
    teacher = _get(lesson, "teacher")
    band = band_of(_get(lesson, "section"))
    pool = tier1_teachers.get(subject, ())
    for s in run:
        if not any(c != teacher
                   and idx.teacher_free_metric(c, alt_day, band, s)
                   for c in pool):
            return False
    return True


def _band_days_runs(bells, band, length, days):
    """All (day, run) candidate positions: days in `days` order, runs in
    _band_teaching_runs order (bell-table row order) — the documented
    deterministic candidate order."""
    runs = _band_teaching_runs(bells, band, length)
    return [(d, run) for d in days for run in runs]


def resolve_coverage(lessons, bells, subject_depts, parallel_groups,
                     mined_rules, days=None, max_passes=MAX_PASSES):
    """Deterministic greedy tier-1 coverage repair. See module docstring for
    the full algorithm. Returns a dict:
        {
          "lessons": [...],                 # repaired working placement
          "coverage_moves": [...],          # one entry per accepted move
          "coverage_resolve_stats": {...},
        }
    """
    days = list(days) if days is not None else list(DEFAULT_DAYS)
    legal_pairs = _legal_pairs_for(parallel_groups)
    caps = _mined_caps(mined_rules)

    # Working copy — plain dicts, mutated in place as moves apply. Input is
    # never mutated (dict() copies; "slots" is only ever rebound, not
    # mutated in place).
    working = [dict(l) if isinstance(l, dict) else {
        "section": _get(l, "section"), "day": _get(l, "day"),
        "slots": list(_get(l, "slots")), "subject": _get(l, "subject"),
        "teacher": _get(l, "teacher"),
        "non_teaching": bool(_get(l, "non_teaching", False)),
        "unstaffed": bool(_get(l, "unstaffed", False)),
        "locked": bool(_get(l, "locked", False)),
        "lock_reason": _get(l, "lock_reason"),
    } for l in lessons]

    locked = _locked_flags(working, bells)

    # score() scans the input in order and scores exactly the staffed
    # teaching lessons -> positional alignment between `working`'s scoped
    # sublist and score()["lessons"] is stable across moves (moves change
    # day/slots only, never scope membership or order).
    scope_pos = [i for i, l in enumerate(working)
                 if not l.get("non_teaching") and l.get("teacher") is not None]
    scope_index_of = {i: k for k, i in enumerate(scope_pos)}

    # Static tier-1 pools: subjects_by_teacher never changes under moves
    # (same teachers keep teaching the same subjects, just elsewhere).
    tier1_teachers = defaultdict(set)
    for i in scope_pos:
        tier1_teachers[working[i]["subject"]].add(working[i]["teacher"])

    initial = score(working, bells, subject_depts)
    fragile_before = sum(1 for e in initial["lessons"]
                         if not e["covered_same_subject"])

    coverage_moves = []
    moves_per_pass = []
    rejects = {"hard_rule": 0, "no_cover_cheap": 0, "no_cover_confirmed": 0,
               "victim": 0}
    passes_run = 0
    fixpoint_reached = False
    current = initial

    for pass_n in range(1, max_passes + 1):
        passes_run = pass_n
        if pass_n > 1:
            current = score(working, bells, subject_depts)
        cur_flags = [e["covered_same_subject"] for e in current["lessons"]]

        # Documented deterministic order: pass-start (section, subject, day,
        # slots) of each still-uncovered scored lesson.
        targets = sorted(
            (i for k, i in enumerate(scope_pos) if not cur_flags[k]),
            key=lambda i: (working[i]["section"], working[i]["subject"],
                           working[i]["day"], tuple(working[i]["slots"])))

        moves_this_pass = 0
        for i in targets:
            k = scope_index_of[i]
            if cur_flags[k]:
                continue  # repaired earlier in this pass by a side effect
            l = working[i]
            if locked[i]:
                continue  # reported from the FINAL state below
            band = band_of(l["section"])
            old_day = l["day"]
            old_slots = tuple(l["slots"])

            idx = _WorkingIndex(working, bells)
            accepted = None
            for alt_day, run in _band_days_runs(bells, band, len(old_slots),
                                                days):
                if alt_day == old_day and tuple(run) == old_slots:
                    continue  # current placement is not an alternative
                if not _candidate_legal(idx, l, alt_day, run, legal_pairs,
                                        caps):
                    rejects["hard_rule"] += 1
                    continue
                if not _cheap_tier1_cover(idx, l, alt_day, run,
                                          tier1_teachers):
                    rejects["no_cover_cheap"] += 1
                    continue

                # Hypothetically apply, rescore in full, check (a) + (b).
                l["day"], l["slots"] = alt_day, list(run)
                trial = score(working, bells, subject_depts)
                l["day"], l["slots"] = old_day, list(old_slots)

                t_flags = [e["covered_same_subject"] for e in trial["lessons"]]
                if not t_flags[k]:
                    rejects["no_cover_confirmed"] += 1
                    continue  # (a) failed on the exact recompute
                if any(cur_flags[j] and not t_flags[j]
                       for j in range(len(cur_flags)) if j != k):
                    rejects["victim"] += 1
                    continue  # (b) failed: would strip someone's last cover

                accepted = (alt_day, list(run), trial, t_flags)
                break

            if accepted is not None:
                alt_day, run, trial, t_flags = accepted
                l["day"], l["slots"] = alt_day, run
                coverage_moves.append({
                    "lesson": {"section": l["section"],
                               "subject": l["subject"],
                               "teacher": l["teacher"],
                               "day": old_day, "slots": list(old_slots)},
                    "from": {"day": old_day, "slots": list(old_slots)},
                    "to": {"day": alt_day, "slots": list(run)},
                    "pass_n": pass_n,
                })
                moves_this_pass += 1
                # refresh the (b) baseline from the accepted move's rescore
                current, cur_flags = trial, t_flags

        moves_per_pass.append(moves_this_pass)
        if moves_this_pass == 0:
            fixpoint_reached = True
            break

    final = score(working, bells, subject_depts)
    final_flags = [e["covered_same_subject"] for e in final["lessons"]]
    fragile_after = sum(1 for f in final_flags if not f)

    locked_fragile = [
        {"section": working[i]["section"], "subject": working[i]["subject"],
         "teacher": working[i]["teacher"], "day": working[i]["day"],
         "slots": list(working[i]["slots"]),
         "lock_reason": working[i].get("lock_reason")}
        for k, i in enumerate(scope_pos)
        if locked[i] and not final_flags[k]
    ]

    stats = {
        "passes_run": passes_run,
        "fixpoint_reached": fixpoint_reached,
        "total_moves": len(coverage_moves),
        "moves_per_pass": moves_per_pass,
        "fragile_before": fragile_before,
        "fragile_after": fragile_after,
        "locked_fragile_count": len(locked_fragile),
        "locked_fragile": locked_fragile,
        "candidate_rejects": rejects,
        "fixable_by_moving_alone_before":
            initial["headroom"]["fixable_by_moving_alone"],
        "fixable_by_moving_alone_after":
            final["headroom"]["fixable_by_moving_alone"],
    }
    return {
        "lessons": working,
        "coverage_moves": coverage_moves,
        "coverage_resolve_stats": stats,
    }


def main():
    from datetime import datetime, timezone

    bells = json.loads((DERIVED / "bells.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())
    parallel_groups = json.loads((DERIVED / "parallel_groups.json").read_text())
    mined_rules = json.loads((DERIVED / "mined_rules.json").read_text())
    rebuild_v2 = json.loads((DERIVED / "rebuild_v2.json").read_text())

    t0 = time.time()
    result = resolve_coverage(
        rebuild_v2["lessons"], bells, subject_depts,
        parallel_groups, mined_rules, DEFAULT_DAYS)
    wall_time_s = round(time.time() - t0, 1)

    out = {
        "status": rebuild_v2["status"],
        "lessons": result["lessons"],
        # v2's CP-SAT objective (pre-repair; judge v3 itself via
        # benchmark.py / substitution_score.py)
        "quality": rebuild_v2["quality"],
        "gap_report": rebuild_v2["gap_report"] + [
            "coverage_resolve greedy repair applied on top of the v2 solve; "
            "the quality block is the v2 objective — judge v3 via "
            "benchmark.py / substitution_score.py"],
        "source": {
            "solver_version": rebuild_v2["source"]["solver_version"]
                              + "+coverage_resolve",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "solve_meta": rebuild_v2.get("solve_meta", {}),
        "coverage_moves": result["coverage_moves"],
        "coverage_resolve_stats": {
            **result["coverage_resolve_stats"],
            "wall_time_s": wall_time_s,
        },
    }
    out_path = DERIVED / "rebuild_v3_coverage.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"wrote {out_path}")
    stats_no_detail = {k: v for k, v in
                       out["coverage_resolve_stats"].items()
                       if k != "locked_fragile"}
    print(json.dumps(stats_no_detail, indent=2))


if __name__ == "__main__":
    main()
