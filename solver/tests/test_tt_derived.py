"""Phase B acceptance tests: derived builder-inputs from the extracted 25-26 TT.

Contract under test: etl/derive_inputs.py
  derive(classes, teachers, exceptions) -> {
    "canonical": [...], "load_matrix": [...], "bells": {...},
    "parallel_groups": {...}, "mined_rules": [...]
  }
plus a CLI writing data/processed/tt_2526/derived/*.json + derived_summary.md.

Shapes:
- canonical lesson: classes-view record + {"co_teachers": [..] when "/" in teacher,
  "unstaffed": true when teacher is None AND subject is a teaching subject,
  "non_teaching": true for Exam/Library}. The 4 documented over-span lessons
  (reconciliation_exceptions.json, overspan=true) have their slots TRIMMED to the
  teacher-view placement.
- load_matrix row: {"teacher", "section", "subject", "weekly_slots"} (slots counted,
  so a 2-period span counts 2; B1/B2 support lessons count and are included).
- bells: {"KG"|"GR1_6"|"GR7_12": [{"slot", "start", "end", "teaching": bool}, ...]}
  in day order; times as printed in the headers (e.g. "8:00").
- parallel_groups: {section: [{"subjects": sorted([...]), "count": n}, ...]} —
  distinct co-occurring subject-sets (from stacked same-day-same-slot entries),
  singletons excluded.
- mined_rules row: {"section", "subject", "per_week", "max_per_day",
  "has_double": bool}.

Expectations below are derived ONLY from the controller's hand-made golden
fixtures and the adversarially verified band tables/spot checks — never from
the code under test.
"""
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data/processed/tt_2526/derived"


@pytest.fixture(scope="module")
def derived():
    from etl.derive_inputs import derive_all
    return derive_all()


def rows(derived, name):
    return derived[name]


# ---------- bells (must equal the verified band tables) ----------

EXPECTED_BELLS = {
    "KG": [
        {"slot": "P1", "start": "8:00", "end": "8:45", "teaching": True},
        {"slot": "P2", "start": "8:45", "end": "9:30", "teaching": True},
        {"slot": "B1", "start": "9:30", "end": "9:50", "teaching": False},
        {"slot": "P3", "start": "9:50", "end": "10:35", "teaching": True},
        {"slot": "P4", "start": "10:35", "end": "11:15", "teaching": True},
        {"slot": "B2", "start": "11:15", "end": "11:55", "teaching": False},
        {"slot": "P5", "start": "11:55", "end": "12:35", "teaching": True},
        {"slot": "P6", "start": "12:35", "end": "13:20", "teaching": True},
    ],
    "GR1_6": [
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
    ],
    "GR7_12": [
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
    ],
}


def test_bells_match_verified_band_tables(derived):
    assert derived["bells"] == EXPECTED_BELLS


# ---------- load matrix (expectations counted by hand from goldens) ----------

def lm_lookup(derived, teacher, section, subject):
    hits = [r for r in derived["load_matrix"]
            if r["teacher"] == teacher and r["section"] == section
            and r["subject"] == subject]
    assert len(hits) <= 1, hits
    return hits[0]["weekly_slots"] if hits else 0


def test_load_matrix_golden_counts(derived):
    assert lm_lookup(derived, "Jo-Anne Venketas", "KG1 A", "English") == 13
    assert lm_lookup(derived, "Jo-Anne Venketas", "KG1 A", "Math") == 5
    assert lm_lookup(derived, "Rayan Al Humaimi", "KG1 A", "Arabic") == 7
    assert lm_lookup(derived, "Fateme Ghajarian", "KG1 A", "PE") == 2
    assert lm_lookup(derived, "Yasmeen Ali", "Grade 4C", "Math") == 6
    assert lm_lookup(derived, "Rafah Al Khatib", "Grade 4C", "Arabic") == 8
    assert lm_lookup(derived, "Ghada Albhaisi", "Grade 4C", "Math - Support") == 2
    # the Sunday PE double (IBZ / H) counts 2 slots:
    assert lm_lookup(derived, "IBZ / H", "Grade 4C", "PE") == 2


