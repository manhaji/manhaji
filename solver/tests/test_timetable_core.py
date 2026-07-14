"""Invariant tests for the timetable builder core. Synthetic fixtures, no DB."""
from collections import defaultdict

from solver.timetable.core import build

FULL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]


def make_grid(days, periods):
    return {
        "days": days,
        "periods_per_day": periods,
        "bell_period_ids": {d: [f"{d}-P{p}" for p in range(1, periods + 1)] for d in days},
    }


def make_request(demands, days=None, periods=6, policy=None):
    req = {
        "scope": {"school_id": "SCH", "academic_year_id": "AY"},
        "grid": make_grid(days or FULL_DAYS, periods),
        "demands": demands,
    }
    if policy:
        req["policy"] = policy
    return req


def demand(teacher, section, subject, w):
    return {"teacher_id": teacher, "section_id": section,
            "subject_id": subject, "weekly_periods": w}


def cells_by_teacher(resp):
    out = defaultdict(list)
    for s in resp["slots"]:
        out[s["teacher_id"]].append((s["day"], s["period_number"]))
    return out


def test_teacher_never_double_booked():
    # One teacher, two sections, 3 periods each on a 2-day x 3-period grid:
    # exactly fills their 6 cells — any clash would show as a duplicate cell.
    resp = build(make_request(
        [demand("T1", "SA", "Ma", 3), demand("T1", "SB", "Ma", 3)],
        days=["Mon", "Tue"], periods=3))
    cells = cells_by_teacher(resp)["T1"]
    assert len(cells) == 6
    assert len(set(cells)) == 6


def test_every_demand_placed_exactly_weekly_periods():
    resp = build(make_request(
        [demand("T1", "SA", "Ma", 4), demand("T2", "SA", "En", 3),
         demand("T3", "SB", "Sc", 5)]))
    counts = defaultdict(int)
    for s in resp["slots"]:
        counts[(s["teacher_id"], s["section_id"], s["subject_id"])] += 1
    assert counts[("T1", "SA", "Ma")] == 4
    assert counts[("T2", "SA", "En")] == 3
    assert counts[("T3", "SB", "Sc")] == 5
    assert resp["status"] == "solved"


def test_small_section_never_has_parallel_lessons():
    # Section total 6 <= 6 cells -> parallelism cap is 1: no two lessons at once.
    resp = build(make_request(
        [demand("T1", "SA", "Ma", 3), demand("T2", "SA", "En", 3)],
        days=["Mon", "Tue"], periods=3))
    seen = set()
    for s in resp["slots"]:
        key = (s["section_id"], s["day"], s["period_number"])
        assert key not in seen, f"section double-booked at {key}"
        seen.add(key)


def test_big_section_allowed_bounded_parallelism():
    # Section total 9 on a 6-cell grid -> cap ceil(9/6)=2 parallel lessons max.
    resp = build(make_request(
        [demand("T1", "SA", "Ma", 3), demand("T2", "SA", "En", 3),
         demand("T3", "SA", "Sc", 3)],
        days=["Mon", "Tue"], periods=3))
    per_cell = defaultdict(int)
    for s in resp["slots"]:
        per_cell[(s["day"], s["period_number"])] += 1
    assert len(resp["slots"]) == 9
    assert max(per_cell.values()) <= 2


def test_overcommitted_teacher_gets_shortfall_not_infeasible():
    # T1 demands 4 periods but the grid has 3 cells: place 3, report the gap.
    resp = build(make_request([demand("T1", "SA", "Ma", 4)],
                              days=["Mon"], periods=3))
    assert resp["status"] == "solved"
    assert len(resp["slots"]) == 3
    assert any("T1" in line for line in resp["gap_report"])


def test_status_mapping_distinguishes_unknown_from_infeasible():
    from ortools.sat.python import cp_model
    from solver.timetable.core import status_of
    assert status_of(cp_model.OPTIMAL) == "solved"
    assert status_of(cp_model.FEASIBLE) == "feasible_timeout"
    assert status_of(cp_model.INFEASIBLE) == "infeasible"
    assert status_of(cp_model.UNKNOWN) == "unknown_timeout"

    import pytest
    with pytest.raises(ValueError):
        status_of(cp_model.MODEL_INVALID)


def test_resolve_status_salvages_incumbent_on_unknown():
    from ortools.sat.python import cp_model
    from solver.timetable.core import resolve_status
    assert resolve_status(cp_model.UNKNOWN, True) == "feasible_timeout"
    assert resolve_status(cp_model.UNKNOWN, False) == "unknown_timeout"
    assert resolve_status(cp_model.OPTIMAL, True) == "solved"
    assert resolve_status(cp_model.INFEASIBLE, False) == "infeasible"


def test_empty_days_grid_rejected():
    import pytest
    from pydantic import ValidationError
    req = make_request([demand("T1", "SA", "Ma", 1)])
    req["grid"] = {"days": [], "periods_per_day": 2, "bell_period_ids": {}}
    with pytest.raises(ValidationError):
        build(req)


def test_repeated_subject_spreads_across_days():
    # 5 Math periods, empty 5x6 week: nothing stops one-per-day, so the
    # spread objective must achieve exactly 5 distinct days.
    resp = build(make_request([demand("T1", "SA", "Ma", 5)]))
    days_used = {s["day"] for s in resp["slots"]}
    assert len(days_used) == 5
    assert resp["quality"]["spread_violations"] == 0


def test_teacher_days_are_balanced():
    # 10 periods over 5 days, uncontended: soft daily cap is
    # ceil(10/5)+1 = 3; balance objective should land within it.
    resp = build(make_request(
        [demand("T1", "SA", "Ma", 5), demand("T1", "SB", "Ma", 5)]))
    per_day = defaultdict(int)
    for s in resp["slots"]:
        per_day[s["day"]] += 1
    assert max(per_day.values()) <= 3
    assert resp["quality"]["balance_violations"] == 0


def test_no_incumbent_timeout_returns_empty_unknown():
    # 400 demands with a zero-second budget: CP-SAT can prove nothing and
    # holds no incumbent — the honest answer is an empty unknown_timeout,
    # never a garbage timetable.
    demands = [demand(f"T{i % 40}", f"S{i % 39}", f"J{i % 10}", 2)
               for i in range(400)]
    resp = build(make_request(demands, policy={"time_limit_s": 0}))
    assert resp["status"] == "unknown_timeout"
    assert resp["slots"] == []


def test_warm_start_returns_valid_timetable_under_tight_budget():
    # Without the hard-rules-first warm start, this scale finds nothing in
    # a short budget; with it, a valid (maybe not optimal) week comes back.
    demands = [demand(f"T{i % 40}", f"S{i % 39}", f"J{i % 10}", 2)
               for i in range(400)]
    resp = build(make_request(demands, policy={"time_limit_s": 12}))
    assert resp["status"] in ("solved", "feasible_timeout")
    assert len(resp["slots"]) == 800
    seen = set()
    for s in resp["slots"]:
        key = (s["teacher_id"], s["day"], s["period_number"])
        assert key not in seen
        seen.add(key)


def test_deterministic_output():
    import copy
    req = make_request(
        [demand("T1", "SA", "Ma", 4), demand("T2", "SA", "En", 3),
         demand("T1", "SB", "Ma", 4), demand("T3", "SB", "Sc", 2)])
    r1 = build(copy.deepcopy(req))
    r2 = build(copy.deepcopy(req))
    key = lambda s: (s["teacher_id"], s["section_id"], s["subject_id"],
                     s["day"], s["period_number"])
    assert sorted(map(key, r1["slots"])) == sorted(map(key, r2["slots"]))
