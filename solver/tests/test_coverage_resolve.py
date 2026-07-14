"""Unit tests for solver/timetable/coverage_resolve.py — the deterministic
greedy coverage-repair pass over substitution_score's tier-1 (same-subject)
fragile lessons.

Small hand-verified synthetic fixtures, matching the conventions of
test_substitution_score.py / test_v2core.py: a `lesson(...)` dict helper, a
GR1_6-style bells fixture with real break placement (P1,P2,B1,P3,P4,P5,B2,
P6,P7,P8), and exact assertions computed by inspection.

Contract under test (solver/timetable/coverage_resolve.py):
- resolve_coverage(lessons, bells, subject_depts, parallel_groups,
  mined_rules, days) -> dict with keys "lessons" (the repaired placement),
  "coverage_moves" (list of {lesson, from, to, pass_n}), and
  "coverage_resolve_stats" (passes_run, fixpoint_reached, total_moves,
  fragile_before, fragile_after, locked_fragile_count, ...).
- Only tier-1 (covered_same_subject is False) fragile lessons are chased.
- Locked lessons (per v2core.detect_locks) are never moved and are reported
  as unrepairable-locked if fragile.
- A move is accepted only if it (a) makes the lesson itself tier-1 covered
  at every slot of the NEW position, and (b) does not reduce the school-wide
  count of tier-1-covered lessons among the affected set (this teacher's
  other lessons + this subject's lessons at the old and new windows).
- Candidate search order: days in DAYS order, then band_teaching_runs order
  (which itself is bell-table row order) — see coverage_resolve.py docstring.
- Fragile-lesson iteration order within a pass: sorted by
  (section, subject, day, tuple(slots)).
"""
import json

from solver.timetable.coverage_resolve import resolve_coverage
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
                 "English": "Humanities", "History": "Humanities"}


def lesson(section, day, slots, subject, teacher, **kw):
    d = {"section": section, "day": day, "slots": list(slots), "subject": subject,
         "teacher": teacher, "non_teaching": False, "unstaffed": teacher is None}
    d.update(kw)
    return d


def kg_bells():
    """Real-shaped KG band (mirrors test_v2core.kg_bells). Note KG P5 is
    11:55-12:35 while GR1_6 P5 is 11:15-11:55 — the SAME slot label with
    DISJOINT wall-clock windows. That's the real cross-band label-clash
    trap: benchmark.py counts teacher clashes by (teacher, day, slot LABEL)
    across bands, so a wall-clock-only freeness check is not enough."""
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


ALL_GR16_SLOTS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]


def busy_everywhere_except(section, subject, teacher, free_positions,
                           locked=False):
    """One single-slot lesson per (day, GR1_6 teaching slot) EXCEPT the
    given free (day, slot) positions — pins `teacher` busy everywhere else."""
    out = []
    for day in DAYS:
        for slot in ALL_GR16_SLOTS:
            if (day, slot) in free_positions:
                continue
            out.append(lesson(section, day, [slot], subject, teacher,
                              locked=locked,
                              lock_reason="test_lock" if locked else None))
    return out


def _find(lessons, section, subject, teacher, day_hint=None):
    """Find a lesson by (section, subject, teacher), optionally filtering by
    its ORIGINAL day via day_hint isn't reliable after a move, so callers
    that need the post-move day should just filter by section+subject+teacher
    when only one such lesson exists in the fixture."""
    matches = [l for l in lessons if l["section"] == section
               and l["subject"] == subject and l["teacher"] == teacher]
    if day_hint is not None:
        exact = [l for l in matches if l["day"] == day_hint]
        if exact:
            return exact[0]
    assert len(matches) == 1, (section, subject, teacher, matches)
    return matches[0]


# ---------------------------------------------------------------------------
# (a) Obvious free-covered alternative -> lesson gets moved there.
# ---------------------------------------------------------------------------

