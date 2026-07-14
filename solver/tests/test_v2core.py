"""Invariant tests for the v2 timetable rebuild engine (solver/timetable/v2core.py).

Contract under test: rebuild(request: dict) -> dict per
solver/timetable/v2models.py (RebuildRequest -> RebuildResponse).

Small synthetic fixtures only — the full 1920-lesson real dataset is exercised
by the slow integration test at the bottom of this file, run explicitly with:

    cd /Users/eliasmouawad/dev/manhaj-phase-c && PYTHONPATH=. \
        /Users/eliasmouawad/dev/manhaj/.venv/bin/python -m pytest \
        solver/tests/test_v2core.py -m slow -q

(excluded from the default run by pytest.ini's `addopts = -m "not slow"`).
"""
import json
from pathlib import Path

import pytest

from solver.timetable.v2core import rebuild
from solver.timetable.benchmark import compute_metrics

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]


# ---------------------------------------------------------------------------
# Small synthetic bell tables, mirroring the real bands' break placement.
# ---------------------------------------------------------------------------

def gr1_6_bells():
    """P1,P2,B1,P3,P4,P5,B2,P6,P7,P8 — matches the real GR1_6 band: P5-P6
    spans break B2 (not contiguous), P4-P5 is contiguous."""
    return [
        {"slot": "P1", "start": "8:00", "end": "8:45", "teaching": True},
        {"slot": "P2", "start": "8:45", "end": "9:30", "teaching": True},
        {"slot": "B1", "start": "9:30", "end": "9:50", "teaching": False},
        {"slot": "P3", "start": "9:50", "end": "10:35", "teaching": True},
        {"slot": "P4", "start": "10:35", "end": "11:15", "teaching": True},
        {"slot": "P5", "start": "11:15", "end": "11:55", "teaching": True},
        {"slot": "B2", "start": "11:55", "end": "12:35", "teaching": False},
        {"slot": "P6", "start": "12:35", "end": "13:20", "teaching": True},
        {"slot": "P7", "start": "13:20", "end": "14:05", "teaching": True},
        {"slot": "P8", "start": "14:05", "end": "14:45", "teaching": True},
    ]


def kg_bells():
    """P1,P2,B1,P3,P4,B2,P5,P6 — only 6 teaching slots/day, no P7/P8 at all."""
    return [
        {"slot": "P1", "start": "8:00", "end": "8:45", "teaching": True},
        {"slot": "P2", "start": "8:45", "end": "9:30", "teaching": True},
        {"slot": "B1", "start": "9:30", "end": "9:50", "teaching": False},
        {"slot": "P3", "start": "9:50", "end": "10:35", "teaching": True},
        {"slot": "P4", "start": "10:35", "end": "11:15", "teaching": True},
        {"slot": "B2", "start": "11:15", "end": "11:55", "teaching": False},
        {"slot": "P5", "start": "11:55", "end": "12:35", "teaching": True},
        {"slot": "P6", "start": "12:35", "end": "13:20", "teaching": True},
    ]


def base_request(**overrides):
    req = {
        "canonical_lessons": [],
        "bells": {"GR1_6": gr1_6_bells(), "KG": kg_bells()},
        "parallel_groups": {},
        "mined_rules": [],
        "policy": {"time_limit_s": 20},
        "days": DAYS,
    }
    req.update(overrides)
    return req


def lesson(section, day, slots, subject, teacher="T1", **kw):
    d = {"section": section, "day": day, "slots": slots, "subject": subject,
         "teacher": teacher}
    d.update(kw)
    return d


def rule(section, subject, per_week, max_per_day, has_double=False):
    return {"section": section, "subject": subject, "per_week": per_week,
            "max_per_day": max_per_day, "has_double": has_double}


# ---------------------------------------------------------------------------
# 1. Illegal same-section overlap never produced, even under capacity pressure
# ---------------------------------------------------------------------------

