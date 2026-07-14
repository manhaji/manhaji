"""Unit tests for the pure helpers behind the 2025-26 timetable import
(etl/tt2526_helpers.py). No live DB — everything here runs on fixture dicts.
"""
import pytest

from etl.tt2526_helpers import (
    VACANCY_TEACHER_NAME,
    band_for_section,
    collect_section_names,
    collect_subject_names,
    collect_teacher_keys,
    expand_all_lessons,
    expand_lesson_to_slots,
    is_composite_teacher,
    is_teaching_slot,
    map_subject,
    match_teacher,
    normalize_person_name,
    normalize_subject_name,
    period_number_for_slot,
    slugify_subject_code,
    teacher_key_for_lesson,
)


# ---------------------------------------------------------------------------
# band_for_section
# ---------------------------------------------------------------------------

class TestBandForSection:
    @pytest.mark.parametrize("name,expected", [
        ("KG1 A", "KG"),
        ("KG2 B", "KG"),
        ("Grade 1A", "GR1_6"),
        ("Grade 6C", "GR1_6"),
        ("Grade 2AL", "GR1_6"),
        ("Grade 5 AL", "GR1_6"),
        ("Grade 7A", "GR7_12"),
        ("Grade 9B", "GR7_12"),
        ("Grade 10A", "GR7_12"),
        ("Grade 11A-GED", "GR7_12"),
        ("Grade 11B-AS", "GR7_12"),
        ("Grade 12C-A2", "GR7_12"),
    ])
    def test_classifies_all_41_section_name_shapes(self, name, expected):
        assert band_for_section(name) == expected

    def test_unrecognised_name_raises(self):
        with pytest.raises(ValueError):
            band_for_section("Nursery A")


# ---------------------------------------------------------------------------
# period_number_for_slot / is_teaching_slot
# ---------------------------------------------------------------------------

class TestPeriodNumberForSlot:
    @pytest.mark.parametrize("slot,expected", [
        ("P1", 1), ("P2", 2), ("P8", 8),
        ("B1", 91), ("B2", 92),
    ])
    def test_maps_slots(self, slot, expected):
        assert period_number_for_slot(slot) == expected

    def test_break_numbers_never_collide_with_teaching(self):
        teaching = {period_number_for_slot(f"P{n}") for n in range(1, 9)}
        breaks = {period_number_for_slot("B1"), period_number_for_slot("B2")}
        assert not (teaching & breaks)

    def test_unrecognised_slot_raises(self):
        with pytest.raises(ValueError):
            period_number_for_slot("X9")

    def test_is_teaching_slot(self):
        assert is_teaching_slot("P1") is True
        assert is_teaching_slot("P8") is True
        assert is_teaching_slot("B1") is False
        assert is_teaching_slot("B2") is False


# ---------------------------------------------------------------------------
# Subject mapping
# ---------------------------------------------------------------------------

class TestSubjectMapping:
    EXISTING = [
        {"code": "Ma", "name_en": "Mathematics"},
        {"code": "En", "name_en": "English"},
        {"code": "MS", "name_en": "Math Support"},
        {"code": "Bi", "name_en": "Biology"},
    ]

    def test_case_insensitive_match_on_name_en(self):
        result = map_subject("mathematics", self.EXISTING)
        assert result == {"action": "match", "code": "Ma", "matched_on": "name_en"}

    def test_exact_name_match_different_case(self):
        result = map_subject("MATHEMATICS", self.EXISTING)
        assert result["action"] == "match"
        assert result["code"] == "Ma"

    def test_match_on_code_case_insensitive(self):
        result = map_subject("ma", self.EXISTING)
        assert result == {"action": "match", "code": "Ma", "matched_on": "code"}

    def test_similar_but_not_equal_name_does_not_match(self):
        # "Biol" is not equal to "Biology" and has no alias -- no fuzzy matching per spec
        result = map_subject("Biol", self.EXISTING)
        assert result["action"] == "create"

    def test_documented_alias_math_matches_mathematics(self):
        # "Math" is a documented alias (SUBJECT_NAME_ALIASES), not fuzzy inference
        result = map_subject("Math", self.EXISTING)
        assert result == {"action": "match", "code": "Ma", "matched_on": "name_en"}

    def test_documented_alias_eng_matches_english(self):
        result = map_subject("Eng", self.EXISTING)
        assert result == {"action": "match", "code": "En", "matched_on": "name_en"}

    def test_eng_supp_variants_all_match_english_support(self):
        existing = self.EXISTING + [{"code": "ES", "name_en": "English Support"}]
        for variant in ("Eng - Supp", "Eng-Supp", "E-S", "English-Support", "English - Support"):
            result = map_subject(variant, existing)
            assert result == {"action": "match", "code": "ES", "matched_on": "name_en"}, variant

    def test_hyphen_vs_space_normalises(self):
        # "Math - Support" should match "Math Support" once hyphens collapse
        result = map_subject("Math - Support", self.EXISTING)
        assert result == {"action": "match", "code": "MS", "matched_on": "name_en"}

    def test_no_match_creates_new_code(self):
        result = map_subject("Wellbeing", self.EXISTING)
        assert result["action"] == "create"
        assert result["name_en"] == "Wellbeing"
        assert result["code"]  # non-empty

    def test_new_subject_multiword_slug(self):
        result = map_subject("Identity & Citizenship", [])
        assert result["action"] == "create"
        assert result["code"] == "ic"

    def test_new_subject_single_word_slug(self):
        result = map_subject("Computing", [])
        assert result["action"] == "create"
        assert result["code"] == "computin"  # first 8 chars, lowercase

    def test_normalize_subject_name_collapses_whitespace_and_hyphens(self):
        assert normalize_subject_name("Eng-Supp") == normalize_subject_name("Eng - Supp")
        assert normalize_subject_name("  Math   Support ") == "math support"


