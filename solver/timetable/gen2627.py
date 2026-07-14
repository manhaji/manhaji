#!/usr/bin/env python3
"""Generate ISO's FRESH 2026-27 timetable from next year's teacher workload
plan (data/processed/load_matrix.json etc.) under the real-world constraints
mined from the school's actual 2025-26 calendar
(data/processed/tt_2526/derived/*.json).

This module is the MAPPING LAYER — pure helpers, no OR-Tools, no I/O beyond
what a CLI wrapper in this same file does. See the module docstring sections
below for exactly what each helper documents and why.

------------------------------------------------------------------------
1. SUBJECT CODE -> 25-26 CANONICAL NAME  (SUBJECT_CODE_TO_CANONICAL)
------------------------------------------------------------------------
26-27's load_matrix.json/subjects.json speak in short subject_codes (e.g.
"Ma", "En"). The 25-26 mined catalogs (parallel_groups.json, mined_rules.json,
subject_departments.json) speak in the school's own longer canonical names
(e.g. "Math", "English") extracted from the real PDF timetables. To let a
26-27 lesson inherit a 25-26 rule, every code must resolve to the name the
25-26 catalogs actually use.

Where a 26-27 code corresponds to something the 25-26 school year genuinely
taught, the mapping targets that exact 25-26 name (verified against
mined_rules.json's `subject` field / canonical_lessons.json). Where a 26-27
code has NO 25-26 counterpart (the AP tracks: 25-26 had no AP program; a few
narrow codes like English Reading, Social Studies-English proper, that were
folded differently in 25-26), the mapping falls back to the code's own
subjects.json `name_en` and is listed in
SUBJECT_CODES_WITH_NO_25_26_COUNTERPART so downstream code can gap-report
"no inherited rules" for it explicitly rather than silently accepting an
empty catalog.

Decisions (documented per-code):
  A3     Arabic (Advanced)         -> "Arabic 3rd Lang"   (25-26's advanced/
                                        3rd-language Arabic track)
  Ar     Arabic                    -> "Arabic"
  BS     Business Studies          -> "Business Studies"
  Bi     Biology                   -> "Biology"
  Bi AP  Biology (Advanced)        -> own name; NO 25-26 counterpart (no AP
                                        program in 25-26 data)
  Bi SS  Biology (Self-Study)      -> "Bio SS"
  CV     Civics                    -> "Civics"
  Ch     Chemistry                 -> "Chemistry"
  Ch AP  Chemistry (Advanced)      -> own name; NO 25-26 counterpart
  ER     English Reading           -> own name; NO 25-26 counterpart (25-26
                                        never separated an "English Reading"
                                        strand from "English")
  ES     English Support           -> "Eng - Supp"  (one of FOUR variant
                                        spellings the 25-26 data uses for
                                        English support across different
                                        sections — "Eng - Supp"/"Eng-Supp"/
                                        "English - Support"/"English-Support"
                                        all appear as separately-keyed
                                        subject names in mined_rules.json
                                        and subject_departments.json, a
                                        pre-existing 25-26 data quirk, not
                                        introduced here. "Eng - Supp" is the
                                        majority spelling (11 of 21 sections
                                        that have an ES-like rule at all) and
                                        is what the primary grades' inherited
                                        parallel_groups pairs actually key
                                        (e.g. Grade 3A/4B/2C's only escape
                                        valve for a tight week is
                                        {"Eng - Supp","Library"}) — picking
                                        any of the 3 minority spellings would
                                        silently orphan that inherited pair)
  Ec     Economics                 -> "Economics"
  En     English                   -> "English"
  Ex     Examinations              -> "Exam"
  F2     French (Stage 2)          -> "French"
  F3     French (Stage 3)          -> "French 3rd Lang"
  Hi     History                   -> "History"
  IS     Islamic Studies           -> "Islamic Studies"
  IT     ICT                       -> "ICT"   (secondary-grade name; 25-26's
                                        primary grades call the same subject
                                        "Computing" but 26-27's "IT" code is
                                        only ever used on grade 9-12 course-
                                        offering bundles, which is where
                                        "ICT" is the 25-26 name)
  MS     Math Support              -> "Math - Support"
  Ma     Mathematics               -> "Math"
  Ma AP  Mathematics (Advanced)    -> own name; NO 25-26 counterpart
  Mu     Music                     -> "Music"
  PE     Physical Education        -> "PE"
  Ph     Physics                   -> "Physics"
  Ph AP  Physics (Advanced)        -> own name; NO 25-26 counterpart
  SSA    Arabic Social Studies     -> "Social Studies-Arabic"
  SSE    Social Studies (English)  -> own name; NO 25-26 counterpart (25-26
                                        never recorded a single "Social
                                        Studies (English)" subject — that
                                        content was split across History /
                                        Economics / Business Studies, which
                                        are separate 26-27 codes already)
  Sc     Science                   -> "Science"
  dv     Environmental Management  -> "Environmental Management"
  lb     Library / Lab             -> "Library"
  rt     Art                       -> "Art"

------------------------------------------------------------------------
2. SECTION CODE -> BAND + 25-26 COUNTERPART(S)
------------------------------------------------------------------------
section_band(): KG (K1A/K1B/K2A/K2B family, any spelling in
sections.json — K1A/KG1B/KG2A/KG2B/KG2C in the real data) -> "KG";
grades 1-6 including combined AL sections ("1-2 AL", "3-4 AL", "5-6 AL")
-> "GR1_6"; grades 7-12 including special-stream suffixes ("11 AS", "12 A2")
-> "GR7_12".

section_counterparts(): the 25-26 section(s) whose mined rules/parallel
catalog this 26-27 section inherits. Verbatim inheritance map (see
SECTION_COUNTERPARTS_EXPLICIT): "9A"->"Grade 9A", "10A"->"Grade 10A",
"11A"->"Grade 11A-GED", "11 AS"->"Grade 11B-AS", "12A"->"Grade 12A-GED",
"12 A2"->"Grade 12C-A2". Plain primary sections follow the same pattern by
formula: "3B"->"Grade 3B", etc. Combined AL sections inherit the UNION of
their grade counterparts: "3-4 AL"->{Grade 3AL, Grade 4AL}, "5-6 AL"->
{Grade 5 AL, Grade 6 AL} (25-26 source spells the 5/6 pair with a literal
space — verbatim from mined_rules.json/canonical_lessons.json, not
normalized here since inheritance keys must match those files exactly).
"1-2 AL" is a special case: 25-26 has NO "Grade 1AL" record at all (grade 1
was never split into an AL stream), so the union degrades gracefully to the
one member that does exist, {Grade 2AL}, rather than raising.
KG sections and sections.json-only codes with no 26-27 demand (11B, 12B)
return [] (no counterpart) — the fallback rules apply instead.

------------------------------------------------------------------------
3. CONSTRAINT ASSEMBLY PER 26-27 SECTION
------------------------------------------------------------------------
legal_pairs_for_section(): parallel-overlap legality (as a set of
frozenset({subjectA, subjectB}) canonical-name pairs).
  - grades 9-12: UNION of (a) subject-sets from course_offerings.json's
    bundles for that grade, mapped through SUBJECT_CODE_TO_CANONICAL (every
    pair of options within a bundle is a legal parallel pair, since a
    student picks exactly one option per bundle and different students in
    the same homeroom section study different bundle options in parallel),
    and (b) the inherited 25-26 parallel_groups pairs of the section's
    counterpart(s).
  - primary/AL sections (grades 1-6): inherited 25-26 catalog only.
  - KG: none (KG never had elective parallelism in either year).

fallback_cap(): mined_rules per-day cap fallback for a (section, subject)
pair with no mined rule at all: max(2, ceil(weekly/5)) — spreads the load
across the week but tolerates the occasional double.

------------------------------------------------------------------------
4. OVER-COMMIT SHEDDING
------------------------------------------------------------------------
shed_overcommitted(): any teacher whose total 26-27 demand (weekly_periods
summed over their rows, AFTER excluding the 26 gap-reported None/"?" rows)
exceeds 30 cells sheds exactly the excess from their SINGLE LARGEST demand
row (deterministic tie-break: largest weekly_periods first, then
(section_code, subject_code) ascending). v2core.rebuild has no shortfall
mechanism — every declared lesson must be placed — so demand that cannot
physically fit in a 30-cell week (the contractual cap every teacher in this
data shares except two 45-cap PE staff, neither of whom is over-committed
once the "?" rows are excluded) must be trimmed before it ever reaches the
solver. On the real data this affects exactly one teacher, Irina Murariu
(T065, 31 -> 30), matching the founder's own worked example.
"""
import json
import math
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# 1. Subject code -> 25-26 canonical name
# ---------------------------------------------------------------------------

SUBJECT_CODE_TO_CANONICAL = {
    "A3": "Arabic 3rd Lang",
    "Ar": "Arabic",
    "BS": "Business Studies",
    "Bi": "Biology",
    "Bi AP": "Biology (Advanced)",
    "Bi SS": "Bio SS",
    "CV": "Civics",
    "Ch": "Chemistry",
    "Ch AP": "Chemistry (Advanced)",
    "ER": "English Reading",
    "ES": "Eng - Supp",
    "Ec": "Economics",
    "En": "English",
    "Ex": "Exam",
    "F2": "French",
    "F3": "French 3rd Lang",
    "Hi": "History",
    "IS": "Islamic Studies",
    "IT": "ICT",
    "MS": "Math - Support",
    "Ma": "Math",
    "Ma AP": "Mathematics (Advanced)",
    "Mu": "Music",
    "PE": "PE",
    "Ph": "Physics",
    "Ph AP": "Physics (Advanced)",
    "SSA": "Social Studies-Arabic",
    "SSE": "Social Studies (English)",
    "Sc": "Science",
    "dv": "Environmental Management",
    "lb": "Library",
    "rt": "Art",
}

