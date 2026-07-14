#!/usr/bin/env python3
"""SUBSTITUTION-FRIENDLINESS: a new benchmark dimension measuring how
resilient a timetable is to teacher absence.

Founder's definition: for every lesson taught, it's better if at least one
RELEVANT substitute is free at that time.

Metric definitions (judgment calls documented inline, mirroring
solver/timetable/benchmark.py's conventions):

- Scope: every STAFFED teaching lesson (teacher is not None, non_teaching is
  falsy). non_teaching lessons (Exam/Library) are out of scope entirely.
  Unstaffed teaching lessons (teacher is None, non_teaching falsy) are
  permanent vacancies — nobody to substitute FOR — counted separately as
  vacancy_count, never scored as fragile/covered.
- Candidate pool for a lesson L: every OTHER teacher string appearing
  anywhere in the timetable (composite co-teaching strings like "IBZ / H"
  are atomic resources, exactly like the rebuild solver treats them;
  teacher=None is never a candidate).
- FREE at (day d, slot p): candidate has no lesson (any band/section) whose
  WALL-CLOCK window on day d overlaps p's wall-clock window. This reuses the
  cross-band bridging insight from solver/adapter_2526.py — different bands
  have their own slot grids, but the grids share real clock time, so a
  teacher busy in one band's period is unavailable for a cover request in
  another band's period if the two periods' clock windows overlap AT ALL
  (not just identical windows — genuine overlap is enough to make someone
  unavailable). B1/B2 support/break lessons in the data count as busy at
  their recorded windows like any other lesson.
- RELEVANT tier 1 (same subject): candidate teaches L's subject SOMEWHERE
  in this timetable (evidence-based: we only trust qualifications the data
  itself demonstrates, not a claimed general subject competency).
- RELEVANT tier 2 (same department): dept(candidate's taught subjects) has
  nonempty intersection with dept(L.subject), via subject_departments.json.
  A subject absent from that map simply contributes no department (neither
  side) rather than raising an error; lessons_with_subject_missing_from_dept_map
  reports how many SCORED lessons have a subject absent from the map.
- Cover depth for one slot = count of free tier-1 candidates (and
  separately, free tier-1-or-tier-2 candidates).
- A multi-slot lesson is COVERED only if EVERY one of its slots independently
  has >= 1 eligible free candidate (subs may differ per period — no need for
  the same person to cover both slots).
- Fragile lesson: >= 1 of its slots has ZERO eligible free candidates at
  tier 1-or-2 (the weaker bar). We report which tier(s) fail:
  "tier1_only" (a tier-2 candidate rescues it, but no tier-1 candidate is
  free at some slot), or "both" (nobody relevant at all is free at some
  slot, at either tier).
- HEADROOM: for each fragile lesson, holding every other lesson fixed, does
  ANY alternative (day, slot-run) placement exist within the lesson's OWN
  band (same slot-run length, all-teaching contiguous run per v2core's
  legal-run rule) where a same-subject (tier-1) candidate is free at every
  slot of that alternative run, AND the lesson's own teacher is ALSO free
  there (a placement isn't real if the class's own teacher can't attend
  it) AND it isn't the lesson's current placement? This is a LOWER BOUND on
  what a coverage-aware re-solve could gain — it fixes only the single
  fragile lesson and re-checks tier 1 only; it does not explore moving any
  other lesson, and ignores section/subject legality and per-day caps
  entirely (those belong to the OTHER benchmark dimensions), so the true
  achievable improvement from a full re-solve is >= this count.

CLI: score BOTH the school Ver 19 placement and the Manhaj rebuild with this
one function, and write substitution_score.json + substitution_score.md
side by side, plain language.

    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/substitution_score.py
"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]


def _get(l, key, default=None):
    """Uniform access for dicts and pydantic-dumped objects."""
    return l.get(key, default) if isinstance(l, dict) else getattr(l, key, default)


def _band_of(section):
    from solver.timetable.v2core import band_of
    return band_of(section)


def _to_minutes(hhmm):
    """'8:00' / '11:15' -> minutes since midnight. Tolerant of 1- or 2-digit
    hours (source data uses 'H:MM', not zero-padded)."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def _build_wallclock_index(bells):
    """(band, slot) -> (start_min, end_min) for every row of every band's
    bell table (teaching AND non-teaching rows — B1/B2 support lessons in
    the actual lesson data occupy real clock time too and must be checked
    for collisions like any other lesson)."""
    idx = {}
    for band, rows in bells.items():
        for r in rows:
            slot = _get(r, "slot")
            start = _to_minutes(_get(r, "start"))
            end = _to_minutes(_get(r, "end"))
            idx[(band, slot)] = (start, end)
    return idx


