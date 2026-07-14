"""TDD for solver/timetable/gen2627.py — the 2026-27 fresh-timetable
generator's mapping layer (pure helpers) plus an integration check of the
real pipeline output.

Layers under test:
(a) SUBJECT_CODE_TO_CANONICAL — 26-27 subject_code -> 25-26 canonical
    subject name (for inheriting mined rules/parallel catalogs), all 32
    codes in data/processed/subjects.json.
(b) section_band() — every code in data/processed/sections.json maps to a
    band (KG / GR1_6 / GR7_12).
(c) SECTION_COUNTERPARTS — 26-27 section code -> list of 25-26 counterpart
    section names (for rule inheritance); combined AL sections inherit the
    UNION of their grade counterparts.
(d) shed_overcommitted() — teachers whose (subject-code-filtered) weekly
    demand exceeds 30 cells shed the excess from their single largest
    demand row, deterministically, and are gap-reported.
(e) expand_demand() — total expanded lesson count = sum(weekly_periods)
    minus any shed amounts (excluding None/"?" rows).
(f) per-day cap fallback formula: max(2, ceil(weekly/5)).
"""
import json
import math
from pathlib import Path

import pytest

from solver.timetable import gen2627

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
DERIVED_2526 = PROCESSED / "tt_2526" / "derived"


@pytest.fixture(scope="module")
def subjects():
    return json.loads((PROCESSED / "subjects.json").read_text())


@pytest.fixture(scope="module")
def sections():
    return json.loads((PROCESSED / "sections.json").read_text())


@pytest.fixture(scope="module")
def load_matrix():
    return json.loads((PROCESSED / "load_matrix.json").read_text())


@pytest.fixture(scope="module")
def teachers():
    return json.loads((PROCESSED / "teachers.json").read_text())


@pytest.fixture(scope="module")
def mined_rules():
    return json.loads((DERIVED_2526 / "mined_rules.json").read_text())


@pytest.fixture(scope="module")
def parallel_groups():
    return json.loads((DERIVED_2526 / "parallel_groups.json").read_text())


# ---------------------------------------------------------------------------
# (a) subject-code mapping
# ---------------------------------------------------------------------------

def test_all_32_subject_codes_resolve(subjects):
    codes = {s["code"] for s in subjects}
    assert len(codes) == 32
    for code in codes:
        assert code in gen2627.SUBJECT_CODE_TO_CANONICAL, (
            f"subject code {code!r} has no canonical-name mapping")


@pytest.mark.parametrize("code,expected", [
    ("Ma", "Math"),
    ("En", "English"),
    ("PE", "PE"),
    ("IS", "Islamic Studies"),
    ("Sc", "Science"),
    ("IT", "ICT"),
])
def test_subject_code_spot_checks(code, expected):
    assert gen2627.SUBJECT_CODE_TO_CANONICAL[code] == expected


def test_bi_ap_has_no_25_26_counterpart_but_resolves_to_a_name():
    # documented: ISO's 25-26 data has no AP track; AP codes fall back to
    # their own subjects.json name and inherit no mined rules.
    assert gen2627.SUBJECT_CODE_TO_CANONICAL["Bi AP"] == "Biology (Advanced)"
    assert "Bi AP" in gen2627.SUBJECT_CODES_WITH_NO_25_26_COUNTERPART


def test_subject_mapping_values_that_do_have_counterparts_appear_in_2526_data():
    # canonical_lessons.json (not mined_rules.json) is the right ground
    # truth here: "Exam" is a real 25-26 subject name but never gets a
    # mined per-day rule (locked lessons are never rule-mined), so checking
    # against mined_rules would wrongly flag it as counterpart-less.
    canonical = json.loads(
        (DERIVED_2526 / "canonical_lessons.json").read_text())
    names_2526 = {l["subject"] for l in canonical}
    for code, name in gen2627.SUBJECT_CODE_TO_CANONICAL.items():
        if code in gen2627.SUBJECT_CODES_WITH_NO_25_26_COUNTERPART:
            continue
        assert name in names_2526, (
            f"{code!r} -> {name!r} claims a 25-26 counterpart but {name!r} "
            "never appears in canonical_lessons.json")


