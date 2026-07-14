#!/usr/bin/env python3
"""COVERAGE-RESOLVE v4: two sanctioned escalations on top of
solver/timetable/coverage_resolve.py's single-lesson greedy repair, which was
found EXHAUSTED on the real data (1 move; grids saturated; 5 legal
single-move candidates school-wide starting from rebuild_v3_coverage.json).

This module reuses coverage_resolve.py's legality checkers, no-victim global
rescore rule, and determinism conventions verbatim (imported, never
reimplemented) and adds:

ESCALATION 1 — pairwise swaps. For each fragile UNIT F (unlocked), consider
swapping positions with a partner UNIT P (unlocked, SAME band, SAME
slot-length): F takes P's (day, slots), P takes F's. A swap is accepted iff:
  - both land HARD-LEGAL at their new positions, evaluated in the POST-SWAP
    state (both moves applied simultaneously) — NOT as two independent
    single moves. Same-teacher F/P pairs are fine (checked with both units'
    occupancy already relocated).
  - all four hard rules hold for both units (teacher clash-free wall-clock
    AND label; section-overlap legality for every member section; per-day
    caps for every member section+subject; band grid, automatically
    satisfied since F/P share a band and length by construction).
  - the global no-victim rule: diffing covered_same_subject over every
    scored lesson (same rule as v3's single-move pass), with the NET
    tier-1-covered count STRICTLY increasing (stronger than "no lesson may
    flip covered->uncovered EXCEPT the swap's own two units" — the swap must
    make net positive progress, since a swap unlike a single move can fix
    one unit while un-fixing its partner and net to zero, which is churn).
  - deterministic ordering: fragile units iterated in the documented
    (min section, subject, day, slots) order; partner units are sorted the
    same way.
  - a cheap prefilter runs before any full rescore: F's target window (P's
    current day/slots) must have >= 1 free same-subject candidate post-swap,
    computed cheaply (mirrors coverage_resolve._cheap_tier1_cover, adapted
    for post-swap occupancy) — full rescores are reserved for survivors.

ESCALATION 2 — combined cross-section lessons become movable ATOMIC units.
Previously (coverage_resolve.py / v2core.detect_locks) a lesson recorded
identically (same teacher, day, slots, subject) in >= 2 sections was ALWAYS
locked at its source placement ("combined_cross_section"). Under this
escalation such a group is instead ONE atomic movable/swappable UNIT: every
member section-record relocates TOGETHER. Hard-legality must hold for EVERY
member section (overlap-catalog legality per section, per-day caps per
section+subject) plus the ONE shared teacher's clash-freeness. Members are
the same band BY CONSTRUCTION (one teacher physically teaching one lesson to
several sections at the same wall-clock slots implies a shared bell grid) —
this module asserts that invariant rather than silently trusting it.
Exam/Library (non_teaching) and B-slot (break_slot_source_data) lessons
REMAIN locked regardless of escalation 2 — those are school-fixed, not a
scheduling artifact.

RUN PROTOCOL: starting from rebuild_v3_coverage.json's placement, alternate
passes — a single-move pass (Escalation 2's atomic units now eligible, plus
the original single-lesson movable set), then a swap pass (Escalation 1,
also unit-aware) — repeating until one full alternation (move pass + swap
pass) makes ZERO changes, capped at MAX_ALTERNATIONS alternations.

CLI: read rebuild_v3_coverage.json + derived inputs, run both escalations,
write rebuild_v4_coverage.json (same shape as v3 plus "coverage_moves" now
containing {type: move|swap, ...} entries and updated stats).

    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/coverage_resolve_v4.py
"""
import json
import time
from collections import defaultdict
from pathlib import Path

from solver.timetable.coverage_resolve import (
    _band_days_runs,
    _legal_pairs_for,
    _mined_caps,
    _WorkingIndex,
)
from solver.timetable.substitution_score import (
    DAYS as DEFAULT_DAYS,
    _overlaps,
    score,
)
from solver.timetable.v2core import band_of

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

MAX_ALTERNATIONS = 6
MAX_PASSES_PER_MOVE_STAGE = 5


# ---------------------------------------------------------------------------
# Unit construction — Escalation 2's lock relaxation lives entirely here.
# ---------------------------------------------------------------------------