def _band_teaching_runs(bells, band, length):
    """Legal contiguous teaching slot-runs of `length` within one band's
    bell table (same rule as v2core._band_runs: a break row anywhere inside
    the window kills the run)."""
    rows = bells[band]
    runs = []
    for i in range(len(rows) - length + 1):
        window = rows[i:i + length]
        if all(_get(r, "teaching") for r in window):
            runs.append(tuple(_get(r, "slot") for r in window))
    return runs


def score(lessons, bells, subject_depts):
    """Compute the substitution-friendliness metric for one timetable.

    lessons: list of lesson dicts/objects (section, day, slots, subject,
        teacher, non_teaching, unstaffed).
    bells: dict band -> list of {slot, start, end, teaching} rows.
    subject_depts: dict subject -> department string.

    Returns a dict; see module docstring for the exact semantics of every
    field.
    """
    wallclock = _build_wallclock_index(bells)

    # ---- index every lesson's occupancy, keyed by teacher, for the FREE
    # check: (teacher, day) -> list of (band, slot) they occupy that day.
    # Built from ALL teaching-relevant lessons in the timetable (skip only
    # non_teaching; unstaffed/vacancy lessons have no teacher so contribute
    # nothing here regardless).
    occ_by_teacher_day = defaultdict(list)
    # subjects taught by each teacher, anywhere in this timetable (tier 1
    # evidence) — built from staffed, non-non_teaching lessons only.
    subjects_by_teacher = defaultdict(set)
    all_teachers = set()

    scored_lessons = []  # lessons in scope (staffed teaching lessons)
    vacancy_count = 0

    for l in lessons:
        if _get(l, "non_teaching"):
            continue
        teacher = _get(l, "teacher")
        if teacher is None:
            vacancy_count += 1
            continue
        band = _band_of(_get(l, "section"))
        day = _get(l, "day")
        for s in _get(l, "slots"):
            occ_by_teacher_day[(teacher, day)].append((band, s))
        subjects_by_teacher[teacher].add(_get(l, "subject"))
        all_teachers.add(teacher)
        scored_lessons.append(l)

    # department(s) taught by each teacher (via subject_depts; a subject
    # absent from the map contributes no department at all).
    depts_by_teacher = {
        t: {subject_depts[s] for s in subs if s in subject_depts}
        for t, subs in subjects_by_teacher.items()
    }

    def is_free(teacher, day, band, slot):
        window = wallclock.get((band, slot))
        if window is None:
            return True  # slot not in the wall-clock index — nothing to collide with
        w_start, w_end = window
        for (obs_band, obs_slot) in occ_by_teacher_day.get((teacher, day), ()):
            obs_window = wallclock.get((obs_band, obs_slot))
            if obs_window is None:
                continue
            if _overlaps(w_start, w_end, obs_window[0], obs_window[1]):
                return False
        return True

    def eligible_free_candidates(lesson_teacher, subject, day, band, slot):
        """Returns (tier1_free_count, tier1_or_tier2_free_count)."""
        lesson_depts = subject_depts.get(subject)
        lesson_depts = {lesson_depts} if lesson_depts else set()
        tier1 = 0
        tier2_extra = 0
        for cand in all_teachers:
            if cand == lesson_teacher:
                continue
            if not is_free(cand, day, band, slot):
                continue
            cand_subjects = subjects_by_teacher.get(cand, set())
            if subject in cand_subjects:
                tier1 += 1
            elif lesson_depts and (depts_by_teacher.get(cand, set()) & lesson_depts):
                tier2_extra += 1
        return tier1, tier1 + tier2_extra

    lessons_with_missing_dept = 0
    per_slot_histogram_t1 = defaultdict(lambda: [0, 0])   # (day, slot) -> [ok, fragile]
    fragile_lessons = []
    out_lessons = []
    depth_t1_all = []
    depth_t1t2_all = []

    for l in scored_lessons:
        section = _get(l, "section")
        subject = _get(l, "subject")
        teacher = _get(l, "teacher")
        day = _get(l, "day")
        slots = _get(l, "slots")
        band = _band_of(section)

        if subject not in subject_depts:
            lessons_with_missing_dept += 1

        per_slot_t1 = {}
        per_slot_t1t2 = {}
        failing_slots = []
        for slot in slots:
            t1, t1t2 = eligible_free_candidates(teacher, subject, day, band, slot)
            per_slot_t1[slot] = t1
            per_slot_t1t2[slot] = t1t2
            ok_t1 = t1 >= 1
            hist = per_slot_histogram_t1[(day, slot)]
            if ok_t1:
                hist[0] += 1
            else:
                hist[1] += 1
            if t1t2 == 0:
                failing_slots.append(slot)

        min_t1 = min(per_slot_t1.values())
        min_t1t2 = min(per_slot_t1t2.values())
        covered_t1 = all(v >= 1 for v in per_slot_t1.values())
        covered_t1t2 = all(v >= 1 for v in per_slot_t1t2.values())

        depth_t1_all.append(min_t1)
        depth_t1t2_all.append(min_t1t2)

        entry = {
            "section": section, "subject": subject, "teacher": teacher,
            "day": day, "slots": list(slots),
            "per_slot_same_subject_depth": per_slot_t1,
            "per_slot_same_subject_or_dept_depth": per_slot_t1t2,
            "min_slot_same_subject_depth": min_t1,
            "min_slot_same_subject_or_dept_depth": min_t1t2,
            "covered_same_subject": covered_t1,
            "covered_same_subject_or_dept": covered_t1t2,
        }
        out_lessons.append(entry)

        # failing_slots are slots with zero tier-1-OR-2 free candidates
        # (t1t2 == 0), so t1 == 0 there too (t1 <= t1t2 always). A lesson
        # can ALSO be tier-1-fragile at a slot where tier-2 rescues it
        # (t1 == 0 but t1t2 >= 1) without that slot appearing in
        # failing_slots. "fails_tier" describes the failing_slots: if the
        # weaker (tier-1-or-2) bar fails anywhere, nobody relevant at any
        # tier is free there -> "both". If the weaker bar never fails but
        # covered_same_subject is still False, some OTHER slot rescued by
        # tier-2 caused the tier-1 miss -> "tier1_only".
        if failing_slots:
            fragile_lessons.append({
                "section": section, "subject": subject, "teacher": teacher,
                "day": day, "slots": list(slots),
                "failing_slots": failing_slots,
                "fails_tier": "both",
            })
        elif not covered_t1:
            # every slot cleared the tier-1-or-2 bar, but at least one slot
            # relies on a tier-2-only rescue (no tier-1 candidate there).
            fragile_lessons.append({
                "section": section, "subject": subject, "teacher": teacher,
                "day": day, "slots": list(slots),
                "failing_slots": [s for s in slots if per_slot_t1[s] == 0],
                "fails_tier": "tier1_only",
            })

    total_scored = len(scored_lessons)
    pct_same_subject = (100.0 * sum(1 for e in out_lessons if e["covered_same_subject"])
                        / total_scored) if total_scored else 0.0
    pct_subject_or_dept = (100.0 * sum(1 for e in out_lessons if e["covered_same_subject_or_dept"])
                           / total_scored) if total_scored else 0.0

    per_slot_fragility = {}
    for (day, slot), (ok, frag) in per_slot_histogram_t1.items():
        per_slot_fragility.setdefault(day, {})[slot] = {
            "ok": ok, "fragile_tier1": frag,
            "total": ok + frag,
        }

    # ---- HEADROOM ----------------------------------------------------------
    # For each fragile lesson (tier-1 basis), check every alternative
    # (day, slot-run) placement in ITS OWN band for a tier-1-only rescue,
    # holding everything else fixed.
    fixable_by_moving_alone = 0
    headroom_details = []
    t1_fragile_lessons = [(l, e) for l, e in zip(scored_lessons, out_lessons)
                          if not e["covered_same_subject"]]
    for l, _e in t1_fragile_lessons:
        section = _get(l, "section")
        subject = _get(l, "subject")
        teacher = _get(l, "teacher")
        day = _get(l, "day")
        slots = tuple(_get(l, "slots"))
        band = _band_of(section)

        length = len(slots)
        found = False
        for alt_day in DAYS:
            for run in _band_teaching_runs(bells, band, length):
                if alt_day == day and run == slots:
                    continue  # current placement, not an alternative
                # the lesson's own teacher must also be free at every slot
                # of the candidate run on alt_day (a placement isn't real
                # otherwise) — checked against everyone ELSE's occupancy,
                # i.e. as if this lesson itself were removed from its
                # current slot (that's the "moving this lesson alone" model).
                teacher_ok = all(
                    _is_free_excluding_self(
                        wallclock, occ_by_teacher_day, teacher, alt_day,
                        band, s, exclude_day=day, exclude_slots=slots)
                    for s in run
                )
                if not teacher_ok:
                    continue
                sub_ok = True
                for s in run:
                    t1, _ = eligible_free_candidates(teacher, subject, alt_day, band, s)
                    # candidates busy only because of the lesson's OWN
                    # current placement don't need re-checking here since
                    # we're evaluating a different (day,slot); the existing
                    # eligible_free_candidates already excludes `teacher`
                    # and uses the fixed-everything-else occupancy index.
                    if t1 == 0:
                        sub_ok = False
                        break
                if sub_ok:
                    found = True
                    break
            if found:
                break
        if found:
            fixable_by_moving_alone += 1
        headroom_details.append({
            "section": section, "subject": subject, "teacher": teacher,
            "day": day, "slots": list(slots), "fixable_alone": found,
        })

    return {
        "total_scored_lessons": total_scored,
        "vacancy_count": vacancy_count,
        "lessons_with_subject_missing_from_dept_map": lessons_with_missing_dept,
        "pct_lessons_with_same_subject_cover": round(pct_same_subject, 2),
        "pct_with_subject_or_dept_cover": round(pct_subject_or_dept, 2),
        "avg_same_subject_depth": (round(sum(depth_t1_all) / len(depth_t1_all), 3)
                                   if depth_t1_all else 0.0),
        "min_same_subject_depth": min(depth_t1_all) if depth_t1_all else 0,
        "avg_same_subject_or_dept_depth": (round(sum(depth_t1t2_all) / len(depth_t1t2_all), 3)
                                           if depth_t1t2_all else 0.0),
        "min_same_subject_or_dept_depth": min(depth_t1t2_all) if depth_t1t2_all else 0,
        "fragile_lessons": fragile_lessons,
        "fragile_lesson_count": len(fragile_lessons),
        "per_slot_fragility": per_slot_fragility,
        "headroom": {
            "fixable_by_moving_alone": fixable_by_moving_alone,
            "fragile_tier1_lesson_count": len(headroom_details),
            "details": headroom_details,
        },
        "lessons": out_lessons,
    }