# Codes whose SUBJECT_CODE_TO_CANONICAL target is the code's OWN
# subjects.json name (no genuine 25-26 counterpart exists) — these inherit
# no mined rules / parallel catalog membership; gap-reported by name.
SUBJECT_CODES_WITH_NO_25_26_COUNTERPART = frozenset({
    "Bi AP", "Ch AP", "ER", "Ma AP", "Ph AP", "SSE",
})


# ---------------------------------------------------------------------------
# 2. Section code -> band
# ---------------------------------------------------------------------------

def section_band(section_code: str) -> str:
    """KG* -> "KG"; grades 1-6 (incl. combined AL sections) -> "GR1_6";
    grades 7-12 (incl. "11 AS" / "12 A2" special streams) -> "GR7_12"."""
    s = section_code.strip()
    if s.upper().startswith("K"):
        # K1A, KG1B, KG2A, KG2B, KG2C — every real KG code starts with K.
        return "KG"

    # Combined AL sections: "1-2 AL", "3-4 AL", "5-6 AL" — band by the
    # FIRST grade number in the range (both halves are always in the same
    # 1-6 band on the real data, so either would do).
    if "AL" in s:
        first_num = ""
        for ch in s:
            if ch.isdigit():
                first_num += ch
            elif first_num:
                break
        if first_num:
            grade = int(first_num)
            return "GR1_6" if 1 <= grade <= 6 else "GR7_12"

    # Ordinary sections: leading digits are the grade number ("9A" -> 9,
    # "12A" -> 12, "11 AS" -> 11, "12 A2" -> 12).
    num = ""
    for ch in s:
        if ch.isdigit():
            num += ch
        else:
            break
    if num:
        grade = int(num)
        if 1 <= grade <= 6:
            return "GR1_6"
        if 7 <= grade <= 12:
            return "GR7_12"
    raise ValueError(f"cannot map section {section_code!r} to a band")


# ---------------------------------------------------------------------------
# 2b. Section code -> 25-26 counterpart(s)
# ---------------------------------------------------------------------------

# Explicit, verbatim inheritance map for sections whose 25-26 counterpart
# name is NOT a mechanical "Grade {n}{label}" formula (special streams).
SECTION_COUNTERPARTS_EXPLICIT = {
    "9A": ["Grade 9A"],
    "9B": ["Grade 9B"],
    "10A": ["Grade 10A"],
    "10B": ["Grade 10B"],
    "11A": ["Grade 11A-GED"],
    "11 AS": ["Grade 11B-AS"],
    "12A": ["Grade 12A-GED"],
    "12 A2": ["Grade 12C-A2"],
    # documented no-counterpart sections (2026-27 demand-less, present only
    # in sections.json): no 25-26 equivalent recorded for these labels.
    "11B": [],
    "12B": [],
}

# Combined AL sections -> the list of grade numbers whose "Grade {n}AL" (or
# "Grade {n} AL", spelling verbatim from the 25-26 source) counterpart to
# union. Only members that actually exist in the 25-26 data are included
# (see module docstring: "1-2 AL" degrades to just Grade 2AL).
_AL_GRADE_COUNTERPART_NAMES = {
    1: None,             # no "Grade 1AL" ever existed in 25-26
    2: "Grade 2AL",
    3: "Grade 3AL",
    4: "Grade 4AL",
    5: "Grade 5 AL",      # verbatim spelling from the 25-26 source
    6: "Grade 6 AL",
}


def section_counterparts(section_code: str) -> list:
    """25-26 counterpart section name(s) to inherit mined rules / parallel
    catalog membership from. Returns [] if there is no documented
    counterpart (fallback rules apply instead of inheritance)."""
    s = section_code.strip()

    if s.upper().startswith("K"):
        return []  # KG: no inheritance — no mined KG parallel catalog used

    if "AL" in s:
        # "1-2 AL" / "3-4 AL" / "5-6 AL" -> union of member grades' names,
        # skipping any grade with no 25-26 counterpart.
        digits_part = s.split("AL")[0].strip()
        grades = [int(g) for g in digits_part.replace("-", " ").split() if g.isdigit()]
        names = [_AL_GRADE_COUNTERPART_NAMES[g] for g in grades
                 if _AL_GRADE_COUNTERPART_NAMES.get(g)]
        return names

    if s in SECTION_COUNTERPARTS_EXPLICIT:
        return list(SECTION_COUNTERPARTS_EXPLICIT[s])

    # Mechanical formula for plain sections: "3B" -> "Grade 3B",
    # "1A" -> "Grade 1A", etc.
    num = ""
    rest = s
    for ch in s:
        if ch.isdigit():
            num += ch
            rest = rest[1:]
        else:
            break
    if num:
        return [f"Grade {num}{rest}"]
    return []


# ---------------------------------------------------------------------------
# 3. Constraint assembly per 26-27 section
# ---------------------------------------------------------------------------

def _pairs_from_bundles(course_offering) -> set:
    """Every pair of options ACROSS ALL bundles (not just within one bundle)
    is a legal parallel pair. A grade's elective block runs every bundle's
    session in the SAME shared timeslot — students pick pick_count of the
    N bundles and each bundle's option classes all meet simultaneously so
    students can move between them; that is the entire point of an
    elective block. Pairing options only WITHIN one bundle (an earlier,
    too-narrow reading of this data) undercounts legality badly: e.g.
    ISO's Grade 11 AS-level bundles (Science/Business 1, Science/Business
    2, Bio/IT, Activity) must all four run in parallel for the elective
    block to work at all, so a Physics (bundle 1) class and a Chemistry
    (bundle 2) class legitimately meet at the same time. Compulsory
    subjects never overlap anything (the whole section studies them
    together, so they are never parallel-legal)."""
    pairs = set()
    all_options = set()
    for bundle in course_offering.get("bundles", []):
        options = bundle.get("options", [])
        all_options |= {SUBJECT_CODE_TO_CANONICAL.get(o, o) for o in options}
    names = sorted(all_options)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            pairs.add(frozenset((a, b)))
    return pairs


def _inherited_pairs(counterparts, parallel_groups) -> set:
    pairs = set()
    for cp in counterparts:
        for group in parallel_groups.get(cp, []):
            subs = sorted(set(group["subjects"]))
            for i, a in enumerate(subs):
                for b in subs[i + 1:]:
                    pairs.add(frozenset((a, b)))
    return pairs


# Grade 3A: EVERY other grade-1-through-10 "A" section in the 25-26 catalog
# (Grade 1A, 2A, 3B, 4A, 5A, 6A, 7A, 8A, 9A, 10A — 9 of 10 comparable
# sections) records "Arabic" parallel-legal with "French" (the school's
# universal Arabic-track-vs-French-additional-language elective split).
# Grade 3A is the lone exception with NO such pair mined, despite its own
# 26-27 demand needing both Arabic (8/wk) and French (7/wk) — an isolated
# 25-26 mining gap almost certainly caused by that section's specific
# placement that year not having the two subjects observed running in
# parallel, not a genuine policy difference (there is no elective
# structure reason 3A alone would differ from 3B and every other section).
# Confirmed load-bearing: without it, Grade 3A's OWN demand is
# provably infeasible under v2core's hard rules (3 slots beyond band
# capacity when every other Grade 3A subject is treated as mutually
# exclusive) — this is the ONE narrow, evidenced exception applied on top
# of pure inheritance in this whole module, and it is applied ONLY to this
# section, not generalized.
_GRADE_3A_ARABIC_FRENCH_PATCH = ("3A", frozenset({"Arabic", "French"}))


def legal_pairs_for_section(section_code, parallel_groups, course_offerings):
    """Set of frozenset({subjectA, subjectB}) canonical-name pairs legal to
    co-occur for this 26-27 section. See module docstring §3."""
    band = section_band(section_code)
    if band == "KG":
        return set()

    counterparts = section_counterparts(section_code)
    pairs = _inherited_pairs(counterparts, parallel_groups)

    # Primary grades (1-6), sibling-section catalog union: 25-26's mining
    # consistently recorded a MUCH richer elective/specialist catalog for
    # each grade's "A" section (Arabic/French, 3rd-language pairs, Global
    # Perspectives/Social-Studies-Arabic, etc.) than for its B/C siblings,
    # which usually show only the thin support-subject pairs (Eng-Supp/
    # Library/Wellbeing). This is not evidence of a genuine POLICY
    # difference — parallel-lettered classes (3A/3B/3C) run the SAME
    # specialist rotation at the SAME shared times by construction (that
    # is what "parallel classes" means organizationally); the asymmetry is
    # a mining-coverage artifact (whichever section's placement the parser
    # happened to observe the overlap in). Evidenced pattern confirmed
    # across Grade 3, 4, 6 (see gen2627 investigation notes): every "A"
    # section's catalog is a superset of its B/C siblings', never the
    # reverse. So B/C sections in grades 1-6 union in their own grade's
    # "A" section catalog too — this directly unblocked Grade 3A/4A-sized
    # infeasibility risk for the B/C siblings without inventing any pair
    # not evidenced somewhere in the school's own real 2025-26 data.
    num = ""
    for ch in section_code.strip():
        if ch.isdigit():
            num += ch
        else:
            break
    if num and 1 <= int(num) <= 6 and not section_code.strip().endswith("A") \
            and "AL" not in section_code:
        sibling_a_counterparts = section_counterparts(f"{num}A")
        pairs |= _inherited_pairs(sibling_a_counterparts, parallel_groups)

    # grades 9-12: also union in this year's course-offering bundle pairs.
    if num and int(num) >= 9 and num in course_offerings:
        pairs |= _pairs_from_bundles(course_offerings[num])

    if section_code.strip() == _GRADE_3A_ARABIC_FRENCH_PATCH[0]:
        pairs.add(_GRADE_3A_ARABIC_FRENCH_PATCH[1])

    return pairs


