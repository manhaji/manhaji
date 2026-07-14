"""Unit tests for solver/timetable/coverage_resolve_v4.py — the two sanctioned
escalations on top of coverage_resolve.py's single-lesson greedy repair:

Escalation 1 (pairwise swaps): for each fragile lesson F (unlocked), consider
swapping positions with a partner lesson P (unlocked, SAME band, SAME
slot-length): F takes P's (day, slots), P takes F's. Accepted only if BOTH
land hard-legal at their NEW positions evaluated in the POST-SWAP state (not
as two independent moves), and the global no-victim rule holds with the net
tier-1 covered-count strictly increasing.

Escalation 2 (combined units become movable atomic units): a combined
cross-section lesson (same teacher+day+slots+subject recorded once per
section, in >= 2 sections) may now move or swap as ONE atomic unit — every
member section-record relocates together. Exam/Library (non_teaching) and
break-slot-source-data (B-slot) lessons remain locked/school-fixed
regardless. Hard legality must hold for EVERY member section.

Conventions mirror test_coverage_resolve.py: a `lesson(...)` dict helper, a
GR1_6-style bells fixture with real break placement, exact hand-verified
assertions.
"""
import json

from solver.timetable.coverage_resolve import _legal_pairs_for, _mined_caps
from solver.timetable.coverage_resolve_v4 import (
    build_units,
    resolve_coverage_v4,
)
from solver.timetable.substitution_score import score
from solver.timetable.v2core import detect_locks

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


BELLS = {"GR1_6": gr1_6_bells()}

SUBJECT_DEPTS = {"Math": "STEM", "Physics": "STEM", "Biology": "STEM",
                 "English": "Humanities", "History": "Humanities",
                 "PE": "PE_DEPT"}


def lesson(section, day, slots, subject, teacher, **kw):
    d = {"section": section, "day": day, "slots": list(slots), "subject": subject,
         "teacher": teacher, "non_teaching": False, "unstaffed": teacher is None}
    d.update(kw)
    return d


ALL_GR16_SLOTS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]


def busy_everywhere_except(section, subject, teacher, free_positions,
                           locked=False):
    out = []
    for day in DAYS:
        for slot in ALL_GR16_SLOTS:
            if (day, slot) in free_positions:
                continue
            out.append(lesson(section, day, [slot], subject, teacher,
                              locked=locked,
                              lock_reason="test_lock" if locked else None))
    return out


def _find_all(lessons, section, subject, teacher):
    return [l for l in lessons if l["section"] == section
            and l["subject"] == subject and l["teacher"] == teacher]


def _find_one(lessons, section, subject, teacher):
    matches = _find_all(lessons, section, subject, teacher)
    assert len(matches) == 1, (section, subject, teacher, matches)
    return matches[0]


# ---------------------------------------------------------------------------
# (a) A swap that fixes a fragile lesson while both partners stay hard-legal
#     is accepted.
# ---------------------------------------------------------------------------