def _is_free_excluding_self(wallclock, occ_by_teacher_day, teacher, day, band,
                            slot, exclude_day, exclude_slots):
    """Like is_free, but ignores the lesson's own current occupancy entry
    (so headroom can ask 'if this lesson were placed elsewhere, would the
    teacher be free there' without the lesson's CURRENT placement — which
    is about to move — falsely colliding with itself when exclude_day==day
    happens to coincide with a candidate day)."""
    window = wallclock.get((band, slot))
    if window is None:
        return True
    w_start, w_end = window
    for (obs_band, obs_slot) in occ_by_teacher_day.get((teacher, day), ()):
        if day == exclude_day and obs_band == band and obs_slot in exclude_slots:
            continue
        obs_window = wallclock.get((obs_band, obs_slot))
        if obs_window is None:
            continue
        if _overlaps(w_start, w_end, obs_window[0], obs_window[1]):
            return False
    return True


def _summary_row(m):
    return {
        "total_scored_lessons": m["total_scored_lessons"],
        "vacancy_count": m["vacancy_count"],
        "pct_lessons_with_same_subject_cover": m["pct_lessons_with_same_subject_cover"],
        "pct_with_subject_or_dept_cover": m["pct_with_subject_or_dept_cover"],
        "avg_same_subject_depth": m["avg_same_subject_depth"],
        "min_same_subject_depth": m["min_same_subject_depth"],
        "avg_same_subject_or_dept_depth": m["avg_same_subject_or_dept_depth"],
        "min_same_subject_or_dept_depth": m["min_same_subject_or_dept_depth"],
        "fragile_lesson_count": m["fragile_lesson_count"],
        "fixable_by_moving_alone": m["headroom"]["fixable_by_moving_alone"],
        "lessons_with_subject_missing_from_dept_map":
            m["lessons_with_subject_missing_from_dept_map"],
    }