def build_units(lessons, bells):
    """Group `lessons` (list of dicts, positionally indexed) into atomic
    UNITS: a unit is either one lesson (idxs of length 1) or a combined
    cross-section group (idxs of length >= 2, same teacher/day/slots/subject
    recorded once per participating section).

    Lock precedence (mirrors v2core.detect_locks, MINUS the
    combined_cross_section case, which this escalation makes movable):
      1. non_teaching -> locked, reason "non_teaching"
      2. any slot not a teaching slot in the unit's band -> locked, reason
         "break_slot_source_data"
      3. otherwise -> movable (locked False), INCLUDING combined groups.

    Returns a list of unit dicts:
        {"idxs": [...], "band": str, "day": str, "slots": [...],
         "subject": str, "teacher": str|None, "locked": bool,
         "lock_reason": str|None}
    ordered by first-occurrence index (stable; callers re-sort as needed).
    """
    band_teaching = {band: {r["slot"] for r in rows if r["teaching"]}
                     for band, rows in bells.items()}

    # Group indices by physical identity for teacher-bearing lessons.
    combo = defaultdict(list)
    for i, l in enumerate(lessons):
        if l.get("teacher"):
            key = (l["teacher"], l["day"], tuple(l["slots"]), l["subject"])
            combo[key].append(i)

    grouped_idx = set()
    units = []
    for key, idxs in combo.items():
        if len(idxs) < 2:
            continue
        teacher, day, slots, subject = key
        bands = {band_of(lessons[i]["section"]) for i in idxs}
        assert len(bands) == 1, (
            f"combined unit {key} spans multiple bands {bands} — "
            "escalation 2 requires all members share one band by "
            "construction; refusing to treat this as one atomic unit")
        band = next(iter(bands))
        locked, reason = _unit_lock_reason(
            lessons, idxs, band, slots, band_teaching)
        units.append({
            "idxs": sorted(idxs), "band": band, "day": day,
            "slots": list(slots), "subject": subject, "teacher": teacher,
            "locked": locked, "lock_reason": reason,
        })
        grouped_idx.update(idxs)

    for i, l in enumerate(lessons):
        if i in grouped_idx:
            continue
        band = band_of(l["section"])
        locked, reason = _unit_lock_reason(
            lessons, [i], band, tuple(l["slots"]), band_teaching)
        units.append({
            "idxs": [i], "band": band, "day": l["day"],
            "slots": list(l["slots"]), "subject": l["subject"],
            "teacher": l.get("teacher"), "locked": locked,
            "lock_reason": reason,
        })

    units.sort(key=lambda u: u["idxs"][0])
    return units


def _unit_lock_reason(lessons, idxs, band, slots, band_teaching):
    """Lock precedence for one unit: non_teaching > break_slot_source_data >
    movable (combined_cross_section no longer locks under escalation 2).
    Uses the INPUT `locked`/`lock_reason` flags when present and truthy for
    non_teaching/break_slot cases (rebuild_v2/v3's authoritative flags),
    falling back to recomputation from the lesson shape otherwise — mirrors
    coverage_resolve.py's "input locked flags authoritative, unioned with
    detect_locks" rule, restricted to the two reasons this escalation does
    NOT relax."""
    any_non_teaching = any(lessons[i].get("non_teaching") for i in idxs)
    if any_non_teaching:
        return True, "non_teaching"
    if any(s not in band_teaching[band] for s in slots):
        return True, "break_slot_source_data"
    # Honor an authoritative input lock that is neither of the above reasons
    # only if it is NOT "combined_cross_section" (that specific reason is
    # exactly what escalation 2 relaxes); any other unrecognized reason is
    # treated conservatively as still-locked.
    input_reasons = {lessons[i].get("lock_reason") for i in idxs
                     if lessons[i].get("locked")}
    input_reasons.discard(None)
    input_reasons.discard("combined_cross_section")
    if input_reasons:
        return True, sorted(input_reasons)[0]
    return False, None


def _unit_sort_key(working, unit):
    """Documented deterministic order for units: (min section among
    members, subject, day, tuple(slots)) — the natural extension of
    coverage_resolve.py's (section, subject, day, slots) lesson order to a
    possibly-multi-section unit."""
    sections = sorted(working[i]["section"] for i in unit["idxs"])
    return (sections[0], unit["subject"], unit["day"], tuple(unit["slots"]))


# ---------------------------------------------------------------------------
# Legality helpers for a whole UNIT (one or more member section-records,
# sharing one teacher, relocating together).
# ---------------------------------------------------------------------------