def test_swap_fixes_fragile_lesson_both_stay_legal():
    """F = Grade 1A Math Sun P1 (T1). Fragile: T2 (the only other Math
    teacher, locked busy everywhere except Mon P1) is the ONLY slot that
    would give F tier-1 cover. But Mon P1 is already occupied by P = Grade
    1A Science Mon P1 (T4) — SAME SECTION as F, so a single move of F alone
    onto Mon P1 is hard-illegal (Science/Math is not a legal parallel pair,
    empty parallel_groups): a single move can never fix F. Swapping F and P
    (F -> Mon P1, P -> Sun P1) leaves Grade 1A with Math at Mon P1 and
    Science at Sun P1 -- no overlap either way, T1/T4 have nothing else
    placed, and F gains tier-1 cover (T2 free at Mon P1). The swap must be
    accepted."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        *busy_everywhere_except("Grade 1E", "Math", "T2", {("Mon", "P1")},
                                locked=True),
        lesson("Grade 1A", "Mon", ["P1"], "Science", "T4"),
    ]
    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    f_after = _find_one(result["lessons"], "Grade 1A", "Math", "T1")
    p_after = _find_one(result["lessons"], "Grade 1A", "Science", "T4")
    assert (f_after["day"], f_after["slots"]) == ("Mon", ["P1"])
    assert (p_after["day"], p_after["slots"]) == ("Sun", ["P1"])

    swaps = [m for m in result["coverage_moves"] if m["type"] == "swap"]
    assert len(swaps) == 1

    after = score(result["lessons"], BELLS, SUBJECT_DEPTS)
    f_score = [e for e in after["lessons"]
               if e["section"] == "Grade 1A" and e["teacher"] == "T1"][0]
    assert f_score["covered_same_subject"] is True


# ---------------------------------------------------------------------------
# (b) A swap that would make the PARTNER's teacher clash (post-swap state)
#     is rejected.
# ---------------------------------------------------------------------------

def test_swap_rejected_when_partner_teacher_clashes_post_swap():
    """F = Grade 1A Math Sun P1 (T1), fragile (T2 busy at Sun P1). P = Grade
    1B Science Mon P1 (T4). BUT T4 ALSO teaches Grade 1C History at Sun P1
    (so if P moved to Sun P1, T4 would clash with itself). The swap must be
    rejected -- neither lesson may end up at the illegal position, and if no
    other legal partner/candidate exists, F stays exactly where it started."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2"),
        lesson("Grade 1E", "Mon", ["P4"], "Math", "T2"),
        lesson("Grade 1B", "Mon", ["P1"], "Science", "T4"),
        lesson("Grade 1C", "Sun", ["P1"], "History", "T4"),  # T4 busy at Sun P1 already
    ]
    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    # the illegal swap must never have been taken: T4's two lessons never
    # clash (each remains a distinct occupied slot for T4).
    t4_lessons = _find_all(result["lessons"], "Grade 1B", "Science", "T4") + \
                 _find_all(result["lessons"], "Grade 1C", "History", "T4")
    occ = [(l["day"], tuple(l["slots"])) for l in t4_lessons]
    assert len(occ) == len(set(occ)), "T4 must never be double-booked"
    swaps_involving_p = [
        m for m in result["coverage_moves"]
        if m["type"] == "swap" and
        (m["a"]["section"] == "Grade 1B" or m["b"]["section"] == "Grade 1B")]
    assert swaps_involving_p == []


# ---------------------------------------------------------------------------
# (c) A swap creating a victim elsewhere is rejected.
# ---------------------------------------------------------------------------