def render_markdown(school, rebuild_m, coverage_m=None, coverage_v4_m=None):
    """coverage_m (optional): the v3 coverage_resolve repair's metrics.
    coverage_v4_m (optional): the v4 coverage_resolve_v4 repair's metrics
    (pairwise swaps + atomic combined-unit moves on top of v3). When v4 is
    present it REPLACES v3 as the displayed third column (v3 stays available
    in the JSON payload only — see substitution_score.py's main()); the
    Verdict then compares the school against the FINAL Manhaj timetable in
    priority order v4 > v3 > v2 rebuild."""
    s, r = _summary_row(school), _summary_row(rebuild_m)
    v3 = _summary_row(coverage_m) if coverage_m is not None else None
    v4 = _summary_row(coverage_v4_m) if coverage_v4_m is not None else None
    v = v4 if v4 is not None else v3

    def better(key, lower_is_better=False):
        a, b = s[key], (v or r)[key]
        if a == b:
            return "same"
        if lower_is_better:
            return "Manhaj better" if b < a else "school better"
        return "Manhaj better" if b > a else "school better"

    rows = [
        ("Staffed teaching lessons scored", "total_scored_lessons", None),
        ("Permanently uncovered (vacancy — no teacher assigned)",
         "vacancy_count", True),
        ("Lessons with a same-subject substitute free (%)",
         "pct_lessons_with_same_subject_cover", False),
        ("Lessons with a same-subject OR same-department substitute free (%)",
         "pct_with_subject_or_dept_cover", False),
        ("Average same-subject cover depth (free qualified subs per slot)",
         "avg_same_subject_depth", False),
        ("Worst-case same-subject cover depth (minimum over all slots)",
         "min_same_subject_depth", False),
        ("Fragile lessons (zero eligible free sub on >= 1 slot)",
         "fragile_lesson_count", True),
        ("Fixable by moving just that one lesson (headroom)",
         "fixable_by_moving_alone", True),
    ]
    title = ("# Substitution-friendliness — school Ver 19 vs Manhaj rebuild"
             + (" vs Manhaj coverage-optimized" if v else ""))
    coverage_note = (
        "\n\nThe coverage-optimized column is the v2 rebuild after "
        + ("coverage_resolve_v4.py's escalated repair (pairwise swaps of "
           "unlocked lessons plus coverage_resolve.py's original "
           "single-lesson moves, now including previously-locked combined "
           "cross-section lessons moved/swapped as one atomic unit; all "
           "hard rules intact, never net-decreasing tier-1 coverage)."
           if v4 is not None else
           "coverage_resolve.py's greedy repair pass (single-lesson moves "
           "only, all hard rules intact, never stripping another lesson's "
           "cover).")
        + " The Verdict compares the school against it." if v else "")
    lines = [
        title,
        "",
        "For every lesson actually taught, is at least one RELEVANT "
        "substitute teacher free at that exact time if the assigned "
        "teacher is absent? \"Relevant\" means: tier 1, someone who teaches "
        "the same subject elsewhere in this timetable; tier 2 (weaker), "
        "someone from the same subject department. Free means no lesson "
        "anywhere in the school (any grade band) whose real clock time "
        "overlaps that slot — cross-band period labels can share the exact "
        "same clock window, and this check treats that as a real clash."
        + coverage_note,
        "",
        ("| Measure | School Ver 19 | Manhaj rebuild | "
         "Manhaj coverage-optimized | Verdict |" if v else
         "| Measure | School Ver 19 | Manhaj rebuild | Verdict |"),
        "|---|---|---|---|" + ("---|" if v else ""),
    ]
    for label, key, lower_is_better in rows:
        verdict = "" if lower_is_better is None else better(key, lower_is_better)
        if v:
            lines.append(f"| {label} | {s[key]} | {r[key]} | {v[key]} | {verdict} |")
        else:
            lines.append(f"| {label} | {s[key]} | {r[key]} | {verdict} |")

    lines += [
        "",
        f"Subjects missing from the department map: {s['lessons_with_subject_missing_from_dept_map']} "
        f"scored lessons (school) / {r['lessons_with_subject_missing_from_dept_map']} (rebuild) teach a "
        "subject with no entry in subject_departments.json — those lessons "
        "can only ever get a tier-1 (same-subject) cover, never a tier-2 "
        "department fallback, until the map is extended.",
        "",
        "## Reading the numbers",
        "",
        "- \"Fragile\" lessons are the real risk list: if that teacher calls "
        "in sick, there is nobody qualified and free to cover at least one "
        "of that lesson's slots. A multi-slot (double) lesson only counts "
        "as covered if EVERY slot clears the bar — a substitute for period "
        "1 of a double who is busy in period 2 does not fully cover it.",
        "- \"Fixable by moving just that one lesson\" is a lower-bound "
        "headroom estimate: holding every other lesson fixed, would ANY "
        "other (day, slot) placement in that lesson's own band give it a "
        "free same-subject substitute at every slot, without stealing the "
        "assigned teacher's own availability? It does not explore moving "
        "any OTHER lesson, so a full coverage-aware re-solve could do "
        "better still.",
    ]
    return "\n".join(lines) + "\n"


