"""Unit + integration tests for solver/timetable/precompute_covers.py — the
principal-dashboard "what if a teacher is absent" precomputed cover-plan
generator.

Small hand-verified synthetic fixtures for the pure request-builder helpers
(busy map from canonical lessons + cross-band wall-clock bridging, and the
eligibility/candidate-pool assembly), following the conventions of
test_substitution_score.py and test_coverage_resolve.py. A real-artifact
integration test cross-checks the documented Phase D dry-run result:
Mohammed Saab absent all day Monday -> 5/5 lessons covered, all same-subject.

Contract under test (solver/timetable/precompute_covers.py):
- REAL_TEACHERS_EXCLUDE: {'Exam Officer', 'Melissa - New teacher'} skipped by
  name; composites (teacher string containing '/') skipped; None (unstaffed)
  skipped.
- build_wallclock_index(bells) -> {(band, slot): (start_min, end_min)}
  (reused shape from substitution_score._build_wallclock_index).
- build_busy_bell_ids(lessons, bells) -> for a given teacher and day, the set
  of band-qualified slot ids ("{band}:{slot}") that teacher occupies,
  cross-band bridged: if a teacher has a real lesson at (band A, slot X) on
  day D, and (band B, slot Y) shares any overlapping wall-clock window with
  (band A, slot X) on that same bell grid, the teacher is ALSO busy at
  "B:Y" for the purposes of a cover request targeting band B - i.e. the
  busy set for a (teacher, day) pair is closed under wall-clock overlap
  across all three bands' grids.
- teacher_subjects(lessons) -> {teacher: {subjects taught anywhere}}
- build_request_for_absence(teacher, day, lessons, bells, subject_depts,
  all_real_teachers) -> a dict matching solver.models.SolveRequest shape,
  ready for solver.core.solve().
"""
import json
from pathlib import Path

import pytest

from solver.timetable.precompute_covers import (
    REAL_TEACHERS_EXCLUDE,
    build_busy_bell_ids,
    build_request_for_absence,
    build_wallclock_index,
    is_real_teacher,
    teacher_subjects,
)
from solver.core import solve

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]


def lesson(section, day, slots, subject, teacher, **kw):
    d = {"section": section, "day": day, "slots": list(slots), "subject": subject,
         "teacher": teacher, "non_teaching": False}
    d.update(kw)
    return d


def gr1_6_bells():
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


def gr7_12_bells():
    """P5 shares the exact same wall-clock window as GR1_6's P5
    (11:15-11:55) — the real cross-band collision shape."""
    return [
        {"slot": "P1", "start": "8:00", "end": "8:45", "teaching": True},
        {"slot": "P2", "start": "8:45", "end": "9:30", "teaching": True},
        {"slot": "P3", "start": "9:30", "end": "10:15", "teaching": True},
        {"slot": "B1", "start": "10:15", "end": "10:35", "teaching": False},
        {"slot": "P4", "start": "10:35", "end": "11:15", "teaching": True},
        {"slot": "P5", "start": "11:15", "end": "11:55", "teaching": True},
        {"slot": "P6", "start": "11:55", "end": "12:35", "teaching": True},
        {"slot": "B2", "start": "12:35", "end": "13:20", "teaching": False},
        {"slot": "P7", "start": "13:20", "end": "14:05", "teaching": True},
        {"slot": "P8", "start": "14:05", "end": "14:45", "teaching": True},
    ]


BELLS = {"GR1_6": gr1_6_bells(), "GR7_12": gr7_12_bells()}
SUBJECT_DEPTS = {"Math": "STEM", "Physics": "STEM", "Biology": "STEM",
                 "English": "Humanities", "History": "Humanities"}


# ---------------------------------------------------------------------------
# is_real_teacher / exclusion rules
# ---------------------------------------------------------------------------

def test_excludes_exam_officer_and_new_teacher_placeholder():
    assert not is_real_teacher("Exam Officer")
    assert not is_real_teacher("Melissa - New teacher")


def test_excludes_none_and_composites():
    assert not is_real_teacher(None)
    assert not is_real_teacher("IBZ / H")
    assert not is_real_teacher("H / DV")


def test_includes_ordinary_teacher_name():
    assert is_real_teacher("Mohammed Saab")


# ---------------------------------------------------------------------------
# build_wallclock_index
# ---------------------------------------------------------------------------

def test_wallclock_index_shape():
    idx = build_wallclock_index(BELLS)
    assert idx[("GR1_6", "P1")] == (480, 525)  # 8:00-8:45
    assert idx[("GR7_12", "P5")] == (675, 715)  # 11:15-11:55


# ---------------------------------------------------------------------------
# build_busy_bell_ids — cross-band wall-clock bridging
# ---------------------------------------------------------------------------

def test_busy_bell_ids_includes_own_band_slot():
    lessons = [lesson("Grade 1A", "Mon", ["P1"], "Math", "T1")]
    busy = build_busy_bell_ids("T1", "Mon", lessons, BELLS)
    assert "GR1_6:P1" in busy


def test_busy_bell_ids_bridges_across_bands_on_overlap():
    """T1 teaches GR1_6 P5 (11:15-11:55) on Mon. GR7_12's P5 is the exact
    same wall-clock window -> T1 must ALSO show busy at GR7_12:P5, so a
    cover request targeting GR7_12 P5 correctly excludes T1."""
    lessons = [lesson("Grade 1A", "Mon", ["P5"], "Math", "T1")]
    busy = build_busy_bell_ids("T1", "Mon", lessons, BELLS)
    assert "GR1_6:P5" in busy
    assert "GR7_12:P5" in busy