def test_swap_rejected_if_it_creates_a_victim():
    """F = Grade 1A Physics Sun P1 (TA), fragile (the only other Physics
    teacher TP is locked-busy everywhere except Mon P1 -- Mon P1 is F's ONLY
    possible tier-1-covered destination). P = Grade 1A Science Mon P1 (TB)
    -- SAME SECTION as F, so a single move of F alone onto Mon P1 is
    hard-illegal (Science/Physics is not a legal parallel pair, empty
    parallel_groups): only a SWAP with P can even be attempted. But TA ALSO
    teaches Math (Grade 1A Tue P1, tier-1 evidence) and is Grade 2C's Math
    lesson's ONLY tier-1 cover today (TC is Grade 2C's own teacher, not a
    candidate for itself). If F swapped into Mon P1, TA would become busy
    there, stripping Grade 2C's only cover through TA's OTHER subject (Math
    != Physics) -- the swap must be rejected and F must stay put."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Physics", "TA"),
        lesson("Grade 1A", "Tue", ["P1"], "Math", "TA"),
        lesson("Grade 1A", "Mon", ["P1"], "Science", "TB"),
        lesson("Grade 2C", "Mon", ["P1"], "Math", "TC"),
        *busy_everywhere_except("Grade 1C", "Physics", "TP",
                                {("Mon", "P1")}, locked=True),
    ]
    before = score(lessons, BELLS, SUBJECT_DEPTS)
    c_before = [e for e in before["lessons"] if e["section"] == "Grade 2C"][0]
    assert c_before["covered_same_subject"] is True  # TA covers C today

    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)

    a_after = _find_one(result["lessons"], "Grade 1A", "Physics", "TA")
    assert (a_after["day"], a_after["slots"]) == ("Sun", ["P1"]), (
        "swapping onto Mon P1 strips Grade 2C's only Math cover -> rejected, "
        "and a single move alone is hard-illegal (same-section overlap)")

    after = score(result["lessons"], BELLS, SUBJECT_DEPTS)
    c_after = [e for e in after["lessons"] if e["section"] == "Grade 2C"][0]
    assert c_after["covered_same_subject"] is True, (
        "C's only tier-1 cover must never be stripped by a swap")


# ---------------------------------------------------------------------------
# (d) Combined unit moves atomically -- all member sections relocate, none
#     left behind.
# ---------------------------------------------------------------------------

def test_combined_unit_moves_atomically():
    """A PE lesson taught to Grade 3A + Grade 3B simultaneously by "IBZ / H"
    (combined_cross_section) at Mon P7-P8, fragile (nobody else teaches PE).
    Another PE teacher TP2 is free at Wed P7-P8 (locked-busy elsewhere), so
    moving the WHOLE combined unit to Wed P7-P8 would cover it. Both member
    records (Grade 3A and Grade 3B) must move together to the SAME new
    (day, slots) -- none left behind at Mon."""
    lessons = [
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        *busy_everywhere_except("Grade 3C", "PE", "TP2",
                                {("Wed", "P7"), ("Wed", "P8")}, locked=True),
    ]
    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    pe_after = [l for l in result["lessons"] if l["subject"] == "PE"
                and l["teacher"] == "IBZ / H"]
    assert len(pe_after) == 2
    positions = {(l["day"], tuple(l["slots"])) for l in pe_after}
    assert positions == {("Wed", ("P7", "P8"))}, (
        "both member sections of the combined unit must move TOGETHER")

    moves = [m for m in result["coverage_moves"] if m["type"] == "move"]
    combined_moves = [m for m in moves if len(m.get("sections", [])) >= 2]
    assert len(combined_moves) == 1


# ---------------------------------------------------------------------------
# (e) Combined unit move rejected when ANY member section's overlap
#     legality fails.
# ---------------------------------------------------------------------------

def test_combined_unit_move_rejected_if_any_member_overlap_illegal():
    """Same combined PE unit (Grade 3A + Grade 3B, Mon P7-P8, IBZ / H),
    fragile. TP2 is free at Wed P7-P8 as before, BUT Grade 3B already has an
    unrelated Math lesson at Wed P7 (T9) that is NOT a legal parallel pair
    with PE (empty parallel_groups) -- moving the combined unit to Wed
    P7-P8 would create an illegal same-section overlap for the Grade 3B
    member specifically. The whole unit must stay at its original
    (Mon, P7-P8) placement -- legality is enforced for EVERY member."""
    lessons = [
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Wed", ["P7"], "Math", "T9"),  # blocks the Grade 3B member at Wed P7
        *busy_everywhere_except("Grade 3C", "PE", "TP2",
                                {("Wed", "P7"), ("Wed", "P8")}, locked=True),
    ]
    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    pe_after = [l for l in result["lessons"] if l["subject"] == "PE"
                and l["teacher"] == "IBZ / H"]
    for l in pe_after:
        assert (l["day"], tuple(l["slots"])) == ("Mon", ("P7", "P8")), (
            "illegal overlap for one member must block the WHOLE unit's move")
    math_after = _find_one(result["lessons"], "Grade 3B", "Math", "T9")
    assert (math_after["day"], math_after["slots"]) == ("Wed", ["P7"])


# ---------------------------------------------------------------------------
# (f) Exam/Library (non_teaching) and B-slot lessons stay locked.
# ---------------------------------------------------------------------------

def test_non_teaching_and_bslot_lessons_stay_locked():
    """A non_teaching Exam lesson and a break_slot_source_data lesson (slots
    include a non-teaching B-row) must never move or be treated as
    swappable/atomic-movable units, even though escalation 2 loosens
    combined-cross-section locks."""
    lessons = [
        lesson("Grade 1A", "Mon", ["P3"], "Exam", None, non_teaching=True,
               unstaffed=True),
        lesson("Grade 1A", "Tue", ["B1"], "Math - Support", "T1"),
        lesson("Grade 1B", "Wed", ["P1"], "Math", "T2"),
    ]
    units = build_units(lessons, BELLS)
    locked_units = [u for u in units if u["locked"]]
    reasons = {u["lock_reason"] for u in locked_units}
    assert "non_teaching" in reasons
    assert "break_slot_source_data" in reasons

    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    exam_after = [l for l in result["lessons"] if l["subject"] == "Exam"][0]
    assert (exam_after["day"], exam_after["slots"]) == ("Mon", ["P3"])
    support_after = [l for l in result["lessons"]
                     if l["subject"] == "Math - Support"][0]
    assert (support_after["day"], support_after["slots"]) == ("Tue", ["B1"])


def test_combined_cross_section_no_longer_globally_locked():
    """Sanity on build_units: a combined_cross_section lesson (2 sections,
    same teacher/day/slots/subject, all-teaching slots) must be reported as
    an addressable (movable) unit, unlike v3's global lock."""
    lessons = [
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
    ]
    units = build_units(lessons, BELLS)
    combined_units = [u for u in units if len(u["idxs"]) >= 2]
    assert len(combined_units) == 1
    assert combined_units[0]["locked"] is False


