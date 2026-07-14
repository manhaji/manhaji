"""Pydantic request/response models for the substitution solver.

These mirror the data contract in docs/substitution_solver_handoff.md.
The solver is a pure function over these shapes — no DB, no HTTP in here.
"""
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class Scope(BaseModel):
    school_id: str
    academic_year_id: str
    date_from: str  # YYYY-MM-DD
    date_to: str


class Absence(BaseModel):
    teacher_id: str
    dates: List[str]
    # "all" = out the whole day; else the specific bell_period_ids they miss
    periods: Union[Literal["all"], List[str]] = "all"
    reason: Optional[str] = None


class SlotToCover(BaseModel):
    slot_id: str
    date: str
    bell_period_id: str
    day_of_week: Optional[str] = None
    section_id: str
    subject_id: str
    room_id: Optional[str] = None
    # Extension (optional, adapter fills it): the absent teacher who owns this
    # lesson. Used as the reference point for same-department matching. When
    # missing, the solver falls back to the departments of whoever is absent
    # at this date+period.
    teacher_id: Optional[str] = None


class BusyPeriod(BaseModel):
    date: str
    bell_period_id: str


class TeacherIn(BaseModel):
    teacher_id: str
    subject_ids: List[str] = Field(default_factory=list)
    department: Optional[str] = None
    max_periods_per_day: Optional[int] = None
    busy: List[BusyPeriod] = Field(default_factory=list)
    free_periods_today: Dict[str, int] = Field(default_factory=dict)
    cover_done_recently: int = 0


class Policy(BaseModel):
    fairness_cap_per_teacher: int = 3
    prefer_same_subject_weight: int = 100
    prefer_same_department_weight: int = 40
    over_daily_cap_penalty: int = 60
    consume_only_prep_penalty: int = 25


class SolveRequest(BaseModel):
    scope: Scope
    absences: List[Absence]
    slots_to_cover: List[SlotToCover]
    teachers: List[TeacherIn]
    policy: Policy = Field(default_factory=Policy)


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

MatchType = Literal["same_subject", "same_department"]


class Alternative(BaseModel):
    substitute_teacher_id: str
    match_type: MatchType
    score: int


class Assignment(BaseModel):
    slot_id: str
    date: str
    substitute_teacher_id: str
    match_type: MatchType
    score: int
    reasoning: str
    alternatives: List[Alternative] = Field(default_factory=list)


class Unfilled(BaseModel):
    slot_id: str
    date: str
    reason: str


class FairnessSpread(BaseModel):
    max_covers_one_teacher: int


class Summary(BaseModel):
    slots_total: int
    filled: int
    unfilled: int
    fairness_spread: FairnessSpread


class Source(BaseModel):
    solver_version: str
    generated_at: str


class SolveResponse(BaseModel):
    status: Literal["solved", "partial", "infeasible"]
    assignments: List[Assignment]
    unfilled: List[Unfilled]
    summary: Summary
    confidence: float
    notes_for_admin: str
    source: Source
