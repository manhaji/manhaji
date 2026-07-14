"""Unit tests for solver/timetable/benchmark.py metric computations.

Small hand-verified synthetic fixtures — each test asserts an exact expected
count computed by inspection, not by re-deriving the logic under test.
"""
from solver.timetable.benchmark import compute_metrics, compute_idle_gaps

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]


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


def kg_bells():
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


BELLS = {"KG": kg_bells(), "GR1_6": gr1_6_bells()}


def lesson(section, day, slots, subject, teacher="T1", **kw):
    d = {"section": section, "day": day, "slots": slots, "subject": subject,
         "teacher": teacher}
    d.update(kw)
    return d


def rule(section, subject, per_week, max_per_day, has_double=False):
    return {"section": section, "subject": subject, "per_week": per_week,
            "max_per_day": max_per_day, "has_double": has_double}


def test_exactly_one_teacher_clash_detected():
    """Two lessons, same teacher, same (day,slot), DIFFERENT sections (so it
    can't be explained by legal section overlap) -> exactly 1 clash."""
    lessons = [
        lesson("KG1 A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("KG1 B", "Sun", ["P1"], "English", teacher="T1"),
        # a clean non-clashing lesson to prove we don't over-count
        lesson("KG1 A", "Mon", ["P1"], "Art", teacher="T1"),
    ]
    metrics = compute_metrics(lessons, BELLS, {}, [], DAYS)
    assert metrics["teacher_clash_count"] == 1


def test_zero_teacher_clash_when_all_clean():
    lessons = [
        lesson("KG1 A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("KG1 A", "Sun", ["P2"], "English", teacher="T1"),
    ]
    metrics = compute_metrics(lessons, BELLS, {}, [], DAYS)
    assert metrics["teacher_clash_count"] == 0


def test_illegal_overlap_detected_for_unpaired_subjects():
    """Same section, same slot, subjects NOT in any parallel_groups entry
    -> exactly 1 illegal overlap. Different teachers so it isn't also a
    teacher clash (isolating the metric)."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P1"], "Science", teacher="T2"),
    ]
    metrics = compute_metrics(lessons, BELLS, {}, [], DAYS)
    assert metrics["illegal_overlap_count"] == 1


def test_legal_overlap_not_counted_as_illegal():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Arabic", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P1"], "French", teacher="T2"),
    ]
    pg = {"Grade 1A": [{"subjects": ["Arabic", "French"], "count": 1}]}
    metrics = compute_metrics(lessons, BELLS, pg, [], DAYS)
    assert metrics["illegal_overlap_count"] == 0


def test_subject_overlapping_itself_is_always_illegal():
    """Even if a parallel_groups entry nominally contains the subject with
    itself alongside another, a subject can never overlap ITSELF."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Arabic", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P1"], "Arabic", teacher="T2"),
    ]
    pg = {"Grade 1A": [{"subjects": ["Arabic", "French"], "count": 1}]}
    metrics = compute_metrics(lessons, BELLS, pg, [], DAYS)
    assert metrics["illegal_overlap_count"] == 1


def test_per_day_cap_violation_detected():
    """max_per_day=1 but 2 lessons of the same (section,subject) land on the
    same day -> exactly 1 violating triple."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P2"], "Math", teacher="T1"),
    ]
    mined = [rule("Grade 1A", "Math", 2, 1)]
    metrics = compute_metrics(lessons, BELLS, {}, mined, DAYS)
    assert metrics["per_day_cap_violation_count"] == 1


def test_spread_score_counts_excess_beyond_one_per_day():
    """3 Math lessons for the same section on the same day -> excess = 2
    (max(0, count-1)); 0 on all other days -> total spread score 2."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P2"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P3"], "Math", teacher="T1"),
    ]
    mined = [rule("Grade 1A", "Math", 3, 4)]
    metrics = compute_metrics(lessons, BELLS, {}, mined, DAYS)
    assert metrics["spread_score"] == 2


def test_teacher_daily_balance_ignores_zero_days():
    """T1 teaches 3 slots on Sun, 1 slot on Mon, 0 on Tue/Wed/Thu.
    max daily load = 3, min NONZERO daily load = 1 -> balance = 2."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P2"], "English", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P3"], "Science", teacher="T1"),
        lesson("Grade 1A", "Mon", ["P1"], "Art", teacher="T1"),
    ]
    metrics = compute_metrics(lessons, BELLS, {}, [], DAYS)
    assert metrics["teacher_balance"]["per_teacher"]["T1"] == 2


def test_teacher_daily_balance_zero_for_single_day_teacher():
    """A teacher who works exactly one day has balance 0 (max == min == that
    day's load, no other nonzero day to differ from)."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P2"], "English", teacher="T1"),
    ]
    metrics = compute_metrics(lessons, BELLS, {}, [], DAYS)
    assert metrics["teacher_balance"]["per_teacher"]["T1"] == 0


def test_idle_gaps_within_single_band_day():
    """GR1_6 band, teacher teaches P1 and P4 on Sun (both teaching slots,
    P2/P3 sit strictly between them in table order and are free teaching
    slots) -> 2 idle gap slots (P2, P3) that Sunday. B1 (a break, not a
    teaching slot) does not count as an idle teaching slot."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P4"], "English", teacher="T1"),
    ]
    gaps = compute_idle_gaps(lessons, BELLS, DAYS)
    assert gaps["per_teacher"]["T1"] == 2
    assert gaps["grand_total"] == 2


def test_idle_gaps_zero_when_contiguous():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P2"], "English", teacher="T1"),
    ]
    gaps = compute_idle_gaps(lessons, BELLS, DAYS)
    assert gaps["per_teacher"]["T1"] == 0


def test_idle_gaps_cross_band_treated_as_independent_subschedules():
    """A teacher with lessons in a KG section AND a GR1_6 section on the SAME
    day: per the documented modeling choice, these are two independent
    per-band sub-schedules for gap purposes, not a merged school-wide
    sequence. KG lesson at P1 only (no gap possible alone); GR1_6 lesson at
    P1 and P4 (2-slot gap, per the previous test). Total for that teacher
    that day = 0 (KG sub-schedule) + 2 (GR1_6 sub-schedule) = 2."""
    lessons = [
        lesson("KG1 A", "Sun", ["P1"], "Math", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P1"], "English", teacher="T1"),
        lesson("Grade 1A", "Sun", ["P4"], "Science", teacher="T1"),
    ]
    gaps = compute_idle_gaps(lessons, BELLS, DAYS)
    assert gaps["per_teacher"]["T1"] == 2
