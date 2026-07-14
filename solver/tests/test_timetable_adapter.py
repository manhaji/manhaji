"""Tests for the pure request-assembly half of the adapter (no DB needed)."""
from solver.timetable.adapter import assemble_request


BELLS = [
    # (day_of_week, period_number, bell_period_id, is_teaching)
    ("Mon", 1, "M1", True), ("Mon", 2, "M2", True), ("Mon", 3, "MB", False),
    ("Tue", 1, "U1", True), ("Tue", 2, "U2", True), ("Tue", 3, "UB", False),
]
DEMANDS = [
    ("T1", "SA", "Ma", 2),
    ("T2", "SA", "En", 1),
]


def test_assemble_request_builds_grid_from_teaching_periods_only():
    req = assemble_request("SCH", "AY", BELLS, DEMANDS)
    assert req["grid"]["days"] == ["Mon", "Tue"]
    assert req["grid"]["periods_per_day"] == 2
    assert req["grid"]["bell_period_ids"] == {"Mon": ["M1", "M2"], "Tue": ["U1", "U2"]}
    assert len(req["demands"]) == 2
    assert req["scope"] == {"school_id": "SCH", "academic_year_id": "AY"}


def test_assemble_request_rejects_ragged_days():
    ragged = BELLS + [("Wed", 1, "W1", True)]  # Wed has 1 teaching period, others 2
    try:
        assemble_request("SCH", "AY", ragged, DEMANDS)
        assert False, "expected ValueError for ragged teaching-period counts"
    except ValueError as e:
        assert "Wed" in str(e)


def test_assemble_request_rejects_unsupported_day_names():
    bells = BELLS + [("All", 1, "A1", True)]
    try:
        assemble_request("SCH", "AY", bells, DEMANDS)
        assert False, "expected ValueError for unsupported day name"
    except ValueError as e:
        assert "All" in str(e) and "expanded" in str(e)


def test_assemble_request_ragged_error_reports_all_day_counts():
    bells = [
        ("Mon", 1, "M1", True), ("Mon", 2, "M2", True),
        ("Tue", 1, "U1", True), ("Tue", 2, "U2", True),
        ("Wed", 1, "W1", True), ("Thu", 1, "H1", True),
    ]
    try:
        assemble_request("SCH", "AY", bells, DEMANDS)
        assert False, "expected ValueError for ragged days"
    except ValueError as e:
        msg = str(e)
        assert "Mon" in msg and "Tue" in msg and "Wed" in msg and "Thu" in msg