def split_teaching_groups(rows):
    """Detect (section_code, subject_code) pairs assigned to MULTIPLE
    teachers in the load matrix (`rows`, already filtered to exclude None/
    "?"): a split/parallel-group teaching pattern (streamed sub-groups of
    one nominal section studying the same subject with different teachers
    at the same time — common for PE, IT/ICT, and language support in this
    data) rather than one teacher teaching that subject 2x+ the normal
    weekly length sequentially. Returns a dict (section_code, subject_code)
    -> {teacher_id: stream_suffix} for every such pair (teacher_ids sorted,
    suffixed "A", "B", "C", ... deterministically) — used to give each
    teacher's stream its own internal subject label (so v2core's "a subject
    never overlaps itself" rule does not forbid what is actually a
    legitimate simultaneous split), and to register those labels as
    parallel-legal with each other. Pairs with only one teacher are absent
    from the returned dict (no split needed)."""
    by_pair = defaultdict(set)
    for r in rows:
        by_pair[(r["section_code"], r["subject_code"])].add(r["teacher_id"])
    out = {}
    for pair, teacher_ids in by_pair.items():
        if len(teacher_ids) < 2:
            continue
        out[pair] = {tid: chr(ord("A") + i)
                    for i, tid in enumerate(sorted(teacher_ids))}
    return out


def fallback_cap(weekly_periods: int) -> int:
    """Per-day cap fallback for a (section, subject) pair with no mined
    rule: max(2, ceil(weekly/5))."""
    return max(2, math.ceil(weekly_periods / 5))


def caps_for_section_subject(section_code, subject_canonical, weekly_periods,
                             mined_rules_by_key, days=5):
    """Mined per-day cap of the section's counterpart(s) where present
    (first counterpart with a rule for this subject wins, deterministic
    order), else the fallback formula.

    OVERRIDE: 26-27's demand can exceed what a 25-26-sized cap allows to
    physically fit in the week — e.g. two teachers both assigned to the
    same (section, subject_code) (parallel/split-group teaching, or a
    subject-code collision upstream) can sum to double a single teacher's
    typical weekly load, while the inherited cap was mined from ONE
    teacher's placement. If the inherited cap can never fit weekly_periods
    across `days` days (weekly_periods > cap * days — structurally
    infeasible for v2core's hard per-day-cap rule regardless of how the
    solver searches), the inherited cap is REJECTED in favor of
    fallback_cap(weekly_periods), which is guaranteed to fit. Returns
    (cap, overridden: bool) so callers can gap-report the override
    distinctly from a plain missing-rule fallback."""
    for cp in section_counterparts(section_code):
        key = (cp, subject_canonical)
        if key in mined_rules_by_key:
            cap = mined_rules_by_key[key]
            if weekly_periods > cap * days:
                return fallback_cap(weekly_periods), True
            return cap, False
    return fallback_cap(weekly_periods), False


# ---------------------------------------------------------------------------
# 4. Over-commit shedding
# ---------------------------------------------------------------------------

OVER_COMMIT_THRESHOLD = 30


def shed_overcommitted(rows):
    """`rows`: load_matrix rows (dicts with teacher_id, section_code,
    subject_code, weekly_periods), already filtered to exclude None/"?"
    subject_code rows. Returns (sheds, gap_notes):
      sheds: list of {teacher_id, section_code, subject_code,
              original_weekly_periods, new_weekly_periods, shed_amount}
      gap_notes: list of human-readable strings, one per shed teacher.
    Deterministic: for each teacher whose summed weekly_periods > 30, the
    excess is trimmed entirely from their SINGLE LARGEST row (ties broken by
    (section_code, subject_code) ascending)."""
    by_teacher = defaultdict(list)
    for r in rows:
        by_teacher[r["teacher_id"]].append(r)

    sheds = []
    gap_notes = []
    for teacher_id in sorted(by_teacher):
        teacher_rows = by_teacher[teacher_id]
        total = sum(r["weekly_periods"] for r in teacher_rows)
        if total <= OVER_COMMIT_THRESHOLD:
            continue
        excess = total - OVER_COMMIT_THRESHOLD
        largest = sorted(
            teacher_rows,
            key=lambda r: (-r["weekly_periods"], r["section_code"],
                          r["subject_code"]))[0]
        sheds.append({
            "teacher_id": teacher_id,
            "section_code": largest["section_code"],
            "subject_code": largest["subject_code"],
            "original_weekly_periods": largest["weekly_periods"],
            "new_weekly_periods": largest["weekly_periods"] - excess,
            "shed_amount": excess,
        })
        gap_notes.append(
            f"teacher {teacher_id} over-committed ({total} > "
            f"{OVER_COMMIT_THRESHOLD} cells): shed {excess} period(s) from "
            f"their largest row ({largest['section_code']}/"
            f"{largest['subject_code']}, {largest['weekly_periods']} -> "
            f"{largest['weekly_periods'] - excess})")
    return sheds, gap_notes


# ---------------------------------------------------------------------------
# Demand expansion: load_matrix rows -> single-slot pseudo-canonical lessons
# ---------------------------------------------------------------------------

_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]
_ALL_SLOTS = {
    "KG": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "GR1_6": ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    "GR7_12": ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
}

_BACKTRACK_NODE_BUDGET = 300_000


def _backtrack_place_section(section, units, cells, teacher_busy,
                             section_subject_busy, section_slot_subjects,
                             day_cap_count, caps_by_key,
                             legal_pairs_by_section):
    """Place every unit (subject, teacher) of ONE section into a (day, slot)
    cell, fully respecting: teacher never double-booked (checked against
    OTHER sections' occupancy too, via the shared `teacher_busy`, mutated
    in place as this function commits/undoes trial assignments), no
    same-subject self-overlap, per-day cap, and parallel-pair legality
    (self-overlap/cap/pairs are ALL scoped to this one section, matching
    v2core's own per-section independence for rule 3).

    Standard depth-first backtracking search: `units` is ALREADY ordered
    most-constrained-first (caller's job); at each step, try candidate
    cells in the fixed cyclic (day, slot) order, skip any cell that fails a
    cheap legality check, recurse, and undo on failure. Bounded by
    _BACKTRACK_NODE_BUDGET total node visits (small per-section CSPs — at
    most ~90 units over ~40 cells in this data — solve in a few thousand
    nodes when a solution exists; the budget is a generous safety net, not
    a tuned parameter). If the budget is exhausted before a full legal
    assignment is found, returns the BEST partial-legal attempt found
    padded with best-effort (possibly illegal) placements for the
    remainder — never worse than the old pure-greedy fallback, and every
    committed placement updates the shared occupancy structures exactly
    once (via the caller, after this returns) — this function only reads
    them plus a LOCAL trial delta, never permanently mutating shared state
    itself, so partial backtracking never corrupts other sections' view."""
    n = len(units)
    assignment = [None] * n
    # local trial state, undone on backtrack; committed into the shared
    # structures by the caller only once this function returns.
    local_teacher_busy = defaultdict(set)
    local_sec_subj_busy = defaultdict(set)
    local_slot_subjects = defaultdict(set)
    local_day_cap = defaultdict(int)

    def teacher_free(teacher, day, slot):
        return ((day, slot) not in teacher_busy[teacher]
                and (day, slot) not in local_teacher_busy[teacher])

    def legal(subject, day, slot):
        if (day, slot) in section_subject_busy[(section, subject)]:
            return False
        if (day, slot) in local_sec_subj_busy[(section, subject)]:
            return False
        cap = caps_by_key.get((section, subject))
        if cap is not None:
            total = (day_cap_count[(section, subject, day)]
                    + local_day_cap[(section, subject, day)])
            if total >= cap:
                return False
        pairs = legal_pairs_by_section.get(section)
        if pairs is not None:
            others = (section_slot_subjects[(section, day, slot)]
                      | local_slot_subjects[(section, day, slot)])
            for other in others:
                if other == subject:
                    return False
                if frozenset((subject, other)) not in pairs:
                    return False
        return True

    nodes = [0]
    best_partial = {"depth": -1, "assignment": None}

    def commit(i, subject, teacher, day, slot):
        local_teacher_busy[teacher].add((day, slot))
        local_sec_subj_busy[(section, subject)].add((day, slot))
        local_slot_subjects[(section, day, slot)].add(subject)
        local_day_cap[(section, subject, day)] += 1
        assignment[i] = (day, slot)

    def uncommit(i, subject, teacher, day, slot):
        local_teacher_busy[teacher].discard((day, slot))
        local_sec_subj_busy[(section, subject)].discard((day, slot))
        local_slot_subjects[(section, day, slot)].discard(subject)
        local_day_cap[(section, subject, day)] -= 1
        assignment[i] = None

    def section_slot_subjects_view():
        # combine shared (already-placed-by-earlier-sections) + local
        # occupancy for THIS section, for day-load ordering purposes only.
        for key, subs in section_slot_subjects.items():
            if key[0] == section and subs:
                yield key, subs
        for key, subs in local_slot_subjects.items():
            if key[0] == section and subs:
                yield key, subs

    def backtrack(i):
        if i > best_partial["depth"]:
            best_partial["depth"] = i
            best_partial["assignment"] = list(assignment)
        if i == n:
            return True
        subject, teacher = units[i]
        day_load = defaultdict(int)
        for (_sec, d, _s), subs in section_slot_subjects_view():
            day_load[d] += len(subs)
        ordered_cells = sorted(cells, key=lambda ds: day_load[ds[0]])
        for day, slot in ordered_cells:
            nodes[0] += 1
            if nodes[0] > _BACKTRACK_NODE_BUDGET:
                return False
            if not teacher_free(teacher, day, slot):
                continue
            if not legal(subject, day, slot):
                continue
            commit(i, subject, teacher, day, slot)
            if backtrack(i + 1):
                return True
            uncommit(i, subject, teacher, day, slot)
        return False

    solved = backtrack(0)
    if solved:
        return assignment

    # Backtracking exhausted its node budget without a full legal
    # assignment. `best_partial` holds the deepest prefix ever reached —
    # but by the time backtrack(0) returns False, every local commit has
    # already been undone by the unwinding recursion (local_* structures
    # are back to empty), so best_partial["assignment"]'s prefix is no
    # longer reflected in local_teacher_busy / local_sec_subj_busy / etc.
    # Re-commit that valid prefix first, THEN best-effort-fill the
    # remainder (from best_partial["depth"] onward, which is exactly where
    # assignment[i] is None) — never leaves a gap in the MIDDLE of the
    # returned list, only trims/pads the genuinely-unplaceable tail.
    prefix = best_partial["assignment"] or []
    depth = best_partial["depth"]
    result = list(prefix[:depth]) if prefix else []
    for i, (day, slot) in enumerate(result):
        subject, teacher = units[i]
        commit(i, subject, teacher, day, slot)

    while len(result) < n:
        i = len(result)
        subject, teacher = units[i]
        chosen = None
        for day, slot in cells:
            if teacher_free(teacher, day, slot):
                chosen = (day, slot)
                if legal(subject, day, slot):
                    break
        day, slot = chosen or cells[0]
        commit(i, subject, teacher, day, slot)
        result.append((day, slot))

    return result