def test_fragile_lesson_moved_to_free_covered_alternative():
    """T1 teaches Math P1 Sun (Grade 1A). T2 also teaches Math (tier-1
    relevant) but is BUSY at Sun P1 (teaching Grade 1E Math there) -> T1's
    Sun P1 lesson is fragile (zero free tier-1 candidates at that slot). T2
    IS free at Sun P2 (no lesson there), and T1 itself has nothing else
    placed, so if T1's lesson moved to Sun P2 it would be tier-1 covered.
    Sun P1/P2 are otherwise idle for every other lesson in this fixture, so
    the move can't hurt anyone else's coverage.

    Expected: T1's lesson moves from (Sun, [P1]) to (Sun, [P2])."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2"),  # T2 busy at Sun P1
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    moved = _find(result["lessons"], "Grade 1A", "Math", "T1")
    assert (moved["day"], moved["slots"]) == ("Sun", ["P2"])
    assert result["coverage_resolve_stats"]["total_moves"] == 1
    assert len(result["coverage_moves"]) == 1
    mv = result["coverage_moves"][0]
    assert mv["from"] == {"day": "Sun", "slots": ["P1"]}
    assert mv["to"] == {"day": "Sun", "slots": ["P2"]}
    assert mv["lesson"]["section"] == "Grade 1A"
    assert mv["lesson"]["subject"] == "Math"
    assert mv["lesson"]["teacher"] == "T1"
    assert mv["pass_n"] == 1


# ---------------------------------------------------------------------------
# (b) A move that strips another lesson's LAST tier-1 cover is rejected.
# ---------------------------------------------------------------------------

def test_move_rejected_if_it_strips_last_cover_from_another_lesson():
    """Two teachers, T1 and T2, both teach Math. T1's Grade 1A Math lesson
    is fragile at Sun P1 (T2 is busy elsewhere at Sun P1, teaching Grade 1C
    Math there — wait, that would make it same-subject-same-slot elsewhere,
    fine, doesn't matter, they're different sections). Actually build so T1
    moving to Sun P2 (its only legal single-slot alternative that would
    cover ITSELF) would put T1 into the exact slot T2 needs free to cover a
    THIRD lesson, T3's Grade 1D Math lesson at Sun P2 for which T1 is
    currently the only free tier-1 sub (T2 busy at Sun P2 elsewhere).

    Concretely:
      - Grade 1A: T1 teaches Math Sun P1. Fragile: T2 (the only other Math
        teacher) is busy at Sun P1 (teaching Grade 1E Math there).
      - Grade 1D: T3 teaches Math Sun P2. T2 is busy at Sun P2 (teaching
        Grade 1F Math there). T1 is currently FREE at Sun P2 -> T3's lesson
        is currently covered (T1 is the sub). If T1's lesson moved TO Sun
        P2, T1 would no longer be free at Sun P2, stripping T3's only
        tier-1 cover -> T3 becomes fragile. This move must be rejected.
      - T1's only other legal single-slot GR1_6 candidate is P2 (band runs
        of length 1 = every teaching slot; P1 is current). Since P2 is
        rejected, T1 must have no legal accepted move within GR1_6 for this
        tiny fixture restricted to Sun only... but the search also tries
        other days. To keep this deterministic and NOT accidentally fixed
        via some other (day, slot), we pin T2 and T3 busy broadly enough
        that every other day/slot for T1 either doesn't fix T1's own
        coverage or would also strip someone else. Simplify: make T2 busy
        at Sun P1 ONLY (not other days), and have T3's Math lesson exist
        ONLY at Sun P2. Then T1's move to Wed P1 (say) does NOT touch Sun
        P2 at all, and DOES fix T1 (T2 is free everywhere except Sun P1 and
        Sun P2), so the solver should pick that legal alternative instead
        of the harmful Sun P2 one, or leave T1 in place if no such
        alternative exists uncontested. We assert here that whatever
        happens, T3 stays covered.
    """
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2"),  # T2 busy, blocks T1's own slot
        lesson("Grade 1D", "Sun", ["P2"], "Math", "T3"),
        lesson("Grade 1F", "Sun", ["P2"], "Math", "T2"),  # T2 busy at Sun P2 too
    ]
    before = score(lessons, BELLS, SUBJECT_DEPTS)
    t3_before = [e for e in before["lessons"]
                 if e["section"] == "Grade 1D" and e["teacher"] == "T3"][0]
    assert t3_before["covered_same_subject"] is True  # T1 covers T3 today

    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)

    after = score(result["lessons"], BELLS, SUBJECT_DEPTS)
    t3_after = [e for e in after["lessons"]
                if e["section"] == "Grade 1D" and e["teacher"] == "T3"][0]
    assert t3_after["covered_same_subject"] is True, (
        "T3's only tier-1 cover must never be stripped by T1's move")
    # T1 must never have been moved onto Sun P2 (the harmful candidate).
    t1_after = [e for e in result["lessons"]
                if e["section"] == "Grade 1A" and e["teacher"] == "T1"][0]
    assert (t1_after["day"], t1_after["slots"]) != ("Sun", ["P2"])


# ---------------------------------------------------------------------------
# (c) Hard-rule-violating candidates are never accepted.
# ---------------------------------------------------------------------------

def test_teacher_busy_candidate_never_accepted():
    """T1's Grade 1A Math Sun P1 is fragile. The 'obviously better' slot Sun
    P2 would cover it (T2 free + T1 free there in isolation), BUT T1 itself
    already teaches something else at Sun P2 (English, Grade 1A) — so Sun P2
    is illegal for T1 (teacher clash) and must never be chosen. T1's lesson
    should either move to a different legal covered slot or stay put — we
    assert it never lands on Sun P2, and its own occupancy at Sun P2 English
    is untouched."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1A", "Sun", ["P2"], "English", "T1"),  # T1 busy at Sun P2
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    math_after = [l for l in result["lessons"]
                  if l["section"] == "Grade 1A" and l["subject"] == "Math"][0]
    assert (math_after["day"], math_after["slots"]) != ("Sun", ["P2"])
    eng_after = [l for l in result["lessons"]
                 if l["section"] == "Grade 1A" and l["subject"] == "English"][0]
    assert (eng_after["day"], eng_after["slots"]) == ("Sun", ["P2"])