# ---------------------------------------------------------------------------
# (g) Determinism.
# ---------------------------------------------------------------------------

def test_determinism_identical_runs():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2"),
        lesson("Grade 1E", "Mon", ["P4"], "Math", "T2"),
        lesson("Grade 1B", "Mon", ["P1"], "Science", "T4"),
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        *busy_everywhere_except("Grade 3C", "PE", "TP2",
                                {("Wed", "P7"), ("Wed", "P8")}, locked=True),
    ]
    r1 = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    r2 = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    assert json.dumps(r1, sort_keys=True) == json.dumps(r2, sort_keys=True)


# ---------------------------------------------------------------------------
# Sanity: same-band assertion for combined units.
# ---------------------------------------------------------------------------

def test_build_units_asserts_same_band_across_combined_members():
    """Combined-unit members are, by construction, always the same section
    band (same teacher teaching the same subject at the same wall-clock
    slots to >=2 sections implies those sections share a bell grid) -- verify
    this holds on the real derived data's shape by asserting no
    cross-band combined group exists; build_units must not silently allow
    a cross-band group to be treated as one atomic unit."""
    lessons = [
        lesson("Grade 1A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 1B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
    ]
    units = build_units(lessons, BELLS)
    combined = [u for u in units if len(u["idxs"]) >= 2]
    assert len(combined) == 1
    assert combined[0]["band"] == "GR1_6"


# ---------------------------------------------------------------------------
# Stats sanity: locked-fragile-became-addressable reporting.
# ---------------------------------------------------------------------------

def test_stats_report_addressable_combined_units():
    lessons = [
        lesson("Grade 3A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 3B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        *busy_everywhere_except("Grade 3C", "PE", "TP2",
                                {("Wed", "P7"), ("Wed", "P8")}, locked=True),
    ]
    result = resolve_coverage_v4(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    stats = result["coverage_resolve_stats"]
    assert stats["locked_fragile_became_addressable_count"] >= 1
    assert "alternations" in stats
    assert stats["total_moves"] + stats["total_swaps"] >= 1