# ---------------------------------------------------------------------------
# Teacher matching
# ---------------------------------------------------------------------------

class TestTeacherMatching:
    EXISTING = [
        {"id": "t1", "full_name": "NATALIE STEVENS", "display_name": None},
        {"id": "t2", "full_name": "ZEINAB MURTADA", "display_name": None},
        {"id": "t3", "full_name": "Hilda Mucharafieh", "display_name": None},
        {"id": "t4", "full_name": "Sandra Swart", "display_name": "Ms. Swart"},
        {"id": "t5", "full_name": "JO AN", "display_name": None},
    ]

    def test_direct_case_insensitive_match(self):
        result = match_teacher("hilda mucharafieh", self.EXISTING)
        assert result["id"] == "t3"

    def test_display_name_match(self):
        result = match_teacher("ms. swart", self.EXISTING)
        assert result["id"] == "t4"

    @pytest.mark.parametrize("canonical,expected_id", [
        ("Natalia Stevens", "t1"),
        ("Zainab Murtada", "t2"),
        ("Jo-Anne Venketas", "t5"),
    ])
    def test_verified_variants_list(self, canonical, expected_id):
        result = match_teacher(canonical, self.EXISTING)
        assert result is not None
        assert result["id"] == expected_id

    def test_unmatched_returns_none(self):
        result = match_teacher("Mohammed Saab", self.EXISTING)
        assert result is None

    def test_mohd_wassim_variant_requires_exact_live_row(self):
        existing = self.EXISTING + [{"id": "t6", "full_name": "MOHD WASEEM", "display_name": None}]
        result = match_teacher("Mohd Wassim", existing)
        assert result is not None
        assert result["id"] == "t6"

    def test_normalize_person_name(self):
        assert normalize_person_name("Jo-Anne Venketas") == normalize_person_name("jo anne venketas")


class TestCompositeTeacher:
    @pytest.mark.parametrize("name,expected", [
        ("IBZ / H", True),
        ("H / DV", True),
        ("Sandra Swart", False),
        ("Jo-Anne Venketas", False),
    ])
    def test_is_composite_teacher(self, name, expected):
        assert is_composite_teacher(name) == expected


# ---------------------------------------------------------------------------
# Canonical lesson -> slot row expansion
# ---------------------------------------------------------------------------

class TestTeacherKeyForLesson:
    def test_staffed_lesson(self):
        lesson = {"section": "KG1 A", "day": "Sun", "slots": ["P1"],
                   "subject": "English", "teacher": "Jo-Anne Venketas"}
        assert teacher_key_for_lesson(lesson) == "Jo-Anne Venketas"

    def test_composite_co_teacher_lesson(self):
        lesson = {"section": "KG2 A", "day": "Mon", "slots": ["P1"], "subject": "PE",
                  "teacher": "IBZ / H", "co_teachers": ["IBZ", "H"]}
        assert teacher_key_for_lesson(lesson) == "IBZ / H"

    def test_non_teaching_lesson_gets_vacancy(self):
        lesson = {"section": "Grade 1A", "day": "Thu", "slots": ["P4"],
                   "subject": "Library", "teacher": None, "non_teaching": True}
        assert teacher_key_for_lesson(lesson) == VACANCY_TEACHER_NAME

    def test_unstaffed_lesson_gets_vacancy(self):
        lesson = {"section": "Grade 10A", "day": "Sun", "slots": ["P4"],
                   "subject": "Eng", "teacher": None, "unstaffed": True}
        assert teacher_key_for_lesson(lesson) == VACANCY_TEACHER_NAME


