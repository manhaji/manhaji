"""Contract tests for the timetable builder request/response models."""
import pytest
from pydantic import ValidationError

from solver.timetable.models import BuildRequest


def minimal_request():
    return {
        "scope": {"school_id": "SCH", "academic_year_id": "AY"},
        "grid": {
            "days": ["Mon", "Tue"],
            "periods_per_day": 2,
            "bell_period_ids": {"Mon": ["M1", "M2"], "Tue": ["T1", "T2"]},
        },
        "demands": [
            {"teacher_id": "T1", "section_id": "S1", "subject_id": "Ma", "weekly_periods": 2}
        ],
    }


def test_minimal_request_parses_with_default_policy():
    req = BuildRequest.model_validate(minimal_request())
    assert req.policy.max_same_subject_per_day == 2
    assert req.policy.time_limit_s == 60
    assert req.demands[0].weekly_periods == 2


def test_zero_period_demand_rejected():
    bad = minimal_request()
    bad["demands"][0]["weekly_periods"] = 0
    with pytest.raises(ValidationError):
        BuildRequest.model_validate(bad)


def test_grid_day_without_bell_ids_rejected():
    bad = minimal_request()
    del bad["grid"]["bell_period_ids"]["Tue"]
    with pytest.raises(ValidationError):
        BuildRequest.model_validate(bad)