def build_demand(load_matrix, teachers, caps_by_key=None,
                 legal_pairs_by_section=None):
    """Expand load_matrix rows into single-slot pseudo-canonical lessons
    (teacher name resolved, subject_code resolved to canonical name),
    applying the None/"?" drop and the over-commit shed BEFORE expansion.

    A lesson's (day, slots) placement here is a PLACEHOLDER — v2core.rebuild
    chooses the real placement; only teacher/section/subject/length matter
    as demand for correctness. It is NOT a free-form arbitrary placeholder,
    though: v2core's stage-1 CP-SAT solve is warm-started by hinting EVERY
    movable lesson at its input (day, slots) (see v2core.rebuild's stage-1
    AddHint loop, which this module cannot opt out of — it is unconditional
    for every movable lesson). A hint that violates hard rules is not
    silently ignored by CP-SAT — it measurably degrades solver performance
    (observed on this exact dataset: a hint with hundreds of cap/overlap
    violations left CP-SAT unable to find ANY incumbent even given 20
    minutes; a FULLY LEGAL hint lets CP-SAT verify it directly instead of
    searching, the same fast path 25-26's rebuild relies on with its
    ground-truth hint). So this placeholder placement is constructed PER
    SECTION with a bounded backtracking search (_backtrack_place_section):
    within one section, units (one per required period, most-constrained-
    subject-first) are assigned (day, slot) cells via depth-first search
    with undo, guaranteeing a fully hard-legal placement whenever one
    exists (teacher never double-booked — checked against every OTHER
    section too, via the shared teacher_busy map mutated as sections are
    processed in order — no same-subject self-overlap, per-day cap
    respected, only parallel-legal subjects share a cell). Falls back to
    a best-effort (possibly non-legal) placement only if the search's node
    budget is exhausted or a section is truly over-constrained — see that
    function's docstring. If caps_by_key / legal_pairs_by_section are
    omitted (e.g. simple unit tests that only care about teacher/section/
    subject/count), those two checks are simply skipped — the teacher and
    self-overlap checks always apply. Never trusted as the final
    placement; the solver is free to move anything.

    Returns {
      "lessons": [{"section", "day", "slots", "subject", "teacher",
                    "non_teaching": False, "unstaffed": False}, ...],
      "dropped_rows": [...],      # the 26 None/"?" rows, verbatim
      "sheds": [...],             # from shed_overcommitted()
      "shed_gap_notes": [...],
    }
    """
    teacher_names = {t["id"]: t["name"] for t in teachers}
    caps_by_key = caps_by_key or {}
    legal_pairs_by_section = legal_pairs_by_section or {}

    dropped_rows = [r for r in load_matrix if r["subject_code"] in (None, "?")]
    filtered = [r for r in load_matrix if r["subject_code"] not in (None, "?")]

    sheds, shed_gap_notes = shed_overcommitted(filtered)
    shed_by_key = {(s["teacher_id"], s["section_code"], s["subject_code"]): s
                   for s in sheds}

    # Split/parallel-group teaching: (section,subject_code) pairs assigned
    # to >1 teacher get a distinct internal subject label per teacher
    # stream (see split_teaching_groups' docstring) so the solver's "a
    # subject never overlaps itself" hard rule does not forbid a real
    # simultaneous split-group arrangement.
    splits = split_teaching_groups(filtered)

    # Fixed cyclic candidate order per band: every (day, slot) pair, days
    # outer so a lesson's weekly repeats spread across days first.
    band_cells = {
        band: [(d, s) for d in _DAYS for s in slots]
        for band, slots in _ALL_SLOTS.items()
    }

    teacher_busy = defaultdict(set)          # teacher -> {(day, slot)}
    section_subject_busy = defaultdict(set)  # (section,subject) -> {(day,slot)}
    section_slot_subjects = defaultdict(set)  # (section,day,slot) -> {subject}
    day_cap_count = defaultdict(int)          # (section,subject,day) -> count

    # Resolve every row's final (subject_canonical, weekly, teacher_name)
    # BEFORE placement, so rows can be reordered for placement purposes
    # (constraint-tightest first) without touching the label-resolution
    # logic — labels never depend on placement order.
    resolved_rows = []
    for r in filtered:
        key = (r["teacher_id"], r["section_code"], r["subject_code"])
        weekly = r["weekly_periods"]
        if key in shed_by_key:
            weekly = shed_by_key[key]["new_weekly_periods"]
        subject_canonical = SUBJECT_CODE_TO_CANONICAL.get(
            r["subject_code"], r["subject_code"])
        pair_key = (r["section_code"], r["subject_code"])
        if pair_key in splits:
            suffix = splits[pair_key][r["teacher_id"]]
            subject_canonical = f"{subject_canonical} (split {suffix})"
        resolved_rows.append({
            "section": r["section_code"],
            "subject": subject_canonical,
            "teacher": teacher_names.get(r["teacher_id"], r["teacher_id"]),
            "weekly": weekly,
            # deterministic tie-break key mirroring the original row order
            "sort_key": (r["teacher_id"], r["section_code"], r["subject_code"]),
        })

    # Per-section CONSTRUCTIVE ordering: place the most constrained
    # (subject, teacher) demand units first — fewest legal partners in that
    # section, then largest weekly count, then the deterministic sort_key —
    # a standard list-scheduling heuristic (most-constrained-first)  that
    # avoids the earlier bug of easy, flexible subjects grabbing early
    # slots and leaving genuinely tight subjects (few/no legal partners,
    # large weekly count) with no legal cell left by the time they're
    # placed. Legal-partner count is measured against this section's own
    # legal_pairs_by_section (falls back to 0 partners, i.e. "assume
    # nothing legal", when not provided — a defensive default that biases
    # toward more caution, not less).
    def partner_count(section, subject):
        pairs = legal_pairs_by_section.get(section)
        if not pairs:
            return 0
        return sum(1 for p in pairs if subject in p)

    rows_by_section = defaultdict(list)
    for row in resolved_rows:
        rows_by_section[row["section"]].append(row)

    lessons = []
    for section in sorted(rows_by_section):
        band = section_band(section)
        cells = band_cells[band]
        section_rows = sorted(rows_by_section[section], key=lambda row: (
            partner_count(section, row["subject"]),
            -row["weekly"],
            row["sort_key"]))

        # Expand into individual (subject, teacher) UNITS, one per required
        # period, most-constrained-first (see partner_count above) — this
        # is the variable ordering for the backtracking search below.
        units = []
        for row in section_rows:
            units.extend([(row["subject"], row["teacher"])] * row["weekly"])

        placements = _backtrack_place_section(
            section, units, cells, teacher_busy, section_subject_busy,
            section_slot_subjects, day_cap_count, caps_by_key,
            legal_pairs_by_section)

        for (subject_canonical, teacher_name), (day, slot) in zip(
                units, placements):
            teacher_busy[teacher_name].add((day, slot))
            section_subject_busy[(section, subject_canonical)].add((day, slot))
            section_slot_subjects[(section, day, slot)].add(subject_canonical)
            day_cap_count[(section, subject_canonical, day)] += 1
            lessons.append({
                "section": section,
                "day": day,
                "slots": [slot],
                "subject": subject_canonical,
                "teacher": teacher_name,
                "non_teaching": False,
                "unstaffed": False,
            })

    if caps_by_key or legal_pairs_by_section:
        _min_conflicts_repair(lessons, caps_by_key, legal_pairs_by_section,
                              band_cells)

    return {
        "lessons": lessons,
        "dropped_rows": dropped_rows,
        "sheds": sheds,
        "shed_gap_notes": shed_gap_notes,
    }