def test_illegal_overlap_never_produced_under_pressure():
    """Section 'Grade 1A' has no parallel_groups entry at all -> no two
    lessons of that section may ever share a slot. Build a scenario with only
    1 teaching day worth of a tiny grid-like pressure isn't really "tight"
    for GR1_6 (10 slots/day * 5 days = a lot of capacity), so instead we
    starve the grid indirectly: many lessons of DIFFERENT subjects for the
    same section, all taught by different teachers, with a mined cap forcing
    spread. There is no legal pairing, so the solver must use different
    slots — never overlap. We assert zero illegal overlaps in the result,
    and that the result is not a bogus overlap-cheat."""
    lessons = []
    for i, subj in enumerate(["Math", "English", "Science", "Art"]):
        lessons.append(lesson("Grade 1A", "Sun", ["P1"], subj, teacher=f"T{i}"))
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 1A", s, 1, 4) for s in
                     ["Math", "English", "Science", "Art"]],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    metrics = compute_metrics(resp["lessons"], req["bells"], req["parallel_groups"],
                               req["mined_rules"], req["days"])
    assert metrics["illegal_overlap_count"] == 0


# ---------------------------------------------------------------------------
# 2. An allowed pair CAN overlap when capacity forces it
# ---------------------------------------------------------------------------

def test_allowed_pair_overlaps_under_capacity_pressure():
    """Section 'KG1 A' (KG band: 6 teaching slots/day). Fill every slot
    except one across the whole week with a 'Filler' subject/teacher, then
    demand 2 more lessons (Arabic, French — a legal pair per parallel_groups)
    that must both land somewhere. With only 1 slot free anywhere in the
    grid, the solver is forced to overlap Arabic+French in that single slot
    rather than report infeasible — since overlapping them is legal."""
    section = "KG1 A"
    other_teacher = "TX"
    kg_teaching_slots = [r["slot"] for r in kg_bells() if r["teaching"]]
    filler = []
    for day in DAYS:
        for slot_id in kg_teaching_slots:
            if day == DAYS[0] and slot_id == kg_teaching_slots[-1]:
                continue  # leave exactly one slot free all week
            filler.append(lesson(section, day, [slot_id], "Filler",
                                  teacher=other_teacher))
    n_filler = len(filler)

    arabic = lesson(section, DAYS[0], [kg_teaching_slots[-1]], "Arabic", teacher="T-AR")
    french = lesson(section, DAYS[0], [kg_teaching_slots[-1]], "French", teacher="T-FR")

    lessons = filler + [arabic, french]
    req = base_request(
        canonical_lessons=lessons,
        parallel_groups={section: [{"subjects": ["Arabic", "French"], "count": 1}]},
        mined_rules=[
            rule(section, "Filler", n_filler, len(kg_teaching_slots)),
            rule(section, "Arabic", 1, 1),
            rule(section, "French", 1, 1),
        ],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    placed = resp["lessons"]
    ar = [p for p in placed if p["subject"] == "Arabic"][0]
    fr = [p for p in placed if p["subject"] == "French"][0]
    assert (ar["day"], tuple(ar["slots"])) == (fr["day"], tuple(fr["slots"])), (
        "capacity pressure should have forced Arabic+French (a legal pair) "
        "to overlap in the single remaining slot")
    metrics = compute_metrics(placed, req["bells"], req["parallel_groups"],
                               req["mined_rules"], req["days"])
    assert metrics["illegal_overlap_count"] == 0


# ---------------------------------------------------------------------------
# 3. Band grid respected
# ---------------------------------------------------------------------------

def test_kg_section_never_uses_slots_outside_its_band():
    lessons = [
        lesson("KG1 A", "Sun", ["P1"], "Math"),
        lesson("KG1 A", "Mon", ["P1"], "Math"),
        lesson("KG1 A", "Tue", ["P1"], "Math"),
    ]
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("KG1 A", "Math", 3, 3)],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    kg_teaching = {r["slot"] for r in kg_bells() if r["teaching"]}
    for p in resp["lessons"]:
        for s in p["slots"]:
            assert s in kg_teaching, f"KG lesson placed on non-KG/non-teaching slot {s}"
            assert s not in ("P7", "P8"), "KG has no P7/P8 at all"