def _unit_legal_at(idx, working, unit, alt_day, run, legal_pairs, caps):
    """ALL hard rules, for EVERY member section of `unit`, at (alt_day, run),
    against the working index (whose occupancy still reflects the unit's
    OLD placement — excluded explicitly per member, exactly like
    coverage_resolve._candidate_legal). Teacher clash-freeness is checked
    ONCE (shared teacher) using the unit's own old occupancy as the
    exclusion window (identical across all members by construction)."""
    old_day, old_slots = unit["day"], tuple(unit["slots"])
    teacher = unit["teacher"]
    band = unit["band"]

    if teacher:
        for s in run:
            if not idx.teacher_free_hard(
                    teacher, alt_day, band, s,
                    exclude_day=old_day, exclude_band=band,
                    exclude_slots=old_slots):
                return False

    for i in unit["idxs"]:
        l = working[i]
        section = l["section"]
        subject = l["subject"]
        pairs = legal_pairs.get(section, set())
        for s in run:
            others = idx.section_subjects_excluding(
                section, alt_day, s, exclude_day=old_day,
                exclude_slots=old_slots, exclude_subject=subject)
            for other_subj in others:
                if other_subj == subject:
                    return False
                if frozenset((subject, other_subj)) not in pairs:
                    return False
        if (section, subject) in caps:
            cap = caps[(section, subject)]
            target_count = idx.day_count_excluding(
                section, subject, alt_day, exclude_day=old_day,
                exclude_len=len(old_slots))
            if target_count + len(run) > cap:
                return False
    return True


def _apply_unit_move(working, unit, alt_day, run):
    for i in unit["idxs"]:
        working[i]["day"] = alt_day
        working[i]["slots"] = list(run)


def _cheap_tier1_cover_unit(idx, unit, alt_day, run, tier1_teachers):
    """(a) pre-filter for a unit: exact same reasoning as
    coverage_resolve._cheap_tier1_cover, applied to the unit's (single)
    subject/teacher — a unit shares one physical lesson (one subject, one
    teacher) across all its member sections, so the tier-1 cover check
    itself is identical regardless of member count."""
    subject, teacher, band = unit["subject"], unit["teacher"], unit["band"]
    pool = tier1_teachers.get(subject, ())
    for s in run:
        if not any(c != teacher and idx.teacher_free_metric(c, alt_day, band, s)
                   for c in pool):
            return False
    return True


# ---------------------------------------------------------------------------
# PASS 1 (per alternation): single-unit moves, atomic-unit aware.
# ---------------------------------------------------------------------------

def _move_pass(working, bells, subject_depts, legal_pairs, caps, days,
               tier1_teachers, alternation_n, max_passes=MAX_PASSES_PER_MOVE_STAGE):
    """Repeated single-unit-move sub-passes until a fixpoint (or cap),
    mirroring coverage_resolve.resolve_coverage's inner loop, generalized to
    move whole UNITS (so a previously-locked combined group can move as one
    piece). Returns (moves, sub_passes_run)."""
    moves = []
    scope_pos = [i for i, l in enumerate(working)
                 if not l.get("non_teaching") and l.get("teacher") is not None]
    scope_index_of = {i: k for k, i in enumerate(scope_pos)}

    for sub_pass in range(1, max_passes + 1):
        units = build_units(working, bells)
        current = score(working, bells, subject_depts)
        # positional map: scored-lesson index (in `working`) -> flag
        flag_by_idx = {}
        si = 0
        for i, l in enumerate(working):
            if not l.get("non_teaching") and l.get("teacher") is not None:
                flag_by_idx[i] = current["lessons"][si]["covered_same_subject"]
                si += 1

        def unit_fragile(u):
            return any(not flag_by_idx.get(i, True) for i in u["idxs"])

        targets = sorted(
            (u for u in units if not u["locked"] and unit_fragile(u)),
            key=lambda u: _unit_sort_key(working, u))

        moves_this_sub_pass = 0
        cur_flags_full = [e["covered_same_subject"] for e in current["lessons"]]
        for unit in targets:
            unit_positions = [scope_index_of[m] for m in unit["idxs"]
                              if m in scope_index_of]
            # re-derive current fragility (side-effect repairs skip)
            if not any(not cur_flags_full[p] for p in unit_positions):
                continue
            idx = _WorkingIndex(working, bells)
            accepted = None
            for alt_day, run in _band_days_runs(bells, unit["band"],
                                                len(unit["slots"]), days):
                if alt_day == unit["day"] and tuple(run) == tuple(unit["slots"]):
                    continue
                if not _unit_legal_at(idx, working, unit, alt_day, run,
                                      legal_pairs, caps):
                    continue
                if not _cheap_tier1_cover_unit(idx, unit, alt_day, run,
                                               tier1_teachers):
                    continue

                old_day, old_slots = unit["day"], list(unit["slots"])
                _apply_unit_move(working, unit, alt_day, run)
                trial = score(working, bells, subject_depts)
                _apply_unit_move(working, unit, old_day, old_slots)

                t_flags = [e["covered_same_subject"] for e in trial["lessons"]]
                unit_scope_positions = unit_positions
                if not all(t_flags[p] for p in unit_scope_positions):
                    continue  # (a) failed: unit itself not fully covered
                if any(cur_flags_full[j] and not t_flags[j]
                       for j in range(len(cur_flags_full))
                       if j not in unit_scope_positions):
                    continue  # (b) victim
                accepted = (alt_day, list(run), trial, t_flags)
                break

            if accepted is not None:
                alt_day, run, trial, t_flags = accepted
                old_day, old_slots = unit["day"], list(unit["slots"])
                _apply_unit_move(working, unit, alt_day, run)
                sections = sorted({working[i]["section"] for i in unit["idxs"]})
                moves.append({
                    "type": "move",
                    "sections": sections,
                    "subject": unit["subject"],
                    "teacher": unit["teacher"],
                    "from": {"day": old_day, "slots": list(old_slots)},
                    "to": {"day": alt_day, "slots": list(run)},
                    "alternation": alternation_n,
                })
                moves_this_sub_pass += 1
                cur_flags_full = t_flags

        if moves_this_sub_pass == 0:
            return moves, sub_pass
    return moves, max_passes