# ---------------------------------------------------------------------------
# (b) section -> band, every sections.json code
# ---------------------------------------------------------------------------

def test_every_section_maps_to_a_band(sections):
    for s in sections:
        band = gen2627.section_band(s["code"])
        assert band in ("KG", "GR1_6", "GR7_12"), (
            f"section {s['code']!r} produced unexpected band {band!r}")


def test_kg_sections_map_to_kg_band():
    for code in ("K1A", "KG1B", "KG2A", "KG2B", "KG2C"):
        assert gen2627.section_band(code) == "KG"


def test_primary_and_al_sections_map_to_gr1_6():
    for code in ("1A", "3B", "6C", "1-2 AL", "3-4 AL", "5-6 AL"):
        assert gen2627.section_band(code) == "GR1_6"


def test_secondary_and_special_stream_sections_map_to_gr7_12():
    for code in ("9A", "10A", "11A", "11 AS", "12A", "12 A2"):
        assert gen2627.section_band(code) == "GR7_12"


# ---------------------------------------------------------------------------
# (c) section counterpart inheritance
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("code,expected", [
    ("9A", ["Grade 9A"]),
    ("10A", ["Grade 10A"]),
    ("11A", ["Grade 11A-GED"]),
    ("11 AS", ["Grade 11B-AS"]),
    ("12A", ["Grade 12A-GED"]),
    ("12 A2", ["Grade 12C-A2"]),
    ("3B", ["Grade 3B"]),
])
def test_documented_counterpart_pairs(code, expected):
    assert gen2627.section_counterparts(code) == expected


def test_combined_al_sections_inherit_union_of_grade_counterparts():
    # "3-4 AL" -> Grade 3AL + Grade 4AL (both exist in 25-26 data)
    assert gen2627.section_counterparts("3-4 AL") == ["Grade 3AL", "Grade 4AL"]
    # "5-6 AL" -> Grade 5 AL + Grade 6 AL (25-26 source spells these with a
    # space — verbatim from mined_rules.json/canonical_lessons.json)
    assert gen2627.section_counterparts("5-6 AL") == ["Grade 5 AL", "Grade 6 AL"]


def test_1_2_al_only_inherits_the_counterpart_that_actually_exists():
    # 25-26 has no "Grade 1AL" record at all (only Grade 2AL) -- the union
    # degrades gracefully to the existing member, not a KeyError.
    assert gen2627.section_counterparts("1-2 AL") == ["Grade 2AL"]


def test_sections_with_no_counterpart_return_empty_list():
    # 11B/12B exist in sections.json (no 26-27 demand) but there is no
    # documented 25-26 counterpart for them.
    assert gen2627.section_counterparts("11B") == []
    assert gen2627.section_counterparts("12B") == []


def test_every_sections_json_code_is_handled_by_counterparts(sections):
    # must not raise for any real code, even if it resolves to [].
    for s in sections:
        result = gen2627.section_counterparts(s["code"])
        assert isinstance(result, list)


def test_al_union_counterparts_pull_real_mined_rules(mined_rules):
    names_2526 = {r["subject"] for r in mined_rules}
    counterparts = gen2627.section_counterparts("3-4 AL")
    assert counterparts  # non-empty
    for c in counterparts:
        assert any(r["section"] == c for r in mined_rules)


# ---------------------------------------------------------------------------
# (d) over-commit shedding
# ---------------------------------------------------------------------------

def test_synthetic_31_demand_teacher_sheds_exactly_1_from_largest_row():
    rows = [
        {"teacher_id": "TX", "section_code": "9A", "subject_code": "Ma",
         "weekly_periods": 6},
        {"teacher_id": "TX", "section_code": "10A", "subject_code": "Ma",
         "weekly_periods": 25},
    ]
    sheds, gap_notes = gen2627.shed_overcommitted(rows)
    assert sum(s["shed_amount"] for s in sheds if s["teacher_id"] == "TX") == 1
    shed = next(s for s in sheds if s["teacher_id"] == "TX")
    # sheds from the LARGEST row (25, section 10A) not the 6-row.
    assert shed["section_code"] == "10A"
    assert shed["original_weekly_periods"] == 25
    assert shed["new_weekly_periods"] == 24
    assert any("TX" in note for note in gap_notes)


