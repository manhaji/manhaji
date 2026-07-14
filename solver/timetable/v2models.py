"""Pydantic contracts for the v2 rebuild engine (solver/timetable/v2core.py).

Mirrors the style of solver/timetable/models.py (v1). The rebuild engine is a
pure function over these shapes — no DB, no HTTP.

v2 works directly on human-readable strings (section/subject/teacher names) —
no UUID indirection layer, since the derived inputs (data/processed/tt_2526/
derived/) are already keyed by name.
"""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class BellRow(BaseModel):
    slot: str
    start: str
    end: str
    teaching: bool


class CanonicalLesson(BaseModel):
    """One row of canonical_lessons.json: the school's actual Ver 19 placement,
    and simultaneously the demand catalog (teacher/section/subject/length)."""
    section: str
    day: str
    slots: List[str] = Field(min_length=1)
    subject: str
    teacher: Optional[str] = None
    non_teaching: bool = False
    unstaffed: bool = False
    co_teachers: Optional[List[str]] = None


class ParallelGroupEntry(BaseModel):
    subjects: List[str] = Field(min_length=2)
    count: int = 0


class MinedRule(BaseModel):
    section: str
    subject: str
    per_week: int
    max_per_day: int
    has_double: bool = False


class Policy(BaseModel):
    spread_weight: int = 30
    balance_weight: int = 20
    time_limit_s: int = 60
    # fallback per-day cap used when a (section, subject) pair has no mined
    # rule at all (defensive — shouldn't normally happen, see gap_report)
    default_max_per_day_fallback: int = 4


class RebuildRequest(BaseModel):
    canonical_lessons: List[CanonicalLesson]
    bells: Dict[str, List[BellRow]]  # band -> ordered bell rows
    parallel_groups: Dict[str, List[ParallelGroupEntry]] = Field(default_factory=dict)
    mined_rules: List[MinedRule] = Field(default_factory=list)
    policy: Policy = Field(default_factory=Policy)
    days: List[str] = Field(default_factory=lambda: ["Sun", "Mon", "Tue", "Wed", "Thu"])


class PlacedLesson(BaseModel):
    section: str
    day: str
    slots: List[str]
    subject: str
    teacher: Optional[str] = None
    non_teaching: bool = False
    unstaffed: bool = False
    locked: bool = False
    lock_reason: Optional[str] = None


class Quality(BaseModel):
    spread_penalty: int
    balance_penalty: int
    objective: int


class RebuildSource(BaseModel):
    solver_version: str
    generated_at: str


class RebuildResponse(BaseModel):
    status: Literal["solved", "feasible_timeout", "infeasible", "unknown_timeout"]
    lessons: List[PlacedLesson]
    quality: Quality
    gap_report: List[str] = Field(default_factory=list)
    source: RebuildSource