# ---------------------------------------------------------------------------
# PASS 2 (per alternation): pairwise swaps, atomic-unit aware.
# ---------------------------------------------------------------------------

def _post_swap_legal(idx, working, unit_a, unit_b, legal_pairs, caps):
    """Hard legality for BOTH units simultaneously relocated, evaluated
    against the POST-SWAP state: `idx` is a _WorkingIndex rebuilt from
    `working` AFTER both units' day/slots were already mutated to their new
    (swapped) homes, and unit_a/unit_b carry those same new day/slots. Each
    unit is checked against its OWN new position, excluding its OWN new
    occupancy (which is trivially present in `idx` since that's where it now
    sits) — this correctly handles same-teacher F/P pairs and same-section
    F/P pairs because `idx` reflects the true final occupancy: each old
    position is vacated by the swap, so nothing but the two units' own new
    records ever appears in the exclusion window."""
    for unit in (unit_a, unit_b):
        alt_day, run = unit["day"], tuple(unit["slots"])
        band = unit["band"]
        teacher = unit["teacher"]
        if teacher:
            for s in run:
                if not idx.teacher_free_hard(
                        teacher, alt_day, band, s,
                        exclude_day=alt_day, exclude_band=band,
                        exclude_slots=run):
                    return False
        for i in unit["idxs"]:
            l = working[i]
            section, subject = l["section"], l["subject"]
            pairs = legal_pairs.get(section, set())
            for s in run:
                others = idx.section_subjects_excluding(
                    section, alt_day, s, exclude_day=alt_day,
                    exclude_slots=run, exclude_subject=subject)
                for other_subj in others:
                    if other_subj == subject:
                        return False
                    if frozenset((subject, other_subj)) not in pairs:
                        return False
            if (section, subject) in caps:
                cap = caps[(section, subject)]
                target_count = idx.day_count_excluding(
                    section, subject, alt_day, exclude_day=alt_day,
                    exclude_len=len(run))
                if target_count + len(run) > cap:
                    return False
    return True


def _cheap_swap_prefilter(idx, unit_f, unit_p, tier1_teachers):
    """Cheap prefilter before any full rescore: F's target window (P's
    current day/slots, F's post-swap home) must have >= 1 free same-subject
    candidate, computed against the CURRENT (pre-swap) working index. This
    is a necessary-not-sufficient filter (it ignores that P's own occupancy
    vacates its old slot and that F's old slot becomes free for P) — it only
    exists to cheaply reject the bulk of hopeless pairs before paying for a
    full rescore, exactly like coverage_resolve._cheap_tier1_cover's role."""
    subject, teacher, band = unit_f["subject"], unit_f["teacher"], unit_f["band"]
    pool = tier1_teachers.get(subject, ())
    for s in unit_p["slots"]:
        if not any(c != teacher and c != unit_p["teacher"]
                   and idx.teacher_free_metric(c, unit_p["day"], band, s)
                   for c in pool):
            return False
    return True