def test_busy_bell_ids_no_bridge_when_no_overlap():
    """T1 teaches GR1_6 P1 (8:00-8:45). GR7_12 P1 is the identical window
    too (8:00-8:45) so it DOES bridge; but GR7_12 P3 (9:30-10:15) does not
    overlap GR1_6 P1 at all, so it must NOT appear."""
    lessons = [lesson("Grade 1A", "Mon", ["P1"], "Math", "T1")]
    busy = build_busy_bell_ids("T1", "Mon", lessons, BELLS)
    assert "GR7_12:P3" not in busy


def test_busy_bell_ids_scoped_to_requested_day():
    lessons = [lesson("Grade 1A", "Mon", ["P1"], "Math", "T1"),
               lesson("Grade 1A", "Tue", ["P2"], "Math", "T1")]
    busy_mon = build_busy_bell_ids("T1", "Mon", lessons, BELLS)
    assert "GR1_6:P2" not in busy_mon  # that lesson is Tuesday, not Monday


def test_busy_bell_ids_ignores_other_teachers():
    lessons = [lesson("Grade 1A", "Mon", ["P1"], "Math", "T1"),
               lesson("Grade 1B", "Mon", ["P2"], "Math", "T2")]
    busy = build_busy_bell_ids("T1", "Mon", lessons, BELLS)
    assert "GR1_6:P2" not in busy


# ---------------------------------------------------------------------------
# teacher_subjects
# ---------------------------------------------------------------------------

def test_teacher_subjects_collects_across_all_lessons():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Mon", ["P2"], "Physics", "T1"),
        lesson("Grade 1C", "Sun", ["P1"], "History", "T2"),
    ]
    subs = teacher_subjects(lessons)
    assert subs["T1"] == {"Math", "Physics"}
    assert subs["T2"] == {"History"}


def test_teacher_subjects_skips_unstaffed_and_composites():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", None),
        lesson("Grade 1B", "Mon", ["P2"], "Physics", "IBZ / H"),
    ]
    subs = teacher_subjects(lessons)
    assert None not in subs
    assert "IBZ / H" not in subs


# ---------------------------------------------------------------------------
# build_request_for_absence — full request assembly, small synthetic case
# ---------------------------------------------------------------------------

def test_build_request_for_absence_basic_shape_and_solve():
    """T1 (Math) is absent Monday, 1 lesson to cover (Grade 1A Math P1).
    T2 also teaches Math and is free at GR1_6 P1 Monday -> solver should
    cover it same_subject."""
    lessons = [
        lesson("Grade 1A", "Mon", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Mon", ["P3"], "Math", "T2"),  # T2 free at P1 Mon
        lesson("Grade 1C", "Mon", ["P1"], "History", "T3"),  # T3 busy + irrelevant
    ]
    all_teachers = ["T1", "T2", "T3"]
    req = build_request_for_absence("T1", "Mon", lessons, BELLS, SUBJECT_DEPTS,
                                     all_teachers)
    assert req["absences"][0]["teacher_id"] == "T1"
    assert req["absences"][0]["periods"] == "all"
    assert len(req["slots_to_cover"]) == 1
    slot = req["slots_to_cover"][0]
    assert slot["subject_id"] == "Math"
    assert slot["section_id"] == "Grade 1A"
    teacher_ids = {t["teacher_id"] for t in req["teachers"]}
    assert teacher_ids == {"T2", "T3"}  # absent teacher excluded from pool

    resp = solve(req)
    assert resp["summary"]["filled"] == 1
    assert resp["assignments"][0]["substitute_teacher_id"] == "T2"
    assert resp["assignments"][0]["match_type"] == "same_subject"


def test_build_request_for_absence_no_lessons_that_day_raises_or_empty():
    """A teacher with zero lessons on the given day should not be asked to
    build a (vacuous) request — the caller (main()) is responsible for
    skipping such (teacher, day) pairs; the helper itself just returns a
    request with an empty slots_to_cover list, which solve() accepts as
    trivially solved (0 of 0)."""
    lessons = [lesson("Grade 1A", "Mon", ["P1"], "Math", "T1")]
    req = build_request_for_absence("T1", "Tue", lessons, BELLS, SUBJECT_DEPTS,
                                     ["T1"])
    assert req["slots_to_cover"] == []
    resp = solve(req)
    assert resp["status"] == "solved"
    assert resp["summary"]["slots_total"] == 0


# ---------------------------------------------------------------------------
# Integration: real artifacts, Mohammed Saab Monday cross-check
#
# Not marked `slow` (see pytest.ini) — this is a single-teacher, 5-slot solve
# over the committed real artifacts (fast, no DB), and is the spec's
# must-pass cross-check, so it runs by default with the rest of the suite.
# ---------------------------------------------------------------------------

def test_saab_monday_real_data_cross_check():
    """Validated Phase D dry-run: Mohammed Saab absent all day Monday ->
    5 of 5 Math lessons covered, all same-subject (adapter_2526.py's
    documented result, replicated here purely from committed artifacts
    instead of a DB connection)."""
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())

    all_teachers = sorted({l["teacher"] for l in canonical if is_real_teacher(l["teacher"])})
    assert "Mohammed Saab" in all_teachers

    req = build_request_for_absence("Mohammed Saab", "Mon", canonical, bells,
                                     subject_depts, all_teachers)
    assert len(req["slots_to_cover"]) == 5

    resp = solve(req)
    assert resp["summary"]["slots_total"] == 5
    assert resp["summary"]["filled"] == 5
    assert resp["summary"]["unfilled"] == 0
    assert all(a["match_type"] == "same_subject" for a in resp["assignments"])