def test_teacher_at_exactly_30_is_not_shed():
    rows = [{"teacher_id": "TY", "section_code": "9A", "subject_code": "Ma",
             "weekly_periods": 30}]
    sheds, gap_notes = gen2627.shed_overcommitted(rows)
    assert sheds == []


def test_shed_ties_broken_deterministically_by_sort_key():
    # two equally-largest rows: must pick the same one every call (sorted by
    # (-weekly_periods, section_code, subject_code) — documented order).
    rows = [
        {"teacher_id": "TZ", "section_code": "9B", "subject_code": "Ma",
         "weekly_periods": 16},
        {"teacher_id": "TZ", "section_code": "9A", "subject_code": "Ma",
         "weekly_periods": 16},
    ]
    sheds1, _ = gen2627.shed_overcommitted(rows)
    sheds2, _ = gen2627.shed_overcommitted(rows)
    assert sheds1 == sheds2
    assert sheds1[0]["section_code"] == "9A"  # alphabetically first tiebreak


def test_real_load_matrix_only_sheds_irina_murariu():
    load_matrix = json.loads((PROCESSED / "load_matrix.json").read_text())
    filtered = [r for r in load_matrix if r["subject_code"] not in (None, "?")]
    sheds, gap_notes = gen2627.shed_overcommitted(filtered)
    teachers_shed = {s["teacher_id"] for s in sheds}
    assert teachers_shed == {"T065"}
    shed = sheds[0]
    assert shed["shed_amount"] == 1


# ---------------------------------------------------------------------------
# (e) demand expansion count
# ---------------------------------------------------------------------------

def test_expand_demand_count_matches_weekly_periods_minus_sheds(load_matrix,
                                                                teachers):
    result = gen2627.build_demand(load_matrix, teachers)
    filtered = [r for r in load_matrix if r["subject_code"] not in (None, "?")]
    total_weekly = sum(r["weekly_periods"] for r in filtered)
    total_shed = sum(s["shed_amount"] for s in result["sheds"])
    assert len(result["lessons"]) == total_weekly - total_shed


def test_expand_demand_excludes_none_and_question_mark_rows(load_matrix,
                                                             teachers):
    result = gen2627.build_demand(load_matrix, teachers)
    assert len(result["dropped_rows"]) == 26
    for row in result["dropped_rows"]:
        assert row["subject_code"] in (None, "?")


def test_expand_demand_lessons_are_single_slot(load_matrix, teachers):
    result = gen2627.build_demand(load_matrix, teachers)
    for lesson in result["lessons"]:
        assert len(lesson["slots"]) == 1


def test_expand_demand_resolves_teacher_names(load_matrix, teachers):
    result = gen2627.build_demand(load_matrix, teachers)
    names = {t["id"]: t["name"] for t in teachers}
    for lesson in result["lessons"][:20]:
        assert lesson["teacher"] in names.values()


# ---------------------------------------------------------------------------
# (f) per-day cap fallback formula
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("weekly,expected", [
    (1, 2), (2, 2), (5, 2), (6, 2), (10, 2), (11, 3), (15, 3), (16, 4),
])
def test_cap_fallback_formula(weekly, expected):
    assert gen2627.fallback_cap(weekly) == max(2, math.ceil(weekly / 5))
    assert gen2627.fallback_cap(weekly) == expected


def test_caps_override_when_inherited_cap_too_tight_for_weekly_demand():
    # Grade 4B/English's real 25-26 rule is max_per_day=1 (per mined_rules);
    # 26-27 demand for 4B/English is 16 (two teachers both assigned) which
    # cannot fit in any cap*5 <= 15 -- must override to the fallback.
    mined_by_key = {("Grade 4B", "English"): 1}
    cap, overridden = gen2627.caps_for_section_subject(
        "4B", "English", 16, mined_by_key, days=5)
    assert overridden is True
    assert cap == gen2627.fallback_cap(16)


def test_caps_do_not_override_when_inherited_cap_fits():
    mined_by_key = {("Grade 9A", "Math"): 2}
    cap, overridden = gen2627.caps_for_section_subject(
        "9A", "Math", 5, mined_by_key, days=5)
    assert overridden is False
    assert cap == 2