# ---------------------------------------------------------------------------
# 4. Per-day cap respected
# ---------------------------------------------------------------------------

def test_per_day_cap_forces_spread():
    """max_per_day=1 for (KG1 A, Math) with 4 weekly lessons over a 5-day
    week must spread to <=1/day on every day."""
    lessons = [lesson("KG1 A", "Sun", ["P1"], "Math", teacher=f"T{i}")
               for i in range(4)]
    # give each its own placeholder original day so demand length matches;
    # teacher differs per lesson only to avoid an unrelated teacher-clash
    # confound (irrelevant to this test, but keep it clean)
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("KG1 A", "Math", 4, 1)],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    from collections import Counter
    day_counts = Counter(p["day"] for p in resp["lessons"] if p["subject"] == "Math")
    assert all(c <= 1 for c in day_counts.values()), day_counts


# ---------------------------------------------------------------------------
# 5. Doubles stay contiguous, never span a break
# ---------------------------------------------------------------------------

def test_double_never_spans_break():
    """GR1_6 band: P5-P6 spans B2 and is illegal; a 2-slot lesson must never
    be placed starting at P5 (which would need P5+P6)."""
    lessons = [lesson("Grade 1A", "Mon", ["P7", "P8"], "Arabic", teacher="T1")]
    # mined-rule semantics: per_week and max_per_day count SLOTS (verified
    # against the real data: per_week == slot counts for all 546 rules, and
    # real doubles are mined as per_week=2/max_per_day=2), so a 2-slot double
    # needs max_per_day >= 2.
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 1A", "Arabic", 2, 2, has_double=True)],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    placed = [p for p in resp["lessons"] if p["subject"] == "Arabic"][0]
    assert len(placed["slots"]) == 2
    band_slots = [r["slot"] for r in gr1_6_bells()]
    teaching = {r["slot"]: r["teaching"] for r in gr1_6_bells()}
    i0 = band_slots.index(placed["slots"][0])
    i1 = band_slots.index(placed["slots"][1])
    assert i1 == i0 + 1, "double must be on adjacent table rows"
    assert all(teaching[band_slots[i]] for i in range(i0, i1 + 1)), \
        "double must not span a break row"
    # explicitly the known-illegal start:
    assert placed["slots"] != ["P5", "P6"]


# ---------------------------------------------------------------------------
# 6. Locked lessons don't move
# ---------------------------------------------------------------------------

def test_locked_non_teaching_lesson_unchanged():
    lessons = [
        lesson("Grade 1A", "Thu", ["P4"], "Library", teacher=None,
               non_teaching=True),
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
    ]
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 1A", "Math", 1, 4)],
    )
    resp = rebuild(req)
    lib = [p for p in resp["lessons"] if p["subject"] == "Library"][0]
    assert lib["locked"] is True
    assert lib["lock_reason"] == "non_teaching"
    assert lib["day"] == "Thu"
    assert lib["slots"] == ["P4"]


def test_locked_combined_cross_section_lesson_unchanged():
    """Same (teacher, day, slots, subject) tuple appearing in 2 different
    sections -> both appearances locked at their source placement."""
    lessons = [
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", teacher="IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", teacher="IBZ / H"),
        lesson("Grade 3A", "Sun", ["P1"], "Math", teacher="T1"),
    ]
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 3A", "PE", 1, 1, has_double=True),
                     rule("Grade 3B", "PE", 1, 1, has_double=True),
                     rule("Grade 3A", "Math", 1, 4)],
    )
    resp = rebuild(req)
    pe_lessons = [p for p in resp["lessons"] if p["subject"] == "PE"]
    assert len(pe_lessons) == 2
    for p in pe_lessons:
        assert p["locked"] is True
        assert p["lock_reason"] == "combined_cross_section"
        assert p["day"] == "Mon"
        assert p["slots"] == ["P7", "P8"]


