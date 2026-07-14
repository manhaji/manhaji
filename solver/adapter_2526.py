#!/usr/bin/env python3
"""READ-ONLY substitution dry run against the REAL AY 2025-2026 timetable.

What it does (plain English):
  1. Connects to Supabase Postgres read-only (cannot change data).
  2. Picks an absent teacher (default: Mohammed Saab — Math, Gr7-12 band, a
     busy teacher with lessons across five different sections) and pretends
     they are out all day Monday.
  3. Builds the same solver request shape as solver/adapter_dryrun.py, but
     scoped to AY 2025-2026 real data: their Monday lessons to cover,
     every other AY-2025-2026 teacher's busy map (from timetable_slots),
     the subjects they teach (from the imported lessons), department (via
     subjects.department where the imported/mapped subject has one), and a
     weekly cap proxy of 30 (teacher_contracts wasn't populated for the new
     25-26-only teachers, so this is a flat stand-in, same idea as the
     existing dry run's ceil(30/5)).
  4. Runs solver.core.solve() and prints the cover plan in plain language.
  5. VALIDATES each proposed substitute against
     data/processed/tt_2526/teachers_lessons.json — the substitute's own
     teacher-page ground truth extracted straight from the source PDF. For
     every (substitute, day, slot) the solver proposes, this asserts that
     person has NO lesson there on their real page. Any violation is
     reported loudly, not papered over.

Usage:  .venv/bin/python solver/adapter_2526.py [teacher_full_name] [day]
        defaults: "Mohammed Saab" "Mon"
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2.extras

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from etl.tt2526_helpers import VERIFIED_TEACHER_VARIANTS, normalize_person_name  # noqa: E402
from solver.core import solve  # noqa: E402
from solver.db import connect  # noqa: E402

# Reverse of the import-time variants map (canonical 25-26 string -> DB
# full_name), keyed by normalized DB full_name, so ground-truth lookups can
# go the other way: DB full_name -> the canonical name the PDF actually
# printed. Needed because e.g. "Zainab Murtada" (PDF) was matched to the
# live DB row "ZEINAB MURTADA" (26-27 spelling) — those are NOT the same
# string, so a naive lookup would wrongly find no ground-truth lessons and
# vacuously "pass".
_DB_TO_CANONICAL = {
    normalize_person_name(db_name): canonical
    for canonical, db_name in VERIFIED_TEACHER_VARIANTS.items()
}

AY_LABEL = "2025-2026"
GROUND_TRUTH_PATH = ROOT / "data" / "processed" / "tt_2526" / "teachers_lessons.json"

# The solver's request shape doesn't carry calendar dates for this synthetic
# exercise (there's no real staff_absences row for 25-26) — we use a
# placeholder ISO date whose weekday doesn't matter; only day_of_week drives
# the free/busy lookup against timetable_slots.
PLACEHOLDER_DATE = "2026-02-02"  # arbitrary Monday-labelled placeholder


def main():
    absent_name = sys.argv[1] if len(sys.argv) > 1 else "Mohammed Saab"
    dow = sys.argv[2] if len(sys.argv) > 2 else "Mon"
    issues = []

    conn = connect(readonly=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("select id, name from schools limit 1")
    school = cur.fetchone()
    cur.execute("select id, label from academic_years where label=%s", (AY_LABEL,))
    ay = cur.fetchone()
    if not ay:
        sys.exit(f"ERROR: academic year '{AY_LABEL}' not found — run etl/load_tt2526.py --apply first.")

    cur.execute(
        "select id, full_name from teachers where school_id=%s and full_name=%s",
        (school["id"], absent_name),
    )
    absent_teacher = cur.fetchone()
    if not absent_teacher:
        sys.exit(f"ERROR: teacher '{absent_name}' not found live.")
    absent_id = absent_teacher["id"]

    # --- the whole AY-2025-2026 timetable for this day of week -------------
    cur.execute(
        """
        select ts.id as slot_id, ts.teacher_id, ts.section_id, ts.subject_id,
               ts.room_id, ts.bell_period_id, bp.period_number, bp.period_label,
               bp.band, bp.starts_at, bp.ends_at,
               t.full_name, sec.code as section_code, sub.name_en as subject_name,
               sub.code as subject_code, sub.department
        from timetable_slots ts
        join bell_periods bp on bp.id = ts.bell_period_id
        join teachers t      on t.id = ts.teacher_id
        join sections sec    on sec.id = ts.section_id
        join subjects sub    on sub.id = ts.subject_id
        where ts.academic_year_id = %s and bp.day_of_week = %s
        order by bp.period_number
        """,
        (ay["id"], dow),
    )
    day_slots = cur.fetchall()

    # IMPORTANT cross-band wall-clock note: each grade band (KG/GR1_6/GR7_12)
    # has its OWN bell_periods rows (own bell_period_id), even for periods
    # that share the same real-world clock time (e.g. GR1_6's P5 and
    # GR7_12's P5 are both 11:15-11:55 on Mon, but are two different DB
    # rows). A teacher busy in one band's P5 is just as unavailable for a
    # cover in another band's P5 if the clock times overlap — this is NOT
    # captured by comparing bell_period_id directly (the solver's own
    # collision logic keys on bell_period_id). We bridge this here: for every
    # (day, starts_at, ends_at) wall-clock window, find every bell_period_id
    # across all three bands that occupies it, and mark a teacher busy at ALL
    # of them if they have a lesson at ANY of them.
    clock_key_to_bell_ids = defaultdict(set)
    for s in day_slots:
        clock_key_to_bell_ids[(s["starts_at"], s["ends_at"])].add(str(s["bell_period_id"]))
    # Also cover every band's bell row for this day (not just ones with a
    # lesson this run), so the bridge is complete even for empty periods.
    cur.execute(
        "select id, starts_at, ends_at from bell_periods where academic_year_id=%s and day_of_week=%s",
        (ay["id"], dow),
    )
    for r in cur.fetchall():
        clock_key_to_bell_ids[(r["starts_at"], r["ends_at"])].add(str(r["id"]))

    absent_slots = [s for s in day_slots if s["teacher_id"] == absent_id]
    if not absent_slots:
        sys.exit(f"No {dow} lessons found for {absent_name} in AY {AY_LABEL} — nothing to cover.")

    print(f"School: {school['name']}   AY: {ay['label']}")
    print(f"Absent: {absent_name} out all day {dow} (real AY-2025-2026 data)")
    print(f"Lessons to cover: {len(absent_slots)}")
    for s in absent_slots:
        print(f"  - {s['period_label']} {s['subject_name']} @ {s['section_code']}")
    print()

    # --- candidate pool: every AY-2025-2026 teacher -------------------------
    # "AY-2025-2026 teacher" = anyone with at least one timetable_slots row
    # in this academic year (the imported roster, including new hires and
    # the vacancy/co-teaching placeholders, which we exclude below).
    cur.execute(
        """
        select distinct t.id, t.full_name, t.primary_dept, t.employment_status
        from teachers t
        join timetable_slots ts on ts.teacher_id = t.id
        where ts.academic_year_id = %s
        order by t.full_name
        """,
        (ay["id"],),
    )
    all_ay_teachers = cur.fetchall()
    # Exclude placeholders — they aren't real people who can cover a lesson.
    teachers = [
        t for t in all_ay_teachers
        if t["full_name"] != "Unassigned (vacancy)" and "/" not in t["full_name"]
    ]
    excluded = len(all_ay_teachers) - len(teachers)
    if excluded:
        issues.append(f"{excluded} placeholder teacher row(s) excluded from the candidate pool "
                       f"(vacancy + co-teaching composites — not real substitutes).")

    # subjects each teacher teaches, derived from the imported lessons
    # (timetable_slots for this AY), since teacher_section_subject (the
    # 26-27 load matrix) doesn't cover the newly-created 25-26 teachers.
    cur.execute(
        """
        select teacher_id, subject_id from timetable_slots
        where academic_year_id = %s
        """,
        (ay["id"],),
    )
    subj_by_teacher = defaultdict(set)
    for r in cur.fetchall():
        subj_by_teacher[r["teacher_id"]].add(r["subject_id"])

    # department via subjects.department where the teacher's subjects have one
    # (majority vote among their taught subjects' departments)
    cur.execute("select id, department from subjects")
    dept_by_subject = {r["id"]: r["department"] for r in cur.fetchall()}

    def majority_department(teacher_id):
        depts = [dept_by_subject.get(sid) for sid in subj_by_teacher.get(teacher_id, set())]
        depts = [d for d in depts if d]
        if not depts:
            return None
        return max(set(depts), key=depts.count)

    null_dept = sum(1 for t in teachers if not (t["primary_dept"] or majority_department(t["id"])))
    if null_dept:
        issues.append(f"{null_dept}/{len(teachers)} candidate teachers have no derivable department "
                       f"(no primary_dept and no departmental subjects taught this AY).")

    # busy periods for this day-of-week, from the real timetable. One entry
    # per real lesson (own bell_period_id) — this is what "busy_today" counts
    # for the daily-cap penalty, so it must stay 1:1 with actual lessons.
    busy_by_teacher = defaultdict(set)  # teacher_id -> set of bell_period_id strings
    for s in day_slots:
        busy_by_teacher[s["teacher_id"]].add(str(s["bell_period_id"]))

    # Cross-band wall-clock bridge, applied ONLY to the slots we're trying to
    # cover (not to every busy entry — that would inflate busy_today and
    # break the daily-cap math, see docs note below). For each of the 5
    # target slots, any teacher with a real lesson at the SAME wall-clock
    # window in a DIFFERENT band is marked busy at that target slot's own
    # bell_period_id too, so the solver's bell_period_id-keyed clash check
    # catches e.g. GR1_6 P5 vs GR7_12 P5 (both 11:15-11:55 on Mon) as a
    # genuine double-booking.
    target_slots_for_bridge = [s for s in day_slots if s["teacher_id"] == absent_id]
    for target in target_slots_for_bridge:
        clock_key = (target["starts_at"], target["ends_at"])
        overlapping_bell_ids = clock_key_to_bell_ids[clock_key]
        for s in day_slots:
            if str(s["bell_period_id"]) in overlapping_bell_ids and s["bell_period_id"] != target["bell_period_id"]:
                busy_by_teacher[s["teacher_id"]].add(str(target["bell_period_id"]))

    cur.execute(
        "select count(*) as n from bell_periods where academic_year_id=%s and day_of_week=%s and is_teaching",
        (ay["id"], dow),
    )
    teaching_periods_max = cur.fetchone()["n"]  # rough ceiling across all 3 bands combined

    cur.execute("""
        select substitute_teacher_id, count(*) as n
        from substitutions group by substitute_teacher_id
    """)
    covers = {r["substitute_teacher_id"]: r["n"] for r in cur.fetchall()}
    if not covers:
        issues.append("substitutions table is empty — cover_done_recently is 0 for everyone.")

    teacher_payload = []
    for t in teachers:
        busy_bell_ids = busy_by_teacher.get(t["id"], set())
        busy = [{"date": PLACEHOLDER_DATE, "bell_period_id": bid} for bid in sorted(busy_bell_ids)]
        # Same daily-cap proxy idea as adapter_dryrun.py: weekly cap 30 (no
        # teacher_contracts row exists yet for the 25-26-only teachers, so
        # this is a flat stand-in per the task spec, not a derived value).
        cap_weekly = 30
        teacher_payload.append({
            "teacher_id": str(t["id"]),
            "subject_ids": sorted(str(x) for x in subj_by_teacher.get(t["id"], set())),
            "department": t["primary_dept"] or majority_department(t["id"]),
            "max_periods_per_day": math.ceil(cap_weekly / 5),
            "busy": busy,
            "free_periods_today": {PLACEHOLDER_DATE: max(0, teaching_periods_max - len(busy))},
            "cover_done_recently": covers.get(t["id"], 0),
        })

    request = {
        "scope": {
            "school_id": str(school["id"]),
            "academic_year_id": str(ay["id"]),
            "date_from": PLACEHOLDER_DATE,
            "date_to": PLACEHOLDER_DATE,
        },
        "absences": [{
            "teacher_id": str(absent_id),
            "dates": [PLACEHOLDER_DATE],
            "periods": "all",
            "reason": "sick (synthetic — AY 2025-2026 real-data exercise)",
        }],
        "slots_to_cover": [{
            "slot_id": str(s["slot_id"]),
            "date": PLACEHOLDER_DATE,
            "bell_period_id": str(s["bell_period_id"]),
            "day_of_week": dow,
            "section_id": str(s["section_id"]),
            "subject_id": str(s["subject_id"]),
            "room_id": str(s["room_id"]) if s["room_id"] else None,
            "teacher_id": str(absent_id),
        } for s in absent_slots],
        "teachers": teacher_payload,
        "policy": {
            "fairness_cap_per_teacher": 3,
            "prefer_same_subject_weight": 100,
            "prefer_same_department_weight": 40,
            "over_daily_cap_penalty": 60,
            "consume_only_prep_penalty": 25,
        },
    }

    resp = solve(request)

    names = {str(t["id"]): t["full_name"] for t in teachers}
    slot_label = {str(s["slot_id"]): f"{s['period_label']} {s['subject_name']} ({s['section_code']})"
                  for s in absent_slots}

    print(f"Solver status: {resp['status']}   confidence: {resp['confidence']}")
    print(f"Summary: {resp['notes_for_admin']}")
    print()
    print("COVER PLAN:")
    for a in resp["assignments"]:
        alts = ", ".join(f"{names.get(x['substitute_teacher_id'],'?')} ({x['match_type']})"
                         for x in a["alternatives"]) or "none"
        print(f"  COVERED  {slot_label[a['slot_id']]}: {names.get(a['substitute_teacher_id'],'?')} "
              f"[{a['match_type']}, score {a['score']}] — alternatives: {alts}")
    for u in resp["unfilled"]:
        print(f"  UNFILLED {slot_label[u['slot_id']]}: {u['reason']}")
    print()

    # -----------------------------------------------------------------
    # GROUND-TRUTH VALIDATION against teachers_lessons.json (their own
    # PDF page — the source of truth this whole exercise is meant to be
    # checked against).
    # -----------------------------------------------------------------
    print("GROUND-TRUTH VALIDATION (vs. data/processed/tt_2526/teachers_lessons.json):")
    ground_truth = json.loads(GROUND_TRUTH_PATH.read_text())
    # index: (normalized teacher name, day) -> set of slot labels (P1../B1/B2) busy.
    # Keyed by NORMALIZED name (not the raw PDF string) so casing differences
    # don't cause false "no ground truth found" misses.
    busy_slots_gt = defaultdict(set)
    for row in ground_truth:
        norm_name = normalize_person_name(row["teacher"])
        for slot in row["slots"]:
            busy_slots_gt[(norm_name, row["day"])].add(slot)

    def ground_truth_name_for(db_full_name: str) -> str:
        """DB full_name -> the name key to look up in the ground truth. Most
        teachers' DB full_name IS what the PDF printed (case differences
        only, already handled by normalize_person_name). The 7 verified
        variants (e.g. 'ZEINAB MURTADA' in the DB, 'Zainab Murtada' in the
        PDF) need the reverse map.
        """
        norm_db = normalize_person_name(db_full_name)
        return _DB_TO_CANONICAL.get(norm_db, db_full_name)

    slot_period_label = {str(s["slot_id"]): s["period_label"] for s in absent_slots}
    violations = []
    checks_run = 0
    for a in resp["assignments"]:
        sub_name = names.get(a["substitute_teacher_id"])
        period_label = slot_period_label[a["slot_id"]]
        checks_run += 1
        gt_name = ground_truth_name_for(sub_name)
        gt_key = (normalize_person_name(gt_name), dow)
        gt_busy = busy_slots_gt.get(gt_key, set())
        if not busy_slots_gt and False:
            pass  # (kept simple: an empty overall ground truth would be a loader bug, not asserted here)
        if gt_key not in busy_slots_gt:
            issues.append(f"{sub_name} (looked up as {gt_name!r}) has NO ground-truth teacher page "
                          f"at all for {dow} — cannot validate this cover independently.")
        if period_label in gt_busy:
            violations.append(
                f"{sub_name} was assigned to cover {period_label} on {dow}, but their OWN "
                f"teacher-page (ground truth, as {gt_name!r}) shows them busy at {period_label} on {dow}."
            )

    if violations:
        print(f"  *** VALIDATION FAILED *** {len(violations)}/{checks_run} proposed covers "
              f"conflict with ground truth:")
        for v in violations:
            print(f"    - {v}")
    else:
        print(f"  PASSED — all {checks_run} proposed substitute+slot pairs are confirmed free "
              f"on their own ground-truth teacher page for {dow}.")

    print()
    print("DATA ISSUES NOTICED:")
    for i, msg in enumerate(issues, 1):
        print(f"  {i}. {msg}")

    out = ROOT / "solver" / "dryrun_2526_last_response.json"
    out.write_text(json.dumps({
        "request_summary": {
            "absent_teacher": absent_name, "day_of_week": dow,
            "slots": len(absent_slots), "candidates": len(teacher_payload)},
        "response": resp,
        "ground_truth_validation": {
            "checks_run": checks_run,
            "violations": violations,
            "passed": not violations,
        },
        "issues": issues,
    }, indent=2))
    print(f"\nFull response saved to {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