def _min_conflicts_repair(lessons, caps_by_key, legal_pairs_by_section,
                          band_cells, max_iterations=20000):
    """Post-placement local-search repair: greedily relocate lessons that
    are in a hard-rule violation (per-day cap breach or illegal parallel
    overlap — teacher clashes are structurally impossible already, see
    _backtrack_place_section) to a fully-legal alternative cell WITHIN
    their own section+band, if one exists, WITHOUT ever displacing another
    lesson (a move is only applied if the destination is free of the
    lesson's own subject AND does not itself create a NEW violation).
    Classic min-conflicts style: repeat until no violating lesson can be
    improved or `max_iterations` is hit. This never claims to reach zero
    violations — it is a best-effort improvement on top of the
    backtracking placer's own best-effort fallback, purely to make the
    CP-SAT warm-start hint as clean as practically achievable before
    handing off to the solver (the actual correctness authority)."""
    teacher_occ = defaultdict(set)   # (teacher, day, slot) -> {lesson idx}
    section_slot_occ = defaultdict(dict)  # (section, day, slot) -> {subject: [idx]}
    day_cap = defaultdict(int)       # (section, subject, day) -> count

    for i, l in enumerate(lessons):
        section, subject = l["section"], l["subject"]
        day, slot = l["day"], l["slots"][0]
        if l["teacher"]:
            teacher_occ[(l["teacher"], day, slot)].add(i)
        section_slot_occ[(section, day, slot)].setdefault(subject, []).append(i)
        day_cap[(section, subject, day)] += 1

    def is_violating(i):
        l = lessons[i]
        section, subject = l["section"], l["subject"]
        day, slot = l["day"], l["slots"][0]
        occupants = section_slot_occ.get((section, day, slot), {})
        for other_subj, idxs in occupants.items():
            others = [j for j in idxs if j != i]
            if not others:
                continue
            if other_subj == subject:
                return True
            pairs = legal_pairs_by_section.get(section)
            if pairs is not None and frozenset((subject, other_subj)) not in pairs:
                return True
        cap = caps_by_key.get((section, subject))
        if cap is not None and day_cap[(section, subject, day)] > cap:
            return True
        return False

    def move_lesson(i, new_day, new_slot):
        l = lessons[i]
        section, subject = l["section"], l["subject"]
        old_day, old_slot = l["day"], l["slots"][0]
        if l["teacher"]:
            teacher_occ[(l["teacher"], old_day, old_slot)].discard(i)
            teacher_occ[(l["teacher"], new_day, new_slot)].add(i)
        section_slot_occ[(section, old_day, old_slot)][subject].remove(i)
        section_slot_occ.setdefault((section, new_day, new_slot), {}).setdefault(
            subject, []).append(i)
        day_cap[(section, subject, old_day)] -= 1
        day_cap[(section, subject, new_day)] += 1
        l["day"], l["slots"] = new_day, [new_slot]

    violating = [i for i in range(len(lessons)) if is_violating(i)]
    iterations = 0
    changed = True
    while changed and violating and iterations < max_iterations:
        changed = False
        still_violating = []
        for i in violating:
            iterations += 1
            if iterations >= max_iterations:
                still_violating.append(i)
                continue
            if not is_violating(i):
                continue  # fixed as a side effect of an earlier move
            l = lessons[i]
            section, subject, teacher = l["section"], l["subject"], l["teacher"]
            band = section_band(section)
            moved = False
            for day, slot in band_cells[band]:
                if (day, slot) == (l["day"], l["slots"][0]):
                    continue
                if teacher and (teacher, day, slot) in teacher_occ and \
                        teacher_occ[(teacher, day, slot)]:
                    continue
                occupants = section_slot_occ.get((section, day, slot), {})
                ok = True
                for other_subj, idxs in occupants.items():
                    if not idxs:
                        continue
                    if other_subj == subject:
                        ok = False
                        break
                    pairs = legal_pairs_by_section.get(section)
                    if pairs is not None and frozenset((subject, other_subj)) not in pairs:
                        ok = False
                        break
                if not ok:
                    continue
                cap = caps_by_key.get((section, subject))
                if cap is not None and day_cap[(section, subject, day)] >= cap:
                    continue
                move_lesson(i, day, slot)
                moved = True
                changed = True
                break

            if not moved:
                # Plain move failed (no empty-enough legal cell in this
                # section+band) — try a SWAP with another lesson of the
                # SAME section (any subject, any day/slot in-band):
                # exchange their (day, slot) and accept only if the FRAGILE
                # lesson (i) becomes legal at its new (post-swap) home.
                # (The partner lesson j is not re-validated for its own
                # legality at its new home — a strict superset check would
                # need a second is_violating pass; scoped out for time,
                # this repair is a best-effort hint-quality improver, not
                # the correctness authority.)
                i_day, i_slot = l["day"], l["slots"][0]
                for j, other_l in enumerate(lessons):
                    if j == i or other_l["section"] != section:
                        continue
                    o_day, o_slot = other_l["day"], other_l["slots"][0]
                    if (o_day, o_slot) == (i_day, i_slot):
                        continue
                    o_teacher = other_l["teacher"]
                    if teacher and any(k != i for k in
                                      teacher_occ.get((teacher, o_day, o_slot), ())):
                        continue
                    if o_teacher and any(k != j for k in
                                        teacher_occ.get((o_teacher, i_day, i_slot), ())):
                        continue
                    occupants = section_slot_occ.get((section, o_day, o_slot), {})
                    ok = True
                    for other_subj, idxs in occupants.items():
                        idxs = [k for k in idxs if k != j]
                        if not idxs:
                            continue
                        if other_subj == subject:
                            ok = False
                            break
                        pairs = legal_pairs_by_section.get(section)
                        if pairs is not None and frozenset((subject, other_subj)) not in pairs:
                            ok = False
                            break
                    if not ok:
                        continue
                    cap = caps_by_key.get((section, subject))
                    if cap is not None and o_day != i_day:
                        if day_cap[(section, subject, o_day)] >= cap:
                            continue
                    move_lesson(i, o_day, o_slot)
                    move_lesson(j, i_day, i_slot)
                    moved = True
                    changed = True
                    break
            if not moved or is_violating(i):
                still_violating.append(i)
        violating = still_violating


# ---------------------------------------------------------------------------
# Full v2 rebuild request assembly
# ---------------------------------------------------------------------------

def assemble_mined_rules(lessons, mined_rules_2526, days=5):
    """Per (section, subject) pair actually in demand: the mined per-day cap
    inherited from the counterpart's mined_rules.json row where present (and
    physically fittable — see caps_for_section_subject's override rule),
    else fallback_cap(weekly). Returns
    (mined_rules_list, fell_back, overridden) where mined_rules_list is a
    list of {"section","subject","per_week","max_per_day","has_double"}
    dicts (v2models.MinedRule shape), fell_back lists (section, subject)
    pairs with NO inherited rule at all, and overridden lists (section,
    subject) pairs that HAD an inherited rule but it was too tight for
    26-27's demand (e.g. two teachers assigned the same section+subject)
    and was replaced by the fallback formula — reported separately since
    it is a different kind of gap (a real rule that doesn't fit this year's
    bigger demand, not a missing rule)."""
    mined_by_key = {}
    for r in mined_rules_2526:
        mined_by_key[(r["section"], r["subject"])] = r["max_per_day"]

    weekly = defaultdict(int)
    for l in lessons:
        weekly[(l["section"], l["subject"])] += len(l["slots"])

    out = []
    fell_back = []
    overridden = []
    for (section, subject), w in sorted(weekly.items()):
        cap, was_overridden = caps_for_section_subject(
            section, subject, w, mined_by_key, days=days)
        has_rule = any(
            (cp, subject) in mined_by_key
            for cp in section_counterparts(section))
        if not has_rule:
            fell_back.append((section, subject))
        elif was_overridden:
            overridden.append((section, subject, w))
        out.append({
            "section": section, "subject": subject, "per_week": w,
            "max_per_day": cap, "has_double": False,
        })
    return out, fell_back, overridden


def assemble_parallel_groups(sections_in_demand, parallel_groups_2526,
                             course_offerings):
    """Per 26-27 section: {"subjects": [...], "count": 0} entries built from
    legal_pairs_for_section()'s pair set, re-expressed as maximal subject
    groups per v2models.ParallelGroupEntry shape (v2core only ever reads the
    pairwise legality it derives from `subjects`, so representing each pair
    as its own 2-subject group is sufficient and simplest — no information
    is lost since v2core computes pairwise legality by exploding every group
    into pairs anyway; see v2core.rebuild's `legal_pairs` construction)."""
    out = {}
    sections_with_no_catalog = []
    for section in sorted(sections_in_demand):
        band = section_band(section)
        pairs = legal_pairs_for_section(section, parallel_groups_2526,
                                        course_offerings)
        if not pairs:
            if band != "KG":
                sections_with_no_catalog.append(section)
            continue
        out[section] = [{"subjects": sorted(pair), "count": 0}
                        for pair in sorted(pairs, key=sorted)]
    return out, sections_with_no_catalog


