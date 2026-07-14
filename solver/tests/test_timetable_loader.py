"""Tests for the pure plan->rows half of the loader (no DB needed)."""
from solver.timetable.loader import plan_to_rows


def test_plan_to_rows_maps_every_slot():
    plan = {"slots": [
        {"section_id": "S1", "subject_id": "J1", "teacher_id": "T1",
         "day": "Mon", "period_number": 1, "bell_period_id": "B1"},
        {"section_id": "S1", "subject_id": "J2", "teacher_id": "T2",
         "day": "Mon", "period_number": 1, "bell_period_id": "B1"},
    ]}
    rows = plan_to_rows(plan, school_id="SCH", ay_id="AY")
    assert len(rows) == 2
    assert rows[0] == ("SCH", "AY", "S1", "J1", "T1", "B1", "solver")
    # parallel lessons for the same section+period are allowed (post-012)
    assert rows[1][5] == "B1"


def test_find_collisions_flags_matching_six_tuples():
    from solver.timetable.loader import find_collisions
    plan_rows = [
        ("SCH", "AY", "S1", "J1", "T1", "B1", "solver"),
        ("SCH", "AY", "S1", "J2", "T2", "B2", "solver"),
    ]
    existing = [
        {"section_id": "S1", "subject_id": "J1", "teacher_id": "T1",
         "bell_period_id": "B1", "source": "demo"},
        {"section_id": "S9", "subject_id": "J9", "teacher_id": "T9",
         "bell_period_id": "B9", "source": "human"},
    ]
    hits = find_collisions(plan_rows, existing)
    assert len(hits) == 1
    assert hits[0]["source"] == "demo"