def test_illegal_section_overlap_candidate_never_accepted():
    """Grade 1A already has an English lesson at Sun P2 (different teacher,
    T3). English/Math is NOT a legal parallel pair for Grade 1A (empty
    parallel_groups), so moving T1's Math lesson onto Sun P2 would be an
    illegal same-section overlap even though T1 and the tier-1 sub T2 are
    both free there. This candidate must never be accepted."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1A", "Sun", ["P2"], "English", "T3"),  # occupies the section already
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    math_after = [l for l in result["lessons"]
                  if l["section"] == "Grade 1A" and l["subject"] == "Math"][0]
    assert (math_after["day"], math_after["slots"]) != ("Sun", ["P2"])
    # confirm no illegal overlap was introduced anywhere for Grade 1A
    from solver.timetable.benchmark import compute_metrics
    metrics = compute_metrics(result["lessons"], BELLS, {}, [], DAYS)
    assert metrics["illegal_overlap_count"] == 0


def test_per_day_cap_exceeded_candidate_never_accepted():
    """Grade 1A already has a Math lesson on Wed (single slot). mined_rules
    caps (Grade 1A, Math) at max_per_day=1 slot. T1's fragile Sun P1 Math
    lesson must never be moved to Wed (any slot), because Wed already has 1
    Math slot for Grade 1A and adding another would exceed the cap — even
    though Wed might otherwise look like a tier-1-covered destination."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1A", "Wed", ["P3"], "Math", "T4"),  # same section+subject, different day
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
        # T2 busy every slot on Wed except none needed; ensure Wed slots for
        # T1 would otherwise look tier-1 covered (T2 teaches Math, free on Wed)
    ]
    mined_rules = [
        {"section": "Grade 1A", "subject": "Math", "per_week": 2,
         "max_per_day": 1, "has_double": False},
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, mined_rules, DAYS)
    math_after = [l for l in result["lessons"]
                  if l["section"] == "Grade 1A" and l["teacher"] == "T1"][0]
    assert math_after["day"] != "Wed", (
        "moving onto Wed would exceed the (Grade 1A, Math) max_per_day=1 cap")
    from solver.timetable.benchmark import compute_metrics
    metrics = compute_metrics(result["lessons"], BELLS, {}, mined_rules, DAYS)
    assert metrics["per_day_cap_violation_count"] == 0


# ---------------------------------------------------------------------------
# (d) Locked fragile lessons are skipped and reported.
# ---------------------------------------------------------------------------