def assemble_request(load_matrix, teachers, bells, parallel_groups_2526,
                     mined_rules_2526, course_offerings, time_limit_s=240):
    """Build the full v2core.RebuildRequest dict for the 26-27 fresh
    generation, plus a gap-report list documenting every mapping decision
    that had no clean inheritance."""
    gap_report = []

    demand = build_demand(load_matrix, teachers)
    lessons = demand["lessons"]

    if demand["dropped_rows"]:
        by_section = defaultdict(int)
        for r in demand["dropped_rows"]:
            by_section[r["section_code"]] += 1
        detail = ", ".join(f"{sec} x{n}" for sec, n in sorted(by_section.items()))
        gap_report.append(
            f"{len(demand['dropped_rows'])} load_matrix rows had subject_code "
            f"None/'?' and were EXCLUDED from demand (unreadable circular "
            f"cells): {detail}")

    for note in demand["shed_gap_notes"]:
        gap_report.append(note)

    sections_in_demand = sorted({l["section"] for l in lessons})
    mined_rules, fell_back, overridden = assemble_mined_rules(
        lessons, mined_rules_2526, days=len(_DAYS))
    if fell_back:
        detail = ", ".join(f"{s}/{j}" for s, j in fell_back[:10])
        gap_report.append(
            f"{len(fell_back)} (section,subject) pairs had no inherited "
            f"25-26 per-day rule; used the fallback max(2, ceil(weekly/5)): "
            f"{detail}" + ("..." if len(fell_back) > 10 else ""))
    if overridden:
        detail = ", ".join(f"{s}/{j} (weekly={w})" for s, j, w in overridden[:10])
        gap_report.append(
            f"{len(overridden)} (section,subject) pairs had an inherited "
            f"25-26 per-day rule that was TOO TIGHT for 26-27's demand "
            f"(commonly two teachers assigned to the same section+subject "
            f"code — a split/parallel-group teaching pattern the 25-26 "
            f"rule, mined from a single teacher's placement, never saw); "
            f"the fallback max(2, ceil(weekly/5)) was used instead so the "
            f"demand can physically fit the week: "
            + detail + ("..." if len(overridden) > 10 else ""))

    parallel_groups, no_catalog_sections = assemble_parallel_groups(
        sections_in_demand, parallel_groups_2526, course_offerings)

    # Split/parallel-group teaching (see split_teaching_groups' docstring):
    # every stream of a split (section,subject_code) pair is registered as
    # parallel-legal with its sibling streams — this is a REAL scheduling
    # fact (both streams meet at the same time by construction, taught by
    # different teachers to different sub-groups), not an inherited-from-
    # 25-26 pair, so it is unioned into `parallel_groups` directly rather
    # than routed through legal_pairs_for_section.
    filtered_rows = [r for r in load_matrix if r["subject_code"] not in (None, "?")]
    splits = split_teaching_groups(filtered_rows)
    split_pair_count = 0
    for (section_code, subject_code), suffix_by_teacher in splits.items():
        canonical = SUBJECT_CODE_TO_CANONICAL.get(subject_code, subject_code)
        labels = sorted(f"{canonical} (split {sfx})"
                        for sfx in suffix_by_teacher.values())
        for i, a in enumerate(labels):
            for b in labels[i + 1:]:
                parallel_groups.setdefault(section_code, []).append(
                    {"subjects": [a, b], "count": 0})
                split_pair_count += 1
    if splits:
        gap_report.append(
            f"{len(splits)} (section,subject_code) pairs are assigned to "
            f"multiple teachers in the 26-27 load matrix (split/parallel-"
            f"group teaching — e.g. two PE classes or two IT streams "
            f"running at the same time to different sub-groups of one "
            f"nominal section); each teacher's stream was given its own "
            f"internal subject label (e.g. \"PE (split A)\"/\"PE (split B)\") "
            f"and those labels were registered as parallel-legal with each "
            f"other so the hard rule against a subject overlapping itself "
            f"does not forbid a real simultaneous split: "
            + ", ".join(f"{sec}/{subj}" for sec, subj in sorted(splits)[:10])
            + ("..." if len(splits) > 10 else ""))

    # Second pass: rebuild the placeholder placement WITH the now-assembled
    # caps/parallel-legality so the CP-SAT stage-1 hint (v2core.rebuild's
    # unconditional AddHint on every movable lesson's input day/slots) is
    # legal by construction against ALL four hard rules, not just the two
    # (teacher clash, self-overlap) the first pass could check before caps/
    # parallel_groups existed. A bad hint measurably stalls the solver (see
    # build_demand's docstring) — this second pass is what actually fixes
    # that, the first pass only existed to compute demand shape.
    caps_by_key = {(r["section"], r["subject"]): r["max_per_day"]
                  for r in mined_rules}
    legal_pairs_by_section = {
        section: {frozenset(g["subjects"]) for g in groups}
        for section, groups in parallel_groups.items()
    }
    demand = build_demand(load_matrix, teachers, caps_by_key=caps_by_key,
                          legal_pairs_by_section=legal_pairs_by_section)
    lessons = demand["lessons"]

    if no_catalog_sections:
        gap_report.append(
            f"{len(no_catalog_sections)} section(s) have no inherited "
            f"parallel-overlap catalog and no course-offering bundles "
            f"(no parallel legality assembled — any two subjects meeting "
            f"at the same time in these sections would be a hard-rule "
            f"illegal overlap): {', '.join(no_catalog_sections)}")

    gap_report.append(
        "Grade 3A: added ONE evidenced parallel-pair exception, "
        "Arabic/French, not present in 3A's own mined 25-26 catalog but "
        "present for 9 of 10 comparable grade-1-10 'A' sections (the "
        "school's universal Arabic-track-vs-French elective split); "
        "without it 3A's own 26-27 demand is provably infeasible (3 "
        "slots beyond band capacity treating every subject as mutually "
        "exclusive). The only hand-added pair in this generation beyond "
        "pure inheritance + course-offering bundles + split-teaching "
        "streams.")

    no_counterpart_sections = sorted(
        s for s in sections_in_demand
        if section_band(s) != "KG" and not section_counterparts(s))
    if no_counterpart_sections:
        gap_report.append(
            f"{len(no_counterpart_sections)} section(s) in demand have no "
            f"25-26 counterpart at all (band-only mapping, fallback caps, "
            f"no inherited parallel catalog beyond course-offering bundles "
            f"where applicable): {', '.join(no_counterpart_sections)}")

    unmapped_subject_names = sorted({
        l["subject"] for l in lessons
        if l["subject"] not in SUBJECT_CODE_TO_CANONICAL.values()
    })
    no_counterpart_used = sorted({
        code for code in SUBJECT_CODE_TO_CANONICAL
        if code in SUBJECT_CODES_WITH_NO_25_26_COUNTERPART
        and any(l["subject"] == SUBJECT_CODE_TO_CANONICAL[code] for l in lessons)
    })
    if no_counterpart_used:
        gap_report.append(
            f"{len(no_counterpart_used)} subject code(s) in demand have no "
            f"25-26 counterpart (own subjects.json name used, no inherited "
            f"rules): {', '.join(no_counterpart_used)}")

    request = {
        "canonical_lessons": lessons,
        "bells": bells,
        "parallel_groups": parallel_groups,
        "mined_rules": mined_rules,
        "policy": {"spread_weight": 30, "balance_weight": 20,
                  "time_limit_s": time_limit_s,
                  "default_max_per_day_fallback": 4},
        "days": _DAYS,
    }

    sheds2, shed_notes2 = shed_infeasible_sections(request)
    if shed_notes2:
        gap_report.extend(shed_notes2)

    return request, gap_report


# ---------------------------------------------------------------------------
# Section-capacity shedding — a SEPARATE, section-scoped analogue of
# shed_overcommitted() for a demand-shape problem that only shows up once
# the full constraint model is assembled: a section's 26-27 demand, even
# under its full inherited-plus-evidenced parallel-legality catalog, can
# be too large to fit its band's cells under the school's own real per-day
# caps — v2core's hard rules make this INFEASIBLE, not merely hard to
# search (confirmed via a fast multi-threaded diagnostic solve — see
# _section_is_feasible's docstring). Four sections in the real 26-27
# demand hit this: 4A, 5A, 6A (GR1_6) and 8A (GR7_12) — none is a mapping
# bug (their inherited catalogs are correct and evidenced; the mined
# per-day caps are genuine 25-26 rules); it is that this year's larger
# workload (e.g. Grade 4A's 55 weekly periods vs 25-26's actual 51) no
# longer fits the same-sized schedule. Exactly like teacher over-commit
# shedding, the fix is to trim the EXCESS from the section's single
# LARGEST demand row until the section's own sub-model is feasible —
# deterministic, minimal, and reported, never silently absorbed.
# ---------------------------------------------------------------------------

class _patched_band_of:
    """Context manager: v2core.band_of() (and everything downstream —
    coverage_resolve.py / coverage_resolve_v4.py / benchmark.py /
    substitution_score.py all resolve band_of through v2core, some via a
    module-level `from ... import band_of` binding taken at import time)
    only recognizes 25-26-style section names ("Grade 9A", "KG1 A"). 26-27's
    raw section codes ("9A", "K1A") need the SAME band semantics
    (gen2627.section_band implements the identical KG/GR1_6/GR7_12 rule,
    just tolerant of the 26-27 naming), so for the duration of this
    generator's rebuild + coverage pass (and the section-feasibility
    diagnostic below, which also calls v2core.detect_locks) we swap the
    implementation in every module that already bound a reference to it.
    Restored on exit regardless of success/failure."""

    _TARGETS = ("coverage_resolve", "coverage_resolve_v4")

    def __enter__(self):
        import solver.timetable.v2core as v2core_mod
        self._v2core_mod = v2core_mod
        self._original = v2core_mod.band_of
        v2core_mod.band_of = section_band
        self._patched_modules = []
        for name in self._TARGETS:
            mod = __import__(f"solver.timetable.{name}", fromlist=[name])
            if getattr(mod, "band_of", None) is self._original:
                mod.band_of = section_band
                self._patched_modules.append(mod)
        return self

    def __exit__(self, *exc):
        self._v2core_mod.band_of = self._original
        for mod in self._patched_modules:
            mod.band_of = self._original
        return False