def _cheap_swap_hard_legal(idx, working, unit_f, unit_p, legal_pairs, caps):
    """Cheap hard-legality prefilter for a swap, checked against the ONE
    pre-swap index (no per-candidate _WorkingIndex rebuild): both units'
    OWN old occupancy is excluded manually (double exclusion — F's and P's
    old (day, slots) may differ), simulating "both units already vacated
    their old homes" without mutating `working` or rebuilding the index.
    This is the SAME four hard rules coverage_resolve._candidate_legal
    checks for a single move, applied to both units against each other's
    new home — a necessary-not-sufficient filter (it does not yet cover the
    case where F and P's NEW homes interact with each other beyond simple
    vacate/occupy, which the full post-swap rescore still verifies), but it
    is exact enough to reject the overwhelming majority of candidates
    before paying for a full _WorkingIndex rebuild + score()."""
    f_exclude_day, f_exclude_slots = unit_f["day"], tuple(unit_f["slots"])
    p_exclude_day, p_exclude_slots = unit_p["day"], tuple(unit_p["slots"])

    def teacher_busy(teacher, day, band, slot):
        """True if `teacher` is busy at (day, band, slot) per the PRE-swap
        index, ignoring occupancy that belongs to F's or P's own old
        placement (both being vacated by this hypothetical swap)."""
        for (obs_band, obs_slot, _nt) in idx.teacher_occ.get((teacher, day), ()):
            if day == f_exclude_day and obs_band == unit_f["band"] \
                    and obs_slot in f_exclude_slots and teacher == unit_f["teacher"]:
                continue
            if day == p_exclude_day and obs_band == unit_p["band"] \
                    and obs_slot in p_exclude_slots and teacher == unit_p["teacher"]:
                continue
            if obs_slot == slot:
                return True
            window = idx.wallclock.get((band, slot))
            obs_window = idx.wallclock.get((obs_band, obs_slot))
            if window is None or obs_window is None:
                continue
            if _overlaps(window[0], window[1], obs_window[0], obs_window[1]):
                return True
        return False

    def _member_subject_for_section(unit, section):
        """The subject unit's OWN record at `section` teaches (a unit is one
        physical lesson: every member shares the unit's subject) — None if
        this unit has no member in that section."""
        for i in unit["idxs"]:
            if working[i]["section"] == section:
                return working[i]["subject"]
        return None

    def section_subjects(section, day, slot):
        """Occupants at (section, day, slot) per the PRE-swap index, minus
        one occurrence of F's and/or P's OWN subject at that section IF
        that unit's old (day, slot) is exactly this cell (i.e. that
        occupancy belongs to a unit being vacated by the swap, not to some
        unrelated third lesson that happens to share the cell)."""
        subs = list(idx.section_occ.get((section, day, slot), ()))
        if day == f_exclude_day and slot in f_exclude_slots:
            own = _member_subject_for_section(unit_f, section)
            if own is not None:
                try:
                    subs.remove(own)
                except ValueError:
                    pass
        if day == p_exclude_day and slot in p_exclude_slots:
            own = _member_subject_for_section(unit_p, section)
            if own is not None:
                try:
                    subs.remove(own)
                except ValueError:
                    pass
        return subs

    def day_count(section, subject, day):
        n = idx.day_slot_count.get((section, subject, day), 0)
        if day == f_exclude_day and section in {
                working[i]["section"] for i in unit_f["idxs"]}:
            f_len = sum(len(unit_f["slots"]) for i in unit_f["idxs"]
                       if working[i]["section"] == section
                       and working[i]["subject"] == subject)
            n -= f_len
        if day == p_exclude_day and section in {
                working[i]["section"] for i in unit_p["idxs"]}:
            p_len = sum(len(unit_p["slots"]) for i in unit_p["idxs"]
                       if working[i]["section"] == section
                       and working[i]["subject"] == subject)
            n -= p_len
        return n

    for unit, alt_day, run in ((unit_f, unit_p["day"], tuple(unit_p["slots"])),
                               (unit_p, unit_f["day"], tuple(unit_f["slots"]))):
        band, teacher = unit["band"], unit["teacher"]
        if teacher:
            for s in run:
                if teacher_busy(teacher, alt_day, band, s):
                    return False
        for i in unit["idxs"]:
            section, subject = working[i]["section"], working[i]["subject"]
            pairs = legal_pairs.get(section, set())
            for s in run:
                others = section_subjects(section, alt_day, s)
                for other_subj in others:
                    if other_subj == subject:
                        return False
                    if frozenset((subject, other_subj)) not in pairs:
                        return False
            if (section, subject) in caps:
                cap = caps[(section, subject)]
                if day_count(section, subject, alt_day) + len(run) > cap:
                    return False
    return True