class TestExpandLessonToSlots:
    def test_single_slot_lesson_expands_to_one_row(self):
        lesson = {"section": "KG1 A", "day": "Sun", "slots": ["P1"],
                   "subject": "English", "teacher": "Jo-Anne Venketas"}
        rows = expand_lesson_to_slots(lesson)
        assert len(rows) == 1
        r = rows[0]
        assert r["band"] == "KG"
        assert r["period_number"] == 1
        assert r["teacher_key"] == "Jo-Anne Venketas"
        assert r["non_teaching"] is False
        assert r["unstaffed"] is False
        assert r["is_composite"] is False

    def test_double_period_lesson_expands_to_two_rows(self):
        # Grade 12C-A2 Physics spans P7-P8 (the "over-span" test-plan case)
        lesson = {"section": "Grade 12C-A2", "day": "Sun", "slots": ["P7", "P8"],
                   "subject": "Physics", "teacher": "Hussein Kameh"}
        rows = expand_lesson_to_slots(lesson)
        assert len(rows) == 2
        assert [r["period_number"] for r in rows] == [7, 8]
        assert all(r["band"] == "GR7_12" for r in rows)

    def test_b2_lesson_gets_break_period_number(self):
        lesson = {"section": "Grade 4C", "day": "Wed", "slots": ["B2"],
                   "subject": "Math - Support", "teacher": "Ghada Albhaisi"}
        rows = expand_lesson_to_slots(lesson)
        assert len(rows) == 1
        assert rows[0]["period_number"] == 92

    def test_co_teacher_lesson_marks_composite(self):
        lesson = {"section": "KG2 A", "day": "Mon", "slots": ["P1"], "subject": "PE",
                  "teacher": "IBZ / H", "co_teachers": ["IBZ", "H"]}
        rows = expand_lesson_to_slots(lesson)
        assert rows[0]["is_composite"] is True
        assert rows[0]["teacher_key"] == "IBZ / H"


class TestExpandAllLessons:
    def test_total_row_count_sums_spans(self):
        lessons = [
            {"section": "KG1 A", "day": "Sun", "slots": ["P1"],
             "subject": "English", "teacher": "Jo-Anne Venketas"},
            {"section": "Grade 12C-A2", "day": "Sun", "slots": ["P7", "P8"],
             "subject": "Physics", "teacher": "Hussein Kameh"},
        ]
        rows = expand_all_lessons(lessons)
        assert len(rows) == 3  # 1 + 2

    def test_non_teaching_lessons_are_not_skipped(self):
        lessons = [
            {"section": "Grade 1A", "day": "Thu", "slots": ["P4"],
             "subject": "Library", "teacher": None, "non_teaching": True},
        ]
        rows = expand_all_lessons(lessons)
        assert len(rows) == 1
        assert rows[0]["teacher_key"] == VACANCY_TEACHER_NAME


class TestCollectHelpers:
    LESSONS = [
        {"section": "KG1 A", "day": "Sun", "slots": ["P1"],
         "subject": "English", "teacher": "Jo-Anne Venketas"},
        {"section": "KG1 A", "day": "Sun", "slots": ["P2"],
         "subject": "PE", "teacher": "Fateme Ghajarian"},
        {"section": "Grade 1A", "day": "Thu", "slots": ["P4"],
         "subject": "Library", "teacher": None, "non_teaching": True},
    ]

    def test_collect_teacher_keys_sorted_and_deduped(self):
        keys = collect_teacher_keys(self.LESSONS)
        assert keys == sorted(set(keys))
        assert VACANCY_TEACHER_NAME in keys
        assert "Jo-Anne Venketas" in keys

    def test_collect_subject_names(self):
        names = collect_subject_names(self.LESSONS)
        assert names == ["English", "Library", "PE"]

    def test_collect_section_names(self):
        names = collect_section_names(self.LESSONS)
        assert names == ["Grade 1A", "KG1 A"]