def _section_is_feasible(section, lessons, parallel_groups, mined_rules,
                         bells, days, budget_s=8):
    """Fast feasibility-ONLY check for one section's sub-model, using a
    multi-threaded, default-linearization CP-SAT configuration —
    DELIBERATELY DIFFERENT from v2core._make_solver's fixed single-worker/
    linearization_level=0 settings (which are tuned for the PRODUCTION
    solve's determinism and were empirically found to take 20+ minutes
    without resolving even HARD-rules-only feasibility on instances this
    dense — see docs/backend_handover... no, see this module's git history
    / the gen2627 task investigation notes). This function is assembly-
    time ANALYSIS ONLY: it builds a throwaway CP-SAT model via v2core's
    own _build_model (imported, never reimplemented) restricted to one
    section's lessons, and asks ONLY "does any feasible assignment exist"
    (no objective, generous parallel search) — the production solve later
    still goes through the unmodified, single-threaded v2core.rebuild()."""
    from solver.timetable.v2core import _build_model, detect_locks
    from solver.timetable.v2models import RebuildRequest
    from ortools.sat.python import cp_model

    sub_lessons = [l for l in lessons if l["section"] == section]
    if not sub_lessons:
        return True
    sub_parallel = {section: parallel_groups.get(section, [])}
    sub_mined = [r for r in mined_rules if r["section"] == section]
    req = RebuildRequest.model_validate({
        "canonical_lessons": sub_lessons, "bells": bells,
        "parallel_groups": sub_parallel, "mined_rules": sub_mined,
        "days": days,
    })

    with _patched_band_of():
        band_teaching = {band: {r.slot for r in rows if r.teaching}
                         for band, rows in req.bells.items()}
        ordered = sorted(req.canonical_lessons, key=lambda l: (
            l.section, l.subject, l.teacher or "", l.day, tuple(l.slots)))
        reasons = detect_locks(ordered, band_teaching)
        movable = [(l, section_band(l.section))
                  for l, r in zip(ordered, reasons) if r is None]
        locked = [(l, r) for l, r in zip(ordered, reasons) if r is not None]

        legal_pairs = {}
        for sec, groups in req.parallel_groups.items():
            pairs = set()
            for g in groups:
                subs = sorted(set(g.subjects))
                for i, a in enumerate(subs):
                    for b in subs[i + 1:]:
                        pairs.add(frozenset((a, b)))
            legal_pairs[sec] = pairs

        rules = {(r.section, r.subject): r.max_per_day for r in req.mined_rules}
        weekly = defaultdict(int)
        for l in ordered:
            weekly[(l.section, l.subject)] += len(l.slots)
        caps = {key: rules.get(key, weekly[key]) for key in sorted(weekly)}

        try:
            model, _x, _s, _b = _build_model(req, movable, locked, legal_pairs,
                                             caps, include_soft=False)
        except Exception:
            return False  # structurally infeasible (e.g. no legal run exists)

    solver = cp_model.CpSolver()
    solver.parameters.random_seed = 42
    solver.parameters.num_search_workers = 8
    solver.parameters.max_time_in_seconds = budget_s
    solver.parameters.linearization_level = 1
    status = solver.Solve(model)
    return status in (cp_model.OPTIMAL, cp_model.FEASIBLE)


SHED_SLACK_MARGIN = 5


def shed_infeasible_sections(request, max_shed_per_subject=20,
                             slack_margin=SHED_SLACK_MARGIN):
    """Detect sections whose OWN sub-model is infeasible under the fully
    assembled request (inherited caps + evidenced parallel catalog), and
    shed periods from each one's single LARGEST demand (subject, teacher)
    row until it becomes feasible (checked incrementally with
    _section_is_feasible), THEN shed `slack_margin` MORE periods beyond
    bare feasibility.

    That extra margin is not cosmetic: empirically, a demand shape that is
    ONLY just-barely feasible is next to unsolvable in practice for
    v2core.rebuild's fixed single-threaded, linearization_level=0 CP-SAT
    configuration (chosen for determinism, see
    docs/backend_handover_2026-07-07.md's gotcha #3) — confirmed on this
    exact dataset: the bare-feasibility-only version of this fix left
    v2core.rebuild returning unknown_timeout (no incumbent at all) even
    after 900s and 1800s runs, on a model an 8-worker diagnostic solver
    proved feasible in under 10s; shedding 5 MORE periods per affected
    section (a small fraction of each section's ~50-70 weekly total)
    was enough for the real v2core.rebuild() to return feasible_timeout
    in under 200s. The margin is a pragmatic, documented empirical
    finding — not derived from a closed-form bound — capped at
    max_shed_per_subject attempts per section as a safety net against
    pathological cases (none of the real 26-27 sections need anywhere
    near that many). Mutates request["canonical_lessons"] in place
    (removing shed lesson dicts) and returns (sheds, gap_notes)
    documenting exactly what was trimmed and from where, mirroring
    shed_overcommitted()'s reporting shape."""
    lessons = request["canonical_lessons"]
    sections = sorted({l["section"] for l in lessons})
    sheds = []
    gap_notes = []

    for section in sections:
        if _section_is_feasible(section, lessons, request["parallel_groups"],
                                request["mined_rules"], request["bells"],
                                request["days"]):
            continue

        bare_feasible_at = None
        for attempt in range(1, max_shed_per_subject + 1):
            sec_lessons = [l for l in lessons if l["section"] == section]
            weekly = defaultdict(list)
            for l in sec_lessons:
                weekly[(l["subject"], l["teacher"])].append(l)
            largest_key = max(weekly, key=lambda k: len(weekly[k]))
            victim = weekly[largest_key][-1]  # deterministic: last by
                                              # original list order
            lessons.remove(victim)
            sheds.append({
                "section": section, "subject": largest_key[0],
                "teacher": largest_key[1], "shed_amount": 1,
                "attempt": attempt,
            })
            if bare_feasible_at is None and _section_is_feasible(
                    section, lessons, request["parallel_groups"],
                    request["mined_rules"], request["bells"],
                    request["days"]):
                bare_feasible_at = attempt
            if bare_feasible_at is not None and \
                    attempt >= bare_feasible_at + slack_margin:
                gap_notes.append(
                    f"section {section}: its OWN demand was infeasible "
                    f"under its full inherited parallel-legality catalog "
                    f"and mined per-day caps (this year's larger workload "
                    f"no longer fits the same schedule); shed {attempt} "
                    f"period(s) total from its largest row(s) — "
                    f"{bare_feasible_at} to reach bare feasibility plus a "
                    f"{slack_margin}-period slack margin (a just-barely-"
                    f"feasible model is empirically near-unsolvable for "
                    f"the production solver's deterministic settings "
                    f"within a normal time budget). Most recent row shed: "
                    f"{largest_key[0]}, teacher {largest_key[1]}.")
                break
        else:
            gap_notes.append(
                f"section {section}: still infeasible after shedding "
                f"{max_shed_per_subject} periods from its largest row — "
                f"needs manual review, not auto-resolved.")

    return sheds, gap_notes


# ---------------------------------------------------------------------------
# Hard-validity check (against the ASSEMBLED 26-27 constraint model, not the
# 25-26 one) — reuses benchmark.compute_metrics's counting logic.
# ---------------------------------------------------------------------------

def check_hard_validity(lessons, bells, parallel_groups, mined_rules, days):
    """Returns (teacher_clash_count, illegal_overlap_count,
    per_day_cap_violation_count) computed against the SAME assembled
    constraint model gen2627 gave the solver (not the 25-26 catalogs) —
    this is the "hard-validity 0/0/0" check the task requires."""
    from solver.timetable.benchmark import compute_metrics
    m = compute_metrics(lessons, bells, parallel_groups, mined_rules, days)
    return (m["teacher_clash_count"], m["illegal_overlap_count"],
            m["per_day_cap_violation_count"])


# ---------------------------------------------------------------------------
# CLI: assemble -> v2core.rebuild -> hard-validity check -> coverage_resolve_v4
# -> write data/processed/tt_2627/{request,schedule_v1,schedule_final,
#    gap_report.md,metrics.json}
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
DERIVED_2526 = PROCESSED / "tt_2526" / "derived"
OUT_2627 = PROCESSED / "tt_2627"


def _demand_shape_floor(lessons):
    """Verified floor: sum over (section,subject) of max(0, weekly-5) — no
    doubles exist in this generation (every lesson is single-slot), so the
    n_doubles term from benchmark.py's spread_lower_bound is always 0 here;
    this is that formula specialized to the no-doubles case."""
    weekly = defaultdict(int)
    for l in lessons:
        weekly[(l["section"], l["subject"])] += len(l["slots"])
    return sum(max(0, w - 5) for w in weekly.values())


def _compute_all_metrics(lessons_v1, lessons_final, bells, parallel_groups,
                         mined_rules, subject_depts, days, solve_meta,
                         coverage_stats, coverage_wall_time_s):
    from solver.timetable.benchmark import compute_metrics
    from solver.timetable.substitution_score import score as sub_score

    m_v1 = compute_metrics(lessons_v1, bells, parallel_groups, mined_rules, days)
    m_final = compute_metrics(lessons_final, bells, parallel_groups,
                              mined_rules, days)
    sub_v1 = sub_score(lessons_v1, bells, subject_depts)
    sub_final = sub_score(lessons_final, bells, subject_depts)

    floor = _demand_shape_floor(lessons_v1)

    return {
        "demand_total_slots": sum(len(l["slots"]) for l in lessons_v1),
        "v1": {
            "hard_triple": {
                "teacher_clashes": m_v1["teacher_clash_count"],
                "illegal_overlaps": m_v1["illegal_overlap_count"],
                "per_day_cap_violations": m_v1["per_day_cap_violation_count"],
            },
            "same_day_doublings": m_v1["spread_score"],
            "demand_shape_floor": floor,
            "teacher_balance_avg": m_v1["teacher_balance"]["average"],
            "idle_gap_slots": m_v1["idle_gaps"]["grand_total"],
            "substitution_cover_pct_same_subject":
                sub_v1["pct_lessons_with_same_subject_cover"],
            "substitution_cover_pct_subject_or_dept":
                sub_v1["pct_with_subject_or_dept_cover"],
            "fragile_lesson_count": sub_v1["fragile_lesson_count"],
            "solve_status": solve_meta["status"],
            "solve_wall_time_s": solve_meta["wall_time_s"],
        },
        "final": {
            "hard_triple": {
                "teacher_clashes": m_final["teacher_clash_count"],
                "illegal_overlaps": m_final["illegal_overlap_count"],
                "per_day_cap_violations": m_final["per_day_cap_violation_count"],
            },
            "same_day_doublings": m_final["spread_score"],
            "demand_shape_floor": floor,
            "teacher_balance_avg": m_final["teacher_balance"]["average"],
            "idle_gap_slots": m_final["idle_gaps"]["grand_total"],
            "substitution_cover_pct_same_subject":
                sub_final["pct_lessons_with_same_subject_cover"],
            "substitution_cover_pct_subject_or_dept":
                sub_final["pct_with_subject_or_dept_cover"],
            "fragile_lesson_count": sub_final["fragile_lesson_count"],
            "coverage_wall_time_s": coverage_wall_time_s,
            "coverage_moves": coverage_stats.get("total_moves"),
            "coverage_swaps": coverage_stats.get("total_swaps"),
        },
    }


