"""Unit tests for solver/timetable/substitution_score.py — the
SUBSTITUTION-FRIENDLINESS benchmark dimension.

Small hand-verified synthetic fixtures — each test asserts an exact expected
result computed by inspection (paper-and-pencil), not by re-deriving the
logic under test. Fixtures follow the conventions of test_benchmark.py
(bells shape, lesson dict shape).
"""
from solver.timetable.substitution_score import score

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


def gr7_12_bells():
    """Own bell rows, but P5 shares the EXACT same wall-clock window as
    GR1_6's P5 (11:15-11:55) under a different slot label context (own
    band) — this is the real cross-band collision shape from the school's
    actual bell tables (adapter_2526.py's documented bug)."""
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


def lesson(section, day, slots, subject, teacher, **kw):
    d = {"section": section, "day": day, "slots": slots, "subject": subject,
         "teacher": teacher, "non_teaching": False, "unstaffed": teacher is None}
    d.update(kw)
    return d


SUBJECT_DEPTS = {"Math": "STEM", "Physics": "STEM", "Biology": "STEM",
                 "English": "Humanities", "History": "Humanities"}


def test_lesson_with_one_free_same_subject_sub_is_covered_depth_1():
    """T1 teaches Math P1 Sun. T2 also teaches Math somewhere in this
    timetable and is free at P1 Sun (no lesson then). T3 is irrelevant
    (different subject/dept) and busy anyway.
    Expected: T1's Math/P1/Sun lesson is covered (tier 1), cover depth 1."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Mon", ["P2"], "Math", "T2"),  # T2 teaches Math, free Sun P1
        lesson("Grade 1C", "Sun", ["P1"], "History", "T3"),  # busy + irrelevant
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    fragile_keys = {(f["section"], f["subject"], f["teacher"], f["day"])
                    for f in result["fragile_lessons"]}
    assert ("Grade 1A", "Math", "T1", "Sun") not in fragile_keys
    lesson_entry = _find_lesson(result, "Grade 1A", "Math", "T1", "Sun")
    assert lesson_entry["min_slot_same_subject_depth"] == 1
    assert result["pct_lessons_with_same_subject_cover"] > 0


def test_same_subject_teacher_busy_but_dept_mate_free_is_tier2_only():
    """T1 teaches Math P1 Sun. T2 (also Math) is BUSY at P1 Sun (teaching
    elsewhere). T3 teaches Physics (STEM dept, same as Math) and is free at
    P1 Sun. Expected: zero free tier-1 candidates (fragile @ tier 1), but
    tier-1-or-2 cover exists via T3 (dept match)."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Sun", ["P1"], "Math", "T2"),      # same subject, busy
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),      # establishes T2 teaches Math
        lesson("Grade 1C", "Mon", ["P1"], "Physics", "T3"),   # establishes T3 teaches Physics
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    entry = _find_lesson(result, "Grade 1A", "Math", "T1", "Sun")
    assert entry["min_slot_same_subject_depth"] == 0
    assert entry["min_slot_same_subject_or_dept_depth"] == 1
    fragile_keys = {(f["section"], f["subject"], f["teacher"], f["day"])
                    for f in result["fragile_lessons"]}
    assert ("Grade 1A", "Math", "T1", "Sun") in fragile_keys
    fragile_entry = _find_fragile(result, "Grade 1A", "Math", "T1", "Sun")
    assert fragile_entry["fails_tier"] == "tier1_only"


def test_nobody_relevant_free_is_fragile_both_tiers():
    """T1 teaches Math P1 Sun. T2 (Math) busy at P1 Sun. No other teacher in
    the timetable teaches Math or a dept-mate subject. Expected: fragile at
    both tiers (zero eligible free candidates at any tier)."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Sun", ["P1"], "Math", "T2"),
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
        lesson("Grade 1C", "Mon", ["P1"], "History", "T3"),  # irrelevant dept
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    entry = _find_lesson(result, "Grade 1A", "Math", "T1", "Sun")
    assert entry["min_slot_same_subject_depth"] == 0
    assert entry["min_slot_same_subject_or_dept_depth"] == 0
    fragile_entry = _find_fragile(result, "Grade 1A", "Math", "T1", "Sun")
    assert fragile_entry["fails_tier"] == "both"


def test_cross_band_wall_clock_collision_makes_free_teacher_busy():
    """T2 teaches Math in GR7_12 band at P5 (11:15-11:55). The lesson to
    cover is T1's Math lesson in GR1_6 band at P5 (11:15-11:55) — the EXACT
    same wall-clock window under a different band's slot label. A naive
    same-band-only check would see T2 as free (T2 has no GR1_6 P5 lesson);
    the correct wall-clock check must mark T2 busy, so this lesson is
    fragile despite T2 'looking' free if you only compared slot labels."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P5"], "Math", "T1"),        # GR1_6 P5 == 11:15-11:55
        lesson("Grade 9A", "Sun", ["P5"], "Math", "T2"),        # GR7_12 P5 == 11:15-11:55 (same clock)
        lesson("Grade 9B", "Mon", ["P1"], "Math", "T2"),        # establishes T2 teaches Math
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    entry = _find_lesson(result, "Grade 1A", "Math", "T1", "Sun")
    assert entry["min_slot_same_subject_depth"] == 0
    fragile_entry = _find_fragile(result, "Grade 1A", "Math", "T1", "Sun")
    assert fragile_entry is not None