# ---------------------------------------------------------------------------
# Constraint assembly smoke tests (parallel legality + caps per section)
# ---------------------------------------------------------------------------

def test_kg_sections_get_no_parallel_legality():
    legal = gen2627.legal_pairs_for_section("K1A", parallel_groups={},
                                            course_offerings={})
    assert legal == set()


def test_grade_3a_gets_the_documented_arabic_french_exception():
    legal = gen2627.legal_pairs_for_section("3A", parallel_groups={},
                                            course_offerings={})
    assert frozenset({"Arabic", "French"}) in legal


def test_grade9_legal_pairs_include_course_offering_bundle_pairs():
    course_offerings = json.loads(
        (PROCESSED / "course_offerings.json").read_text())
    parallel_groups = json.loads(
        (DERIVED_2526 / "parallel_groups.json").read_text())
    legal = gen2627.legal_pairs_for_section(
        "9A", parallel_groups=parallel_groups,
        course_offerings=course_offerings)
    # Science 1 bundle: Ph/BS -> canonical Physics/Business Studies must be
    # a legal pair (subject-set from the bundle).
    assert frozenset({"Physics", "Business Studies"}) in legal


# ---------------------------------------------------------------------------
# Integration: the REAL pipeline run's output (data/processed/tt_2627/)
# passes hard-validity 0/0/0 against the ASSEMBLED 26-27 constraint model.
# Skipped gracefully if the CLI has not been run yet in this environment
# (these artifacts are generated, not committed source).
# ---------------------------------------------------------------------------

OUT_2627 = PROCESSED / "tt_2627"


@pytest.mark.skipif(not (OUT_2627 / "schedule_v1.json").exists(),
                    reason="run `python solver/timetable/gen2627.py` first")
def test_real_run_schedule_v1_passes_hard_validity():
    request = json.loads((OUT_2627 / "request.json").read_text())
    schedule_v1 = json.loads((OUT_2627 / "schedule_v1.json").read_text())
    with gen2627._patched_band_of():
        clashes, overlaps, cap_viol = gen2627.check_hard_validity(
            schedule_v1["lessons"], request["bells"],
            request["parallel_groups"], request["mined_rules"],
            request["days"])
    assert (clashes, overlaps, cap_viol) == (0, 0, 0)


@pytest.mark.skipif(not (OUT_2627 / "schedule_final.json").exists(),
                    reason="run `python solver/timetable/gen2627.py` first")
def test_real_run_schedule_final_passes_hard_validity():
    request = json.loads((OUT_2627 / "request.json").read_text())
    schedule_final = json.loads((OUT_2627 / "schedule_final.json").read_text())
    with gen2627._patched_band_of():
        clashes, overlaps, cap_viol = gen2627.check_hard_validity(
            schedule_final["lessons"], request["bells"],
            request["parallel_groups"], request["mined_rules"],
            request["days"])
    assert (clashes, overlaps, cap_viol) == (0, 0, 0)


@pytest.mark.skipif(not (OUT_2627 / "schedule_v1.json").exists(),
                    reason="run `python solver/timetable/gen2627.py` first")
def test_real_run_solve_status_is_usable():
    schedule_v1 = json.loads((OUT_2627 / "schedule_v1.json").read_text())
    assert schedule_v1["status"] in ("solved", "feasible_timeout")


@pytest.mark.skipif(not (OUT_2627 / "metrics.json").exists(),
                    reason="run `python solver/timetable/gen2627.py` first")
def test_real_run_metrics_shape():
    metrics = json.loads((OUT_2627 / "metrics.json").read_text())
    assert metrics["v1"]["hard_triple"] == {
        "teacher_clashes": 0, "illegal_overlaps": 0,
        "per_day_cap_violations": 0}
    assert metrics["final"]["hard_triple"] == {
        "teacher_clashes": 0, "illegal_overlaps": 0,
        "per_day_cap_violations": 0}
    # coverage-tuning should never make hard rules worse, and should not
    # regress substitution cover below the pre-tuning baseline.
    assert (metrics["final"]["substitution_cover_pct_same_subject"]
            >= metrics["v1"]["substitution_cover_pct_same_subject"])