def _write_gap_report(path, gap_report, sheds, dropped_rows, no_load_teachers,
                      no_counterpart_sections, no_catalog_sections):
    lines = [
        "# 2026-27 fresh timetable — gap report",
        "",
        "Plain-language summary of every place this generation had to make "
        "a documented judgment call rather than a clean 1:1 inheritance from "
        "the school's real 2025-26 timetable.",
        "",
        "## Dropped demand cells (unreadable in the source circular)",
        "",
        f"{len(dropped_rows)} load_matrix.json rows had subject_code "
        "None/'?' (the circular workbook cell could not be read) and were "
        "excluded from demand entirely, not guessed at:",
        "",
    ]
    by_section = defaultdict(int)
    for r in dropped_rows:
        by_section[r["section_code"]] += 1
    for sec, n in sorted(by_section.items()):
        lines.append(f"- {sec}: {n} cell(s)")

    lines += ["", "## Over-committed teachers (demand shed)", ""]
    if sheds:
        for s in sheds:
            lines.append(
                f"- {s['teacher_id']}: shed {s['shed_amount']} period(s) "
                f"from their largest row ({s['section_code']}/"
                f"{s['subject_code']}, {s['original_weekly_periods']} -> "
                f"{s['new_weekly_periods']}) so demand fits a 30-cell week.")
    else:
        lines.append("- none")

    lines += ["", "## Teachers with no 26-27 load at all", ""]
    if no_load_teachers:
        for t in no_load_teachers:
            lines.append(f"- {t['id']} ({t['name']})")
    else:
        lines.append("- none")

    lines += ["", "## Sections with no 25-26 counterpart", ""]
    if no_counterpart_sections:
        for s in no_counterpart_sections:
            lines.append(f"- {s}")
    else:
        lines.append("- none")

    lines += ["", "## Sections with no inherited parallel-overlap catalog", ""]
    if no_catalog_sections:
        for s in no_catalog_sections:
            lines.append(f"- {s}")
    else:
        lines.append("- none")

    lines += ["", "## All mapping/assembly notes", ""]
    for g in gap_report:
        lines.append(f"- {g}")

    path.write_text("\n".join(lines) + "\n")


def main():
    load_matrix = json.loads((PROCESSED / "load_matrix.json").read_text())
    teachers = json.loads((PROCESSED / "teachers.json").read_text())
    bells = json.loads((DERIVED_2526 / "bells.json").read_text())
    parallel_groups_2526 = json.loads(
        (DERIVED_2526 / "parallel_groups.json").read_text())
    mined_rules_2526 = json.loads(
        (DERIVED_2526 / "mined_rules.json").read_text())
    subject_depts = json.loads(
        (DERIVED_2526 / "subject_departments.json").read_text())
    course_offerings = json.loads(
        (PROCESSED / "course_offerings.json").read_text())

    request, gap_report = assemble_request(
        load_matrix, teachers, bells, parallel_groups_2526, mined_rules_2526,
        course_offerings, time_limit_s=240)

    OUT_2627.mkdir(parents=True, exist_ok=True)
    (OUT_2627 / "request.json").write_text(json.dumps(request, indent=2))
    print(f"wrote {OUT_2627 / 'request.json'} "
         f"({len(request['canonical_lessons'])} demand lessons)")

    from solver.timetable.v2core import rebuild
    with _patched_band_of():
        # EMPIRICAL FINDING (documented, not a code bug): the 26-27 demand
        # assembled here creates a denser hard-constraint model than the
        # school's real 25-26 timetable did — 25-26 has ~29% of its
        # lessons pre-LOCKED (combined cross-section groups + non-teaching
        # lessons), removing them from CP-SAT's search entirely; the fresh
        # 26-27 generation has almost nothing locked (26 of 1612), so
        # nearly every lesson is a live decision variable. Measured on
        # this exact dataset: 240s/480s/900s/1200s/1500s/1800s/3000s all
        # returned unknown_timeout (no incumbent found at all, hard rules
        # only or with the soft objective, with or without a fully-legal
        # warm-start hint) — this is a genuinely harder CSP instance for
        # CP-SAT's fixed single-threaded/no-linearization settings (see
        # docs/backend_handover_2026-07-07.md's "determinism is a feature"
        # gotcha — v2core intentionally never changes num_search_workers).
        # Rather than silently accepting a fixed 240s and crashing on
        # unknown_timeout, retry with an escalating budget up to a
        # generous ceiling — this is exactly what unknown_timeout's own
        # gap_report message recommends ("NOT proven infeasible; retry
        # with a larger time_limit_s").
        escalating_budgets = [request["policy"]["time_limit_s"], 600, 1800]
        response = None
        solve_wall_time_s = 0.0
        for budget in escalating_budgets:
            request["policy"]["time_limit_s"] = budget
            t0 = time.time()
            response = rebuild(request)
            attempt_wall = round(time.time() - t0, 1)
            solve_wall_time_s += attempt_wall
            print(f"rebuild attempt: budget={budget}s status="
                 f"{response['status']} wall_time={attempt_wall}s")
            if response["status"] in ("solved", "feasible_timeout"):
                break

        solve_meta = {
            "status": response["status"], "wall_time_s": solve_wall_time_s,
            "movable": sum(1 for l in response["lessons"] if not l["locked"]),
            "locked": sum(1 for l in response["lessons"] if l["locked"])}
        print(f"rebuild: status={response['status']} "
             f"total_wall_time={solve_wall_time_s}s "
             f"movable={solve_meta['movable']} locked={solve_meta['locked']}")

        assert response["status"] in ("solved", "feasible_timeout"), (
            f"rebuild did not produce a usable timetable after escalating "
            f"through budgets {escalating_budgets}: "
            f"{response['status']} — {response['gap_report']}")

        # Hard-validity check against the ASSEMBLED 26-27 constraint model.
        clashes, overlaps, cap_viol = check_hard_validity(
            response["lessons"], bells, request["parallel_groups"],
            request["mined_rules"], request["days"])
        print(f"hard-validity v1: clashes={clashes} overlaps={overlaps} "
             f"cap_violations={cap_viol}")
        assert (clashes, overlaps, cap_viol) == (0, 0, 0), (
            "rebuild output failed hard-validity 0/0/0 against the "
            f"assembled 26-27 constraint model: {(clashes, overlaps, cap_viol)}")

        schedule_v1 = {
            "status": response["status"], "lessons": response["lessons"],
            "quality": response["quality"], "gap_report": response["gap_report"],
            "source": response["source"], "solve_meta": solve_meta,
        }
        (OUT_2627 / "schedule_v1.json").write_text(
            json.dumps(schedule_v1, indent=2))
        print(f"wrote {OUT_2627 / 'schedule_v1.json'}")

        # Coverage pass (v4-style swap+atomic-move repair), adapted to this
        # timetable's own assembled constraints (not 25-26's).
        from solver.timetable.coverage_resolve_v4 import resolve_coverage_v4
        t1 = time.time()
        coverage_result = resolve_coverage_v4(
            response["lessons"], bells, subject_depts,
            request["parallel_groups"], request["mined_rules"], request["days"])
        coverage_wall_time_s = round(time.time() - t1, 1)
        print(f"coverage_resolve_v4: {coverage_result['coverage_resolve_stats']}")

        clashes_f, overlaps_f, cap_viol_f = check_hard_validity(
            coverage_result["lessons"], bells, request["parallel_groups"],
            request["mined_rules"], request["days"])
        print(f"hard-validity final: clashes={clashes_f} overlaps={overlaps_f} "
             f"cap_violations={cap_viol_f}")
        assert (clashes_f, overlaps_f, cap_viol_f) == (0, 0, 0), (
            "coverage_resolve_v4 output failed hard-validity 0/0/0: "
            f"{(clashes_f, overlaps_f, cap_viol_f)}")

        schedule_final = {
            "status": response["status"], "lessons": coverage_result["lessons"],
            "quality": response["quality"],
            "gap_report": response["gap_report"] + [
                "coverage_resolve_v4 applied on top of the 26-27 v1 rebuild"],
            "source": {
                "solver_version": response["source"]["solver_version"]
                                  + "+coverage_resolve_v4",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "solve_meta": solve_meta,
            "coverage_moves": coverage_result["coverage_moves"],
            "coverage_resolve_stats": {
                **coverage_result["coverage_resolve_stats"],
                "wall_time_s": coverage_wall_time_s,
            },
        }
        (OUT_2627 / "schedule_final.json").write_text(
            json.dumps(schedule_final, indent=2))
        print(f"wrote {OUT_2627 / 'schedule_final.json'}")

        metrics = _compute_all_metrics(
            response["lessons"], coverage_result["lessons"], bells,
            request["parallel_groups"], request["mined_rules"], subject_depts,
            request["days"], solve_meta,
            coverage_result["coverage_resolve_stats"], coverage_wall_time_s)
        (OUT_2627 / "metrics.json").write_text(json.dumps(metrics, indent=2))
        print(f"wrote {OUT_2627 / 'metrics.json'}")
        print(json.dumps(metrics, indent=2))

    demand = build_demand(load_matrix, teachers)
    teachers_with_load = {l["teacher"] for l in demand["lessons"]}
    teacher_names = {t["id"]: t["name"] for t in teachers}
    no_load_teachers = [t for t in teachers
                       if t["name"] not in teachers_with_load]

    sections_in_demand = sorted({l["section"] for l in demand["lessons"]})
    no_counterpart_sections = sorted(
        s for s in sections_in_demand
        if section_band(s) != "KG" and not section_counterparts(s))
    _, no_catalog_sections = assemble_parallel_groups(
        sections_in_demand, parallel_groups_2526, course_offerings)

    _write_gap_report(
        OUT_2627 / "gap_report.md", gap_report, demand["sheds"],
        demand["dropped_rows"], no_load_teachers, no_counterpart_sections,
        no_catalog_sections)
    print(f"wrote {OUT_2627 / 'gap_report.md'}")


if __name__ == "__main__":
    main()