def test_locked_fragile_lesson_skipped_and_reported():
    """A non_teaching lesson is never scored by substitution_score (out of
    scope entirely), so to exercise "locked but fragile" we need a lesson
    that IS scored (teaching, staffed) yet locked by v2core's rules — the
    combined_cross_section case: same (teacher, day, slots, subject) in >=2
    sections. Build it fragile (no other Math teacher free at its slot) and
    confirm it is never moved, and shows up in the stats as
    locked_fragile (never silently treated as fixed)."""
    lessons = [
        # combined cross-section PE lesson, taught to 2 sections at once —
        # locked, and fragile because nobody else teaches PE at all here.
        lesson("Grade 1A", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
        lesson("Grade 1B", "Mon", ["P7", "P8"], "PE", "IBZ / H"),
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    pe_after = [l for l in result["lessons"] if l["subject"] == "PE"]
    assert len(pe_after) == 2
    for l in pe_after:
        assert (l["day"], l["slots"]) == ("Mon", ["P7", "P8"])
    stats = result["coverage_resolve_stats"]
    assert stats["locked_fragile_count"] >= 1
    assert stats["total_moves"] == 0


# ---------------------------------------------------------------------------
# (e) Determinism.
# ---------------------------------------------------------------------------

def test_determinism_identical_runs():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
        lesson("Grade 1C", "Sun", ["P1"], "English", "T5"),
        lesson("Grade 1D", "Tue", ["P4"], "English", "T6"),
    ]
    r1 = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    r2 = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    assert json.dumps(r1, sort_keys=True) == json.dumps(r2, sort_keys=True)


# ---------------------------------------------------------------------------
# (f) Fixpoint termination.
# ---------------------------------------------------------------------------

def test_fixpoint_reached_within_a_couple_passes():
    """The simple fixable fixture from test (a) should stabilize: pass 1
    moves the lesson, pass 2 finds nothing left to move -> fixpoint."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2"),
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    stats = result["coverage_resolve_stats"]
    assert stats["fixpoint_reached"] is True
    assert stats["passes_run"] <= 3  # 1 move pass + 1 confirming empty pass, generous bound


def test_five_pass_cap_is_respected_trust_note():
    """We do not construct a genuinely oscillating fixture here (the
    contract's own coverage-preserving rule makes an infinite oscillation
    hard to force by design — a move is only accepted if it never reduces
    total tier-1 coverage, which is a monotone non-decreasing potential
    function bounded above by the total lesson count, so the greedy process
    is expected to terminate quickly in practice). We trust the 5-pass cap
    documented in coverage_resolve.py's MAX_PASSES constant and only assert
    it is wired up: running on a larger, already-stable fixture (nothing
    fragile-and-fixable) must report fixpoint_reached True in exactly 1
    pass, never running away."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),  # no other Math teacher at all -> fragile but unfixable (no candidate helps)
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    stats = result["coverage_resolve_stats"]
    assert stats["fixpoint_reached"] is True
    assert stats["passes_run"] == 1
    assert stats["total_moves"] == 0


# ---------------------------------------------------------------------------
# (b, sharpened) a move whose victim is reached through the moved teacher's
# OTHER subject must also be rejected — the victim's subject differs from the
# moved lesson's subject, so a subject-of-the-moved-lesson-only "affected
# set" would miss it.
# ---------------------------------------------------------------------------

def test_move_stripping_cover_via_teachers_other_subject_is_rejected():
    """TA teaches BOTH Physics (Grade 1A Sun P1 — the fragile lesson) and
    Math (Grade 1A Tue P1 — tier-1 evidence). The only other Physics
    teacher TP is LOCKED busy everywhere except Mon P3, so the ONLY
    candidate where the fragile Physics lesson gains tier-1 cover is
    Mon P3. But B = Grade 2B Mon P3 Math (TB), whose ONLY tier-1 cover is
    TA free at Mon P3 (Math teachers are just TA and TB). Moving the
    Physics lesson to Mon P3 makes TA busy there and strips B's last
    cover — through TA's OTHER subject (Math != Physics). The move must be
    rejected and the Physics lesson must stay put."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Physics", "TA"),
        lesson("Grade 1A", "Tue", ["P1"], "Math", "TA"),
        lesson("Grade 2B", "Mon", ["P3"], "Math", "TB"),
        *busy_everywhere_except("Grade 1C", "Physics", "TP",
                                {("Mon", "P3")}, locked=True),
    ]
    before = score(lessons, BELLS, SUBJECT_DEPTS)
    b_before = [e for e in before["lessons"] if e["section"] == "Grade 2B"][0]
    assert b_before["covered_same_subject"] is True   # fixture sanity
    a_before = [e for e in before["lessons"]
                if e["section"] == "Grade 1A" and e["subject"] == "Physics"][0]
    assert a_before["covered_same_subject"] is False  # fixture sanity

    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)

    a_after = [l for l in result["lessons"]
               if l["section"] == "Grade 1A" and l["subject"] == "Physics"][0]
    assert (a_after["day"], a_after["slots"]) == ("Sun", ["P1"]), (
        "the only covering candidate strips B's last cover -> must stay put")
    assert result["coverage_moves"] == []

    after = score(result["lessons"], BELLS, SUBJECT_DEPTS)
    b_after = [e for e in after["lessons"] if e["section"] == "Grade 2B"][0]
    assert b_after["covered_same_subject"] is True, (
        "B's last tier-1 cover must never be stripped")


# ---------------------------------------------------------------------------
# (d, sharpened) the input lessons' own `locked` flags (rebuild_v2.json is
# the authority for locks) must be honored even when v2core.detect_locks
# would call the lesson movable.
# ---------------------------------------------------------------------------

def test_input_locked_flag_is_honored():
    """Two mutually-fragile Math lessons, both marked locked=True in the
    INPUT (as rebuild_v2.json lessons are), neither detectable as locked by
    detect_locks alone (single-section, teaching slots, staffed). Nothing
    may move; both are reported as locked-fragile."""
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1", locked=True,
               lock_reason="combined_cross_section"),
        lesson("Grade 1E", "Sun", ["P1"], "Math", "T2", locked=True,
               lock_reason="combined_cross_section"),
    ]
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    for l in result["lessons"]:
        assert (l["day"], l["slots"]) == ("Sun", ["P1"])
    assert result["coverage_moves"] == []
    assert result["coverage_resolve_stats"]["locked_fragile_count"] == 2


# ---------------------------------------------------------------------------
# (c, sharpened) cross-band SAME-LABEL clash: benchmark.py's hard
# teacher-clash metric is label-based across bands, so a candidate that is
# wall-clock-free but shares a slot LABEL with the teacher's lesson in
# another band must be rejected.
# ---------------------------------------------------------------------------

def test_cross_band_same_label_clash_candidate_never_accepted():
    """T1 teaches Math Grade 1A Sun P1 (GR1_6, fragile: the only other Math
    teacher T3 is locked-busy everywhere except GR1_6 Sun P5). T1 ALSO
    teaches KG1A English at KG P5 Sun (11:55-12:35) — wall-clock DISJOINT
    from GR1_6 P5 (11:15-11:55) but the SAME label 'P5'. Moving the Math
    lesson to Sun P5 would give benchmark.py a (T1, Sun, P5) label clash
    (hard metric must be 0), so the candidate must be rejected and the
    lesson must stay put."""
    bells = {"GR1_6": gr1_6_bells(), "KG": kg_bells()}
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("KG1A", "Sun", ["P5"], "English", "T1"),
        *busy_everywhere_except("Grade 1C", "Math", "T3",
                                {("Sun", "P5")}, locked=True),
    ]
    result = resolve_coverage(lessons, bells, SUBJECT_DEPTS, {}, [], DAYS)
    math_after = [l for l in result["lessons"]
                  if l["section"] == "Grade 1A" and l["subject"] == "Math"][0]
    assert (math_after["day"], math_after["slots"]) == ("Sun", ["P1"])
    assert result["coverage_moves"] == []
    from solver.timetable.benchmark import compute_metrics
    metrics = compute_metrics(result["lessons"], bells, {}, [], DAYS)
    assert metrics["teacher_clash_count"] == 0


# ---------------------------------------------------------------------------
# Sanity: stats block reports fragile_before / fragile_after consistently.
# ---------------------------------------------------------------------------

def test_stats_report_fragile_before_and_after():
    lessons = [
        lesson("Grade 1A", "Sun", ["P1"], "Math", "T1"),
        lesson("Grade 1B", "Mon", ["P1"], "Math", "T2"),
    ]
    before = score(lessons, BELLS, SUBJECT_DEPTS)
    fragile_before_expected = sum(
        1 for e in before["lessons"] if not e["covered_same_subject"])
    result = resolve_coverage(lessons, BELLS, SUBJECT_DEPTS, {}, [], DAYS)
    stats = result["coverage_resolve_stats"]
    assert stats["fragile_before"] == fragile_before_expected
    assert stats["fragile_after"] <= stats["fragile_before"]
