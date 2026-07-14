"""Invariant tests for the substitution solver core.

Synthetic fixtures — no DB, no network. Each test builds a tiny school:
a handful of teachers, one absent, a few slots to cover.
"""
import copy

from solver.core import solve

DATE = "2026-09-07"  # a Monday inside AY 2026-2027


def make_request(slots, teachers, absent_teacher_id="T-OUT", policy_overrides=None):
    policy = {
        "fairness_cap_per_teacher": 3,
        "prefer_same_subject_weight": 100,
        "prefer_same_department_weight": 40,
        "over_daily_cap_penalty": 60,
        "consume_only_prep_penalty": 25,
    }
    policy.update(policy_overrides or {})
    return {
        "scope": {
            "school_id": "SCH-1",
            "academic_year_id": "AY-1",
            "date_from": DATE,
            "date_to": DATE,
        },
        "absences": [
            {
                "teacher_id": absent_teacher_id,
                "dates": [DATE],
                "periods": "all",
                "reason": "sick",
            }
        ],
        "slots_to_cover": slots,
        "teachers": teachers,
        "policy": policy,
    }


def teacher(tid, subjects, dept, busy=None, free_today=6, covers_recent=0):
    return {
        "teacher_id": tid,
        "subject_ids": subjects,
        "department": dept,
        "max_periods_per_day": 6,
        "busy": busy or [],
        "free_periods_today": {DATE: free_today},
        "cover_done_recently": covers_recent,
    }


def slot(slot_id, period, subject="SUB-MATH", section="SEC-A"):
    return {
        "slot_id": slot_id,
        "date": DATE,
        "bell_period_id": period,
        "day_of_week": "Mon",
        "section_id": section,
        "subject_id": subject,
        "room_id": None,
    }


def assigned_map(response):
    return {a["slot_id"]: a for a in response["assignments"]}


def test_never_double_books_a_substitute():
    # Two lessons happen at the SAME period in different sections; only one
    # candidate exists. They can physically teach only one of them.
    slots = [
        slot("SL-1", "P1", section="SEC-A"),
        slot("SL-2", "P1", section="SEC-B"),
    ]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-FREE", ["SUB-MATH"], "Math"),
    ]
    resp = solve(make_request(slots, teachers))
    assert len(resp["assignments"]) == 1
    assert len(resp["unfilled"]) == 1
    assert resp["status"] == "partial"


def test_busy_teacher_is_never_assigned():
    # The only candidate already teaches at P1 — the slot must go unfilled,
    # never double-booked.
    slots = [slot("SL-1", "P1")]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-BUSY", ["SUB-MATH"], "Math",
                busy=[{"date": DATE, "bell_period_id": "P1"}]),
    ]
    resp = solve(make_request(slots, teachers))
    assert resp["assignments"] == []
    assert [u["slot_id"] for u in resp["unfilled"]] == ["SL-1"]


def test_respects_fairness_cap():
    # Three lessons, one eligible sub, cap of 1 → exactly one gets covered.
    slots = [slot("SL-1", "P1"), slot("SL-2", "P2"), slot("SL-3", "P3")]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-FREE", ["SUB-MATH"], "Math"),
    ]
    resp = solve(make_request(slots, teachers,
                              policy_overrides={"fairness_cap_per_teacher": 1}))
    assert len(resp["assignments"]) == 1
    assert len(resp["unfilled"]) == 2
    assert resp["summary"]["fairness_spread"]["max_covers_one_teacher"] == 1


def test_prefers_same_subject_over_same_department():
    slots = [slot("SL-1", "P1", subject="SUB-MATH")]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-DEPT", ["SUB-PHYS"], "Math"),   # same dept, different subject
        teacher("T-SUBJ", ["SUB-MATH"], "Science"),  # teaches the subject itself
    ]
    resp = solve(make_request(slots, teachers))
    a = assigned_map(resp)["SL-1"]
    assert a["substitute_teacher_id"] == "T-SUBJ"
    assert a["match_type"] == "same_subject"
    # the dept-match candidate should surface as an alternative, not vanish
    alt_ids = [alt["substitute_teacher_id"] for alt in a["alternatives"]]
    assert "T-DEPT" in alt_ids


def test_no_eligible_teacher_returns_unfilled_not_crash():
    # Nobody shares the subject or the department → first-class unfilled.
    slots = [slot("SL-1", "P1", subject="SUB-MATH")]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-OTHER", ["SUB-ART"], "Recreational"),
    ]
    resp = solve(make_request(slots, teachers))
    assert resp["assignments"] == []
    assert len(resp["unfilled"]) == 1
    assert resp["unfilled"][0]["slot_id"] == "SL-1"
    assert resp["unfilled"][0]["reason"]
    assert resp["status"] in ("partial", "infeasible")


def test_candidate_already_over_daily_cap_does_not_make_model_infeasible():
    # Regression test (found via solver/adapter_2526.py against real AY
    # 2025-2026 data): a candidate can be legitimately busy MORE periods in a
    # day than their max_periods_per_day proxy allows (e.g. an 8-period Gr7-12
    # day vs a flat weekly-cap/5 proxy of 6) purely from their EXISTING
    # timetable, with zero new covers. The daily-cap overflow IntVar's upper
    # bound must account for that pre-existing overflow, or the constraint
    # `over >= busy_today + new_covers - cap` becomes unsatisfiable and the
    # whole CP-SAT model reports infeasible even though a valid solution
    # (assign nobody extra to this teacher) obviously exists.
    slots = [slot("SL-1", "P1", subject="SUB-MATH")]
    busy_more_than_cap = [{"date": DATE, "bell_period_id": f"P{n}"} for n in range(2, 10)]  # 8 busy periods
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-OVERLOADED", ["SUB-MATH"], "Math", busy=busy_more_than_cap),  # 8 busy, cap 6
    ]
    resp = solve(make_request(slots, teachers))
    assert resp["status"] in ("solved", "partial")
    assert len(resp["assignments"]) == 1
    assert resp["assignments"][0]["substitute_teacher_id"] == "T-OVERLOADED"


def test_deterministic_output():
    slots = [slot("SL-1", "P1"), slot("SL-2", "P2")]
    teachers = [
        teacher("T-OUT", ["SUB-MATH"], "Math"),
        teacher("T-A", ["SUB-MATH"], "Math"),
        teacher("T-B", ["SUB-MATH"], "Math"),
    ]
    req = make_request(slots, teachers)
    r1 = solve(copy.deepcopy(req))
    r2 = solve(copy.deepcopy(req))
    assert [(a["slot_id"], a["substitute_teacher_id"]) for a in r1["assignments"]] == \
           [(a["slot_id"], a["substitute_teacher_id"]) for a in r2["assignments"]]