def test_load_matrix_totals_are_consistent(derived):
    total = sum(r["weekly_slots"] for r in derived["load_matrix"])
    staffed_slots = sum(
        len(l["slots"]) for l in derived["canonical"]
        if l.get("teacher") and not l.get("non_teaching"))
    assert total == staffed_slots


# ---------- canonical: over-span trims + unstaffed flags ----------

def canon_find(derived, section, day, subject, teacher):
    return [l for l in derived["canonical"]
            if l["section"] == section and l["day"] == day
            and l["subject"] == subject and l.get("teacher") == teacher]


def test_overspans_trimmed_to_teacher_view(derived):
    # the 4 verified over-spans collapse to their true single period
    cases = [
        ("Grade 12C-A2", "Sun", "Biology", "Hilda Mucharafieh", ["P8"]),
        ("Grade 12C-A2", "Tue", "Economics", "Mohd Wassim", ["P4"]),
        ("Grade 12C-A2", "Wed", "Economics", "Mohd Wassim", ["P2"]),
        ("Grade 12C-A2", "Thu", "Physics", "Hussein Kameh", ["P8"]),
    ]
    for section, day, subject, teacher, want_slots in cases:
        hits = canon_find(derived, section, day, subject, teacher)
        assert len(hits) == 1, (section, day, subject, hits)
        assert hits[0]["slots"] == want_slots, hits[0]


def test_grade10_english_vacancy_is_flagged(derived):
    for section in ("Grade 10A", "Grade 10B"):
        unstaffed = [l for l in derived["canonical"]
                     if l["section"] == section and l.get("unstaffed")
                     and l["subject"].lower().startswith("eng")]
        n_slots = sum(len(l["slots"]) for l in unstaffed)
        assert n_slots >= 5, f"{section}: expected >=5 unstaffed English slots, got {n_slots}"


def test_exam_and_library_are_non_teaching_not_unstaffed(derived):
    for l in derived["canonical"]:
        if l["subject"] in ("Exam", "Library"):
            assert l.get("non_teaching"), l
            assert not l.get("unstaffed"), l


# ---------- parallel groups (from golden/verified stacked cells) ----------

def groups_for(derived, section):
    return [set(g["subjects"]) for g in derived["parallel_groups"].get(section, [])]


def test_parallel_groups_spot_checks(derived):
    g4c = groups_for(derived, "Grade 4C")
    assert {"Eng - Supp", "Wellbeing"} in g4c
    g11 = groups_for(derived, "Grade 11B-AS")
    assert {"Chemistry", "Economics"} in g11
    assert {"Business Studies", "Bio SS", "ICT"} in g11
    # KG1 A has no stacked cells at all:
    assert groups_for(derived, "KG1 A") == []


# ---------- mined rules (hand-derivable from goldens) ----------

def rule_for(derived, section, subject):
    hits = [r for r in derived["mined_rules"]
            if r["section"] == section and r["subject"] == subject]
    assert len(hits) == 1, hits
    return hits[0]


def test_mined_rules_golden_spots(derived):
    r = rule_for(derived, "KG1 A", "Math")
    assert r["per_week"] == 5 and r["max_per_day"] == 1 and not r["has_double"]
    r = rule_for(derived, "KG1 A", "English")
    assert r["per_week"] == 13 and r["max_per_day"] == 4
    r = rule_for(derived, "Grade 4C", "PE")
    assert r["per_week"] == 2 and r["max_per_day"] == 2 and r["has_double"]
    r = rule_for(derived, "Grade 4C", "Arabic")
    assert r["per_week"] == 8 and r["max_per_day"] == 2 and not r["has_double"]


# ---------- artifacts exist after CLI run ----------

def test_cli_artifacts_exist():
    for name in ("canonical_lessons.json", "load_matrix.json", "bells.json",
                 "parallel_groups.json", "mined_rules.json"):
        assert (DERIVED / name).exists(), f"run the CLI: missing {name}"
    assert (DERIVED / "derived_summary.md").exists()
