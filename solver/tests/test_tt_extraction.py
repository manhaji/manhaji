"""Phase A acceptance tests for the ISO 25-26 timetable-PDF extraction.

Golden fixtures were HAND-TRANSCRIBED by the controller from the source pages
(solver/tests/fixtures/tt2526/). They are the ground truth the parser is graded
against — never regenerate them from parser output.

Contract under test: etl/ttparse.py
  parse_classes(pdf_path)  -> [{"section", "day", "slots", "subject", "teacher"}]
  parse_teachers(pdf_path) -> [{"teacher", "day", "slots", "subject", "classes"}]
Slot codes are band-relative: P1..P8 plus B1/B2 (a lesson taught inside a break
column, e.g. Grade 4C Math-Support). Days: Sun/Mon/Tue/Wed/Thu. All strings
whitespace-normalized (internal runs collapsed to one space, stripped).
"""
import json
import re
from pathlib import Path

import pytest

from etl.ttparse import parse_classes, parse_teachers

ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "tt2526"
CLASSES_PDF = ROOT / "data/source/Classes TT _ ACAD 25-26 _ Ver 19.pdf"
TEACHERS_PDF = ROOT / "data/source/Teachers TT _ ACAD 25-26 _ Ver 19.pdf"

DAYS = {"Sun", "Mon", "Tue", "Wed", "Thu"}
SLOTS = {f"P{i}" for i in range(1, 9)} | {"B1", "B2"}

EXPECTED_SECTIONS = [
    "KG1 A", "KG1 B", "KG2 A", "KG2 B",
    "Grade 1A", "Grade 1B", "Grade 1C",
    "Grade 2A", "Grade 2B", "Grade 2C", "Grade 2AL",
    "Grade 3A", "Grade 3B", "Grade 3C", "Grade 3AL",
    "Grade 4A", "Grade 4B", "Grade 4C", "Grade 4AL",
    "Grade 5A", "Grade 5B", "Grade 5C", "Grade 5 AL",
    "Grade 6A", "Grade 6B", "Grade 6C", "Grade 6 AL",
    "Grade 7A", "Grade 7B", "Grade 7C",
    "Grade 8A", "Grade 8B", "Grade 9A", "Grade 9B",
    "Grade 10A", "Grade 10B",
    "Grade 11A-GED", "Grade 11B-AS",
    "Grade 12A-GED", "Grade 12B-GED", "Grade 12C-A2",
]

EXPECTED_TEACHER_COUNT = 66  # 64 named + "Exam Officer" + "Melissa - New teacher"


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def lesson_key(lesson):
    return (lesson["day"], tuple(lesson["slots"]), norm(lesson["subject"]),
            norm(lesson["teacher"]) if lesson.get("teacher") else None)


@pytest.fixture(scope="module")
def classes():
    return parse_classes(str(CLASSES_PDF))


@pytest.fixture(scope="module")
def teachers():
    return parse_teachers(str(TEACHERS_PDF))


# ---------- golden pages ----------

def golden(name):
    return json.loads((FIXTURES / name).read_text())


def section_lessons(classes, section):
    return [l for l in classes if norm(l["section"]) == section]


def test_golden_kg1a_exact(classes):
    g = golden("golden_kg1a.json")
    got = sorted(map(lesson_key, section_lessons(classes, g["section"])))
    want = sorted(map(lesson_key, g["lessons"]))
    assert got == want


def test_golden_grade4c_exact(classes):
    g = golden("golden_grade4c.json")
    got = sorted(map(lesson_key, section_lessons(classes, g["section"])))
    want = sorted(map(lesson_key, g["lessons"]))
    assert got == want


def test_golden_grade11bas_spots(classes):
    g = golden("golden_grade11bas_spots.json")
    lessons = section_lessons(classes, g["section"])
    for spot in g["spots"]:
        cell = [(norm(l["subject"]), norm(l["teacher"]) if l.get("teacher") else None)
                for l in lessons
                if l["day"] == spot["day"] and spot["slot"] in l["slots"]]
        want = [(norm(s), norm(t) if t else None) for s, t in spot["entries"]]
        label = f"{g['section']} {spot['day']} {spot['slot']}"
        if spot["mode"] == "exact_set":
            assert sorted(cell) == sorted(want), f"{label}: {cell} != {want}"
        else:  # contains
            for pair in want:
                if pair[1] is None:
                    assert any(c[0] == pair[0] for c in cell), f"{label}: missing {pair[0]}"
                else:
                    assert pair in cell, f"{label}: missing {pair}"


# ---------- census + invariants ----------

def test_all_41_sections_present(classes):
    assert sorted({norm(l["section"]) for l in classes}) == sorted(EXPECTED_SECTIONS)


def test_all_66_teacher_pages_present(teachers):
    assert len({norm(l["teacher"]) for l in teachers} |
               set()) <= EXPECTED_TEACHER_COUNT
    # every page yields at least one lesson except possibly placeholders;
    # the parser must report its page census explicitly:
    from etl.ttparse import teacher_page_census
    assert len(teacher_page_census(str(TEACHERS_PDF))) == EXPECTED_TEACHER_COUNT


def test_days_and_slots_valid(classes, teachers):
    for l in classes + teachers:
        assert l["day"] in DAYS, l
        assert l["slots"], l
        assert set(l["slots"]) <= SLOTS, l


def test_kg_sections_have_no_late_periods(classes):
    for sec in ("KG1 A", "KG1 B", "KG2 A", "KG2 B"):
        slots = {s for l in section_lessons(classes, sec) for s in l["slots"]}
        assert not slots & {"P7", "P8"}, f"{sec} shows lessons in P7/P8: {slots}"


def test_no_break_placeholder_pseudo_lessons(classes):
    bad = [l for l in classes if re.sub(r"[\s-]", "", l["subject"]).upper() == "X"]
    assert not bad, f"{len(bad)} '-X-' placeholders leaked as lessons"


def test_every_section_page_yields_lessons(classes):
    counts = {}
    for l in classes:
        counts[norm(l["section"])] = counts.get(norm(l["section"]), 0) + 1
    thin = {s: c for s, c in counts.items() if c < 20}
    assert not thin, f"suspiciously thin sections (parser dropping cells?): {thin}"