def _swap_pass(working, bells, subject_depts, legal_pairs, caps, days,
              tier1_teachers, alternation_n):
    """One swap sub-pass: for each fragile unit F (unlocked, in documented
    order), try partner units P (unlocked, same band, same slot-length,
    sorted order), accept the FIRST swap that is hard-legal for both
    (post-swap state) and strictly net-increases tier-1 coverage with no
    victim. Returns (swaps, prefilter_count, rescore_count)."""
    swaps = []
    prefilter_count = 0
    rescore_count = 0

    units = build_units(working, bells)
    scope_pos = [i for i, l in enumerate(working)
                 if not l.get("non_teaching") and l.get("teacher") is not None]
    scope_index_of = {i: k for k, i in enumerate(scope_pos)}
    current = score(working, bells, subject_depts)
    cur_flags = [e["covered_same_subject"] for e in current["lessons"]]

    def unit_scope_positions(u):
        return [scope_index_of[m] for m in u["idxs"] if m in scope_index_of]

    def unit_fragile(u):
        positions = unit_scope_positions(u)
        return any(not cur_flags[p] for p in positions)

    movable_units = [u for u in units if not u["locked"]]
    targets = sorted((u for u in movable_units if unit_fragile(u)),
                     key=lambda u: _unit_sort_key(working, u))

    by_band_len = defaultdict(list)
    for u in movable_units:
        by_band_len[(u["band"], len(u["slots"]))].append(u)
    for key in by_band_len:
        by_band_len[key].sort(key=lambda u: _unit_sort_key(working, u))

    swapped_idxs = set()  # idxs already consumed by an accepted swap this pass
    # ONE index for the whole sub-pass's cheap checks — rebuilt only after an
    # accepted swap actually mutates `working` (see below). Both cheap
    # filters below are read-only against this snapshot; the expensive
    # per-candidate work (apply + rebuild + rescore) is reserved for
    # candidates that clear BOTH cheap filters.
    idx_pre = _WorkingIndex(working, bells)

    for unit_f in targets:
        if any(i in swapped_idxs for i in unit_f["idxs"]):
            continue
        band, length = unit_f["band"], len(unit_f["slots"])
        candidates = by_band_len.get((band, length), [])
        accepted = None
        for unit_p in candidates:
            if unit_p is unit_f:
                continue
            if any(i in swapped_idxs for i in unit_p["idxs"]):
                continue
            if (unit_p["day"] == unit_f["day"]
                    and tuple(unit_p["slots"]) == tuple(unit_f["slots"])):
                continue  # not a real swap
            # disjoint member sets required (no self-swap ambiguity)
            if set(unit_f["idxs"]) & set(unit_p["idxs"]):
                continue

            prefilter_count += 1
            if not _cheap_swap_prefilter(idx_pre, unit_f, unit_p,
                                         tier1_teachers):
                continue
            # Cheap hard-legality prefilter (no _WorkingIndex rebuild, no
            # mutation) — rejects the overwhelming majority of the tier-1
            # survivors before paying for an apply+rebuild+rescore.
            if not _cheap_swap_hard_legal(idx_pre, working, unit_f, unit_p,
                                         legal_pairs, caps):
                continue

            # Apply the swap hypothetically, then check hard legality
            # against a FRESH index built from the POST-SWAP working state
            # (the authoritative check — the cheap prefilter above is
            # necessary-not-sufficient by design).
            f_old_day, f_old_slots = unit_f["day"], list(unit_f["slots"])
            p_old_day, p_old_slots = unit_p["day"], list(unit_p["slots"])
            _apply_unit_move(working, unit_f, p_old_day, list(p_old_slots))
            _apply_unit_move(working, unit_p, f_old_day, list(f_old_slots))
            # refresh unit dicts' own day/slots bookkeeping for the check
            unit_f_new = dict(unit_f, day=p_old_day, slots=list(p_old_slots))
            unit_p_new = dict(unit_p, day=f_old_day, slots=list(f_old_slots))

            idx_post = _WorkingIndex(working, bells)
            legal = _post_swap_legal(idx_post, working,
                                     unit_f_new, unit_p_new, legal_pairs, caps)
            if not legal:
                _apply_unit_move(working, unit_f, f_old_day, f_old_slots)
                _apply_unit_move(working, unit_p, p_old_day, p_old_slots)
                continue

            rescore_count += 1
            trial = score(working, bells, subject_depts)
            t_flags = [e["covered_same_subject"] for e in trial["lessons"]]

            f_positions = unit_scope_positions(unit_f)
            p_positions = unit_scope_positions(unit_p)
            touched = set(f_positions) | set(p_positions)

            net_before = sum(1 for p in touched if cur_flags[p])
            net_after = sum(1 for p in touched if t_flags[p])
            victim_elsewhere = any(
                cur_flags[j] and not t_flags[j]
                for j in range(len(cur_flags)) if j not in touched)

            if victim_elsewhere or not (net_after > net_before):
                _apply_unit_move(working, unit_f, f_old_day, f_old_slots)
                _apply_unit_move(working, unit_p, p_old_day, p_old_slots)
                continue

            accepted = (unit_p, f_old_day, f_old_slots, p_old_day, p_old_slots,
                       trial, t_flags)
            break

        if accepted is not None:
            (unit_p, f_old_day, f_old_slots, p_old_day, p_old_slots,
             trial, t_flags) = accepted
            # working already holds the swapped state (last hypothetical
            # application in the loop above is the accepted one)
            swapped_idxs.update(unit_f["idxs"])
            swapped_idxs.update(unit_p["idxs"])
            a_sections = sorted({working[i]["section"] for i in unit_f["idxs"]})
            b_sections = sorted({working[i]["section"] for i in unit_p["idxs"]})
            swaps.append({
                "type": "swap",
                "a": {"sections": a_sections, "subject": unit_f["subject"],
                      "teacher": unit_f["teacher"],
                      "from": {"day": f_old_day, "slots": f_old_slots},
                      "to": {"day": p_old_day, "slots": p_old_slots}},
                "b": {"sections": b_sections, "subject": unit_p["subject"],
                      "teacher": unit_p["teacher"],
                      "from": {"day": p_old_day, "slots": p_old_slots},
                      "to": {"day": f_old_day, "slots": f_old_slots}},
                "alternation": alternation_n,
            })
            cur_flags = t_flags
            # `working` just mutated (the accepted swap) -- refresh the
            # cheap-check snapshot used by subsequent candidates this pass.
            idx_pre = _WorkingIndex(working, bells)

    return swaps, prefilter_count, rescore_count