def test_locked_break_slot_source_data_unchanged():
    """A lesson whose slots include B1/B2 is locked with reason
    break_slot_source_data (e.g. real 'Math - Support' sessions run during
    break in the actual ISO data)."""
    lessons = [
        lesson("Grade 1A", "Tue", ["B2"], "Math - Support", teacher="Y1"),
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
    ]
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 1A", "Math - Support", 1, 4),
                     rule("Grade 1A", "Math", 1, 4)],
    )
    resp = rebuild(req)
    support = [p for p in resp["lessons"] if p["subject"] == "Math - Support"][0]
    assert support["locked"] is True
    assert support["lock_reason"] == "break_slot_source_data"
    assert support["day"] == "Tue"
    assert support["slots"] == ["B2"]


# ---------------------------------------------------------------------------
# 7. Determinism
# ---------------------------------------------------------------------------

def test_determinism_identical_runs():
    lessons = []
    for i, subj in enumerate(["Math", "English", "Science", "Art", "PE"]):
        lessons.append(lesson("Grade 4A", "Sun", ["P1"], subj, teacher=f"T{i}"))
    req = base_request(
        canonical_lessons=lessons,
        mined_rules=[rule("Grade 4A", s, 1, 4) for s in
                     ["Math", "English", "Science", "Art", "PE"]],
    )
    r1 = rebuild(req)
    r2 = rebuild(req)
    assert json.dumps(r1, sort_keys=True, default=str).replace(
        r1["source"]["generated_at"], ""
    ) == json.dumps(r2, sort_keys=True, default=str).replace(
        r2["source"]["generated_at"], ""
    )


# ---------------------------------------------------------------------------
# Sanity: same teacher, non-pairable subjects, plenty of capacity -> solver
# finds a non-overlapping placement rather than colliding them.
# ---------------------------------------------------------------------------

def test_same_teacher_non_pairable_subjects_placed_without_overlap():
    """Two lessons of the SAME section, SAME teacher, non-pairable subjects
    (no parallel_groups entry at all for this section) with a full week of
    capacity available: solver must place them in different (day, slot)
    cells — both because of the teacher-clash rule and the no-parallelism
    rule for a section with no parallel_groups entry."""
    section = "KG1 A"
    teacher = "T-SOLO"
    math_l = lesson(section, "Sun", ["P1"], "Math", teacher=teacher)
    art_l = lesson(section, "Sun", ["P1"], "Art", teacher=teacher)
    req = base_request(
        canonical_lessons=[math_l, art_l],
        mined_rules=[rule(section, "Math", 1, 4), rule(section, "Art", 1, 4)],
    )
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout")
    m = [p for p in resp["lessons"] if p["subject"] == "Math"][0]
    a = [p for p in resp["lessons"] if p["subject"] == "Art"][0]
    assert (m["day"], tuple(m["slots"])) != (a["day"], tuple(a["slots"]))


# ---------------------------------------------------------------------------
# Genuinely infeasible: teacher fully saturated elsewhere, no legal overlap
# possible for the pending lesson -> solver must report infeasible, not
# silently violate the teacher-clash rule.
# ---------------------------------------------------------------------------

