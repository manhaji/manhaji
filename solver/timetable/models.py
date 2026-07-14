"""Pydantic contracts for the timetable builder.

Mirrors docs/superpowers/specs/2026-07-02-timetable-builder-design.md. The
builder is a pure function over these shapes — no DB, no HTTP in core.
"""
from typing import Dict, List, Literal

from pydantic import BaseModel, Field, model_validator


class Scope(BaseModel):
    school_id: str
    academic_year_id: str


class Grid(BaseModel):
    days: List[str] = Field(min_length=1)
    periods_per_day: int = Field(ge=1)
    # day -> ordered list of bell_period_ids (teaching periods only)
    bell_period_ids: Dict[str, List[str]]

    @model_validator(mode="after")
    def every_day_has_period_ids(self):
        for day in self.days:
            ids = self.bell_period_ids.get(day)
            if not ids or len(ids) != self.periods_per_day:
                raise ValueError(
                    f"grid.bell_period_ids[{day!r}] must list exactly "
                    f"{self.periods_per_day} teaching-period ids")
        return self


class Demand(BaseModel):
    teacher_id: str
    section_id: str
    subject_id: str
    weekly_periods: int = Field(ge=1)


class Policy(BaseModel):
    max_same_subject_per_day: int = 2
    spread_weight: int = 30
    balance_weight: int = 20
    time_limit_s: int = 60


class BuildRequest(BaseModel):
    scope: Scope
    grid: Grid
    demands: List[Demand]
    policy: Policy = Field(default_factory=Policy)


class PlacedSlot(BaseModel):
    section_id: str
    subject_id: str
    teacher_id: str
    day: str
    period_number: int  # 1-based position within that day's teaching periods
    bell_period_id: str


class Quality(BaseModel):
    spread_violations: int
    balance_violations: int
    # raw weighted objective (placements*1000 minus penalties); unbounded and
    # weight-dependent — compare only across runs with identical weights
    objective: int


class BuildSource(BaseModel):
    solver_version: str
    generated_at: str


class BuildResponse(BaseModel):
    status: Literal["solved", "feasible_timeout", "infeasible", "unknown_timeout"]
    slots: List[PlacedSlot]
    quality: Quality
    gap_report: List[str] = Field(default_factory=list)
    source: BuildSource