# ---------------------------------------------------------------------------
# Driver: alternate move pass / swap pass until a full alternation is a
# no-op, capped at MAX_ALTERNATIONS.
# ---------------------------------------------------------------------------

def resolve_coverage_v4(lessons, bells, subject_depts, parallel_groups,
                        mined_rules, days=None,
                        max_alternations=MAX_ALTERNATIONS):
    days = list(days) if days is not None else list(DEFAULT_DAYS)
    legal_pairs = _legal_pairs_for(parallel_groups)
    caps = _mined_caps(mined_rules)

    working = [dict(l) if isinstance(l, dict) else {
        "section": l.section, "day": l.day, "slots": list(l.slots),
        "subject": l.subject, "teacher": l.teacher,
        "non_teaching": bool(l.non_teaching), "unstaffed": bool(l.unstaffed),
        "locked": bool(getattr(l, "locked", False)),
        "lock_reason": getattr(l, "lock_reason", None),
    } for l in lessons]

    scope_pos = [i for i, l in enumerate(working)
                 if not l.get("non_teaching") and l.get("teacher") is not None]
    tier1_teachers = defaultdict(set)
    for i in scope_pos:
        tier1_teachers[working[i]["subject"]].add(working[i]["teacher"])

    initial = score(working, bells, subject_depts)
    fragile_before = sum(1 for e in initial["lessons"]
                         if not e["covered_same_subject"])

    units0 = build_units(working, bells)
    locked_units0 = [u for u in units0 if u["locked"]]
    combined_units0 = [u for u in units0 if len(u["idxs"]) >= 2]

    # locked-fragile bookkeeping: which combined groups (locked under v3's
    # global rule) are locked here (should be none, other than
    # non_teaching/break_slot — already excluded from combined by
    # construction) — report how many previously-locked-fragile (v3 sense:
    # combined_cross_section) lessons are now addressable movable units.
    v3_locked_fragile_combined_idxs = set()
    combo_check = defaultdict(list)
    for i, l in enumerate(working):
        if l.get("teacher"):
            key = (l["teacher"], l["day"], tuple(l["slots"]), l["subject"])
            combo_check[key].append(i)
    combined_groups = {k: v for k, v in combo_check.items() if len(v) >= 2}
    init_flags = {}
    si = 0
    for i, l in enumerate(working):
        if not l.get("non_teaching") and l.get("teacher") is not None:
            init_flags[i] = initial["lessons"][si]["covered_same_subject"]
            si += 1
    locked_fragile_became_addressable = 0
    for key, idxs in combined_groups.items():
        if any(not init_flags.get(i, True) for i in idxs):
            locked_fragile_became_addressable += 1
            v3_locked_fragile_combined_idxs.update(idxs)

    all_moves = []
    all_swaps = []
    alternations_run = 0
    total_prefilter = 0
    total_rescore = 0
    moves_per_alternation = []
    swaps_per_alternation = []
    fixpoint_reached = False

    for alt_n in range(1, max_alternations + 1):
        alternations_run = alt_n
        t_alt0 = time.time()
        moves, _sub_passes = _move_pass(
            working, bells, subject_depts, legal_pairs, caps, days,
            tier1_teachers, alt_n)
        all_moves.extend(moves)
        moves_per_alternation.append(len(moves))
        t_move = time.time()
        print(f"[alternation {alt_n}] move pass: {len(moves)} move(s) in "
             f"{t_move - t_alt0:.1f}s", flush=True)

        swaps, prefilter_n, rescore_n = _swap_pass(
            working, bells, subject_depts, legal_pairs, caps, days,
            tier1_teachers, alt_n)
        all_swaps.extend(swaps)
        swaps_per_alternation.append(len(swaps))
        total_prefilter += prefilter_n
        total_rescore += rescore_n
        t_swap = time.time()
        print(f"[alternation {alt_n}] swap pass: {len(swaps)} swap(s), "
             f"{prefilter_n} prefiltered, {rescore_n} full rescores, in "
             f"{t_swap - t_move:.1f}s", flush=True)

        if len(moves) == 0 and len(swaps) == 0:
            fixpoint_reached = True
            break

    final = score(working, bells, subject_depts)
    final_flags = [e["covered_same_subject"] for e in final["lessons"]]
    fragile_after = sum(1 for f in final_flags if not f)

    final_units = build_units(working, bells)
    locked_fragile = []
    for u in final_units:
        if not u["locked"]:
            continue
        positions = [scope_pos.index(i) for i in u["idxs"] if i in scope_pos]
        if positions and any(not final_flags[p] for p in positions):
            for i in u["idxs"]:
                locked_fragile.append({
                    "section": working[i]["section"],
                    "subject": working[i]["subject"],
                    "teacher": working[i]["teacher"],
                    "day": working[i]["day"], "slots": list(working[i]["slots"]),
                    "lock_reason": u["lock_reason"],
                })

    # how many of the previously-locked-fragile combined units got FIXED
    # (covered at the end) vs still fragile.
    fixed_previously_locked = sum(
        1 for i in v3_locked_fragile_combined_idxs
        if i in scope_pos and final_flags[scope_pos.index(i)])

    stats = {
        "alternations": alternations_run,
        "fixpoint_reached": fixpoint_reached,
        "total_moves": len(all_moves),
        "total_swaps": len(all_swaps),
        "moves_per_alternation": moves_per_alternation,
        "swaps_per_alternation": swaps_per_alternation,
        "fragile_before": fragile_before,
        "fragile_after": fragile_after,
        "locked_fragile_count": len(set(
            (lf["section"], lf["subject"], lf["day"], tuple(lf["slots"]))
            for lf in locked_fragile)),
        "locked_fragile": locked_fragile,
        "locked_fragile_became_addressable_count":
            locked_fragile_became_addressable,
        "locked_fragile_became_addressable_and_fixed_count":
            fixed_previously_locked,
        "swap_prefilter_count": total_prefilter,
        "swap_rescore_count": total_rescore,
        "combined_units_total": len(combined_units0),
        "combined_units_locked_at_start": len(locked_units0),
        "fixable_by_moving_alone_before":
            initial["headroom"]["fixable_by_moving_alone"],
        "fixable_by_moving_alone_after":
            final["headroom"]["fixable_by_moving_alone"],
    }
    return {
        "lessons": working,
        "coverage_moves": all_moves + all_swaps,
        "coverage_resolve_stats": stats,
    }