def test_infeasible_reported_when_teacher_has_zero_capacity_left():
    """T-SOLO is booked (via 'Filler', a different section) into every single
    teaching slot in the week. A pending Math lesson for a different section
    also needs T-SOLO. There is no free cell anywhere for T-SOLO, and Math
    cannot legally overlap Filler (different sections entirely — overlap
    legality is only defined within one section). The model must be
    infeasible, and the engine must report status 'infeasible' rather than
    invent a clash."""
    kg_teaching_slots = [r["slot"] for r in kg_bells() if r["teaching"]]
    teacher = "T-SOLO"
    filler = []
    for day in DAYS:
        for slot_id in kg_teaching_slots:
            filler.append(lesson("KG1 A", day, [slot_id], "Filler", teacher=teacher))
    pending = lesson("KG1 B", "Sun", ["P1"], "Math", teacher=teacher)
    req = base_request(
        canonical_lessons=filler + [pending],
        mined_rules=[rule("KG1 A", "Filler", len(kg_teaching_slots) * len(DAYS),
                           len(kg_teaching_slots)),
                     rule("KG1 B", "Math", 1, 4)],
    )
    resp = rebuild(req)
    assert resp["status"] == "infeasible"


def test_infeasible_when_only_an_illegal_overlap_would_fit():
    """Rule-3 infeasibility (distinct from the teacher-saturation case above):
    KG1 A's whole week (6 teaching slots x 5 days = 30 cells) minus one is
    filled by unstaffed 'Filler' singles (movable, but same-subject so they
    can never stack). Arabic + French then need 2 cells but only 1 remains
    free, and there is NO parallel_groups entry for the section -> the only
    way to fit would be an illegal section overlap. The solver must report
    infeasible with no lessons, never emit a rule-3 violation."""
    section = "KG1 A"
    kg_teaching_slots = [r["slot"] for r in kg_bells() if r["teaching"]]
    filler = []
    for day in DAYS:
        for slot_id in kg_teaching_slots:
            if day == DAYS[0] and slot_id == kg_teaching_slots[-1]:
                continue  # exactly one free cell all week
            filler.append(lesson(section, day, [slot_id], "Filler",
                                 teacher=None, unstaffed=True))
    lessons = filler + [
        lesson(section, DAYS[0], [kg_teaching_slots[-1]], "Arabic",
               teacher="T-AR"),
        lesson(section, DAYS[0], [kg_teaching_slots[-1]], "French",
               teacher="T-FR"),
    ]
    req = base_request(
        canonical_lessons=lessons,
        parallel_groups={},  # explicitly: NO legal pairs for this section
        mined_rules=[rule(section, "Filler", len(filler),
                          len(kg_teaching_slots)),
                     rule(section, "Arabic", 1, 1),
                     rule(section, "French", 1, 1)],
    )
    resp = rebuild(req)
    assert resp["status"] == "infeasible"
    assert resp["lessons"] == []


# ---------------------------------------------------------------------------
# Slow integration test — real 1920-lesson dataset
# ---------------------------------------------------------------------------

@pytest.mark.slow
def test_full_scale_rebuild_real_dataset():
    """Full-scale integration test over the REAL derived inputs (1920
    lessons). Run explicitly with:

        cd /Users/eliasmouawad/dev/manhaj-phase-c && PYTHONPATH=. \
            /Users/eliasmouawad/dev/manhaj/.venv/bin/python -m pytest \
            solver/tests/test_v2core.py -m slow -q

    Excluded from the default suite by pytest.ini (`addopts = -m "not slow"`).
    """
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())
    parallel_groups = json.loads((DERIVED / "parallel_groups.json").read_text())
    mined_rules = json.loads((DERIVED / "mined_rules.json").read_text())

    req = {
        "canonical_lessons": canonical,
        "bells": bells,
        "parallel_groups": parallel_groups,
        "mined_rules": mined_rules,
        "policy": {"time_limit_s": 240},
        "days": DAYS,
    }
    resp = rebuild(req)
    assert resp["status"] in ("solved", "feasible_timeout"), resp["status"]
    assert len(resp["lessons"]) == len(canonical)

    metrics = compute_metrics(resp["lessons"], bells, parallel_groups,
                               mined_rules, DAYS)
    assert metrics["teacher_clash_count"] == 0
    assert metrics["illegal_overlap_count"] == 0
    assert metrics["per_day_cap_violation_count"] == 0