def test_double_lesson_covered_slot1_not_slot2_is_not_covered():
    """T1 teaches a double Math lesson P1-P2 Sun (Grade 1A). T2 (Math) is
    free at P1 but busy at P2 (teaching elsewhere at P2). Per the spec, a
    multi-slot lesson is covered only if EVERY slot has >= 1 eligible free
    candidate -> this lesson is NOT covered even though slot 1 has cover."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1", "P2"], "Math", "T1"),
        lesson("Grade 1B", "Sun", ["P2"], "Math", "T2"),       # busy at P2
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),       # establishes T2 teaches Math, free P1 Sun
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    entry = _find_lesson(result, "Grade 1A", "Math", "T1", "Sun")
    # slot-by-slot depths: P1 has T2 free (depth 1), P2 has T2 busy (depth 0)
    assert entry["per_slot_same_subject_depth"] == {"P1": 1, "P2": 0}
    assert entry["covered_same_subject"] is False
    fragile_entry = _find_fragile(result, "Grade 1A", "Math", "T1", "Sun")
    assert fragile_entry is not None
    assert "P2" in fragile_entry["failing_slots"]


def test_non_teaching_lessons_skipped_and_unstaffed_counted_as_vacancy():
    lessons = [
        lesson("Grade 1A", "Thu", ["P4"], "Library", None, non_teaching=True),
        lesson("Grade 1A", "Sun", ["P1"], "Math", None),  # unstaffed teaching lesson (vacancy)
        lesson("Grade 1B", "Sun", ["P1"], "Math", "T2"),
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    assert result["vacancy_count"] == 1
    # The non_teaching Library lesson must not appear as a scored lesson at all.
    assert not any(l["subject"] == "Library" for l in result["lessons"])
    assert not any(l["teacher"] is None for l in result["lessons"])


def test_subject_absent_from_department_map_reports_affected_count():
    """A subject with no entry in subject_departments contributes no
    department for tier-2 purposes, and the count of lessons affected by
    this gap is reported."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Woodwork", "T1"),  # not in SUBJECT_DEPTS
        lesson("Grade 1B", "Sun", ["P1"], "Math", "T2"),
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    assert result["lessons_with_subject_missing_from_dept_map"] == 1


def test_saab_cross_check_style_multi_slot_all_covered():
    """Sanity check on the mechanics used for the real Mohammed-Saab
    cross-check: 5 single-slot Math lessons on Mon across 5 different
    sections/bands worth of GR7_12, each with a distinct free same-subject
    Math teacher at that exact slot -> all 5 covered, depth >= 1 each."""
    lessons = [
        lesson("Grade 9A", "Mon", ["P8"], "Math", "Saab"),
        lesson("Grade 10B", "Mon", ["P5"], "Math", "Saab"),
        lesson("Grade 11A", "Mon", ["P3"], "Math", "Saab"),
        lesson("Grade 12A", "Mon", ["P1"], "Math", "Saab"),
        lesson("Grade 12B", "Mon", ["P7"], "Math", "Saab"),
        # a Math colleague who is free at all 5 of those Mon slots (teaches
        # Math only on Sun, establishing tier-1 relevance without colliding)
        lesson("Grade 9B", "Sun", ["P1"], "Math", "MathColleague"),
    ]
    result = score(lessons, BELLS, SUBJECT_DEPTS)
    for sec, slot in [("Grade 9A", "P8"), ("Grade 10B", "P5"),
                      ("Grade 11A", "P3"), ("Grade 12A", "P1"),
                      ("Grade 12B", "P7")]:
        entry = _find_lesson(result, sec, "Math", "Saab", "Mon")
        assert entry["min_slot_same_subject_depth"] >= 1, (sec, slot, entry)


def _find_lesson(result, section, subject, teacher, day):
    for l in result["lessons"]:
        if (l["section"] == section and l["subject"] == subject
                and l["teacher"] == teacher and l["day"] == day):
            return l
    raise AssertionError(f"lesson not found: {section}/{subject}/{teacher}/{day}")


def _find_fragile(result, section, subject, teacher, day):
    for f in result["fragile_lessons"]:
        if (f["section"] == section and f["subject"] == subject
                and f["teacher"] == teacher and f["day"] == day):
            return f
    return None