def main():
    from datetime import datetime, timezone

    bells = json.loads((DERIVED / "bells.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())
    parallel_groups = json.loads((DERIVED / "parallel_groups.json").read_text())
    mined_rules = json.loads((DERIVED / "mined_rules.json").read_text())
    rebuild_v3 = json.loads((DERIVED / "rebuild_v3_coverage.json").read_text())

    t0 = time.time()
    result = resolve_coverage_v4(
        rebuild_v3["lessons"], bells, subject_depts,
        parallel_groups, mined_rules, DEFAULT_DAYS)
    wall_time_s = round(time.time() - t0, 1)

    out = {
        "status": rebuild_v3["status"],
        "lessons": result["lessons"],
        "quality": rebuild_v3["quality"],
        "gap_report": rebuild_v3["gap_report"] + [
            "coverage_resolve_v4 applied on top of v3 (pairwise swaps + "
            "atomic combined-unit moves); the quality block is still the "
            "v2 CP-SAT objective — judge v4 via benchmark.py / "
            "substitution_score.py"],
        "source": {
            "solver_version": rebuild_v3["source"]["solver_version"]
                              + "+coverage_resolve_v4",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "solve_meta": rebuild_v3.get("solve_meta", {}),
        "coverage_moves": result["coverage_moves"],
        "coverage_resolve_stats": {
            **result["coverage_resolve_stats"],
            "wall_time_s": wall_time_s,
        },
    }
    out_path = DERIVED / "rebuild_v4_coverage.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"wrote {out_path}")
    stats_no_detail = {k: v for k, v in
                       out["coverage_resolve_stats"].items()
                       if k != "locked_fragile"}
    print(json.dumps(stats_no_detail, indent=2))


if __name__ == "__main__":
    main()