def _load_rebuild_lessons(rebuild_out):
    """rebuild_v2.json's rebuild output nests lessons under a top-level key
    (its own solve response) — inspect and unwrap defensively."""
    if isinstance(rebuild_out, dict) and "lessons" in rebuild_out:
        return rebuild_out["lessons"]
    if isinstance(rebuild_out, dict) and "slots" in rebuild_out:
        return rebuild_out["slots"]
    raise ValueError("rebuild_v2.json: could not find lessons under 'lessons' "
                     "or 'slots' key")


def main():
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())
    rebuild_out = json.loads((DERIVED / "rebuild_v2.json").read_text())
    rebuild_lessons = _load_rebuild_lessons(rebuild_out)

    school = score(canonical, bells, subject_depts)
    rebuild = score(rebuild_lessons, bells, subject_depts)

    payload = {
        "school_ver19": school,
        "manhaj_rebuild": rebuild,
        "summary": {
            "school_ver19": _summary_row(school),
            "manhaj_rebuild": _summary_row(rebuild),
        },
    }

    # v3 (coverage_resolve greedy repair pass) — optional: only scored if
    # data/processed/tt_2526/derived/rebuild_v3_coverage.json exists (written
    # by solver/timetable/coverage_resolve.py). Folded into the SAME
    # comparable payload rather than a separate file; retained in JSON even
    # once v4 exists (v4 replaces it only in the rendered markdown table).
    coverage = None
    v3_path = DERIVED / "rebuild_v3_coverage.json"
    if v3_path.exists():
        v3_out = json.loads(v3_path.read_text())
        v3_lessons = _load_rebuild_lessons(v3_out)
        coverage = score(v3_lessons, bells, subject_depts)
        payload["manhaj_coverage_v3"] = coverage
        payload["summary"]["manhaj_coverage_v3"] = _summary_row(coverage)

    # v4 (coverage_resolve_v4: pairwise swaps + atomic combined-unit moves
    # on top of v3) — optional: only scored if rebuild_v4_coverage.json
    # exists. Becomes the displayed "coverage-optimized" column in the
    # rendered markdown; v3 stays in the JSON payload regardless.
    coverage_v4 = None
    v4_path = DERIVED / "rebuild_v4_coverage.json"
    if v4_path.exists():
        v4_out = json.loads(v4_path.read_text())
        v4_lessons = _load_rebuild_lessons(v4_out)
        coverage_v4 = score(v4_lessons, bells, subject_depts)
        payload["manhaj_coverage_v4"] = coverage_v4
        payload["summary"]["manhaj_coverage_v4"] = _summary_row(coverage_v4)

    (DERIVED / "substitution_score.json").write_text(json.dumps(payload, indent=2))
    (DERIVED / "substitution_score.md").write_text(
        render_markdown(school, rebuild, coverage, coverage_v4))
    print(f"wrote {DERIVED / 'substitution_score.json'}")
    print(f"wrote {DERIVED / 'substitution_score.md'}")
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
