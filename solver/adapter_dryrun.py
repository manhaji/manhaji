#!/usr/bin/env python3
"""READ-ONLY dry run: build a real /solve request from the live Manhaj DB.

What it does (plain English):
  1. Connects to Supabase Postgres exactly like etl/load_to_postgres.py,
     but the session is forced READ ONLY — this script cannot change data.
  2. Picks an absent teacher (default: the one with the most timetable slots
     on the chosen day — today that's Sandra Swart, the only teacher with a
     timetable) and pretends they are out for one day.
  3. Gathers their lessons that day, plus every other teacher's subjects,
     department, busy periods and caps, into the solver's request shape.
  4. Runs solver.core.solve() on it and prints the plan in plain language.
  5. Prints every data issue it noticed along the way.

Usage:  .venv/bin/python solver/adapter_dryrun.py [YYYY-MM-DD]
        (date defaults to 2026-09-07, a Monday in AY 2026-2027)
"""
import json
import math
import os
import sys
from collections import defaultdict
from datetime import date as date_cls
from pathlib import Path

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from solver.core import solve  # noqa: E402

DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def connect_readonly():
    env = ROOT / ".env"
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k, v)
    conn = psycopg2.connect(
        host=os.environ["SUPABASE_POOLER_HOST"],
        port=6543,
        user=f"postgres.{os.environ['SUPABASE_PROJECT_REF']}",
        password=os.environ["SUPABASE_DB_PASSWORD"],
        dbname="postgres",
        sslmode="require",
    )
    conn.set_session(readonly=True, autocommit=True)
    return conn


def main():
    on_date = sys.argv[1] if len(sys.argv) > 1 else "2026-09-07"
    dow = DOW[date_cls.fromisoformat(on_date).weekday()]
    issues = []

    conn = connect_readonly()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("select id, name from schools limit 1")
    school = cur.fetchone()
    cur.execute("select id, label from academic_years where is_current limit 1")
    ay = cur.fetchone()

    # --- the timetable for the chosen day of week -------------------------
    cur.execute("""
        select ts.id as slot_id, ts.teacher_id, ts.section_id, ts.subject_id,
               ts.room_id, ts.bell_period_id, bp.period_number,
               t.full_name, sec.code as section_code, sub.code as subject_code
        from timetable_slots ts
        join bell_periods bp on bp.id = ts.bell_period_id
        join teachers t      on t.id = ts.teacher_id
        join sections sec    on sec.id = ts.section_id
        join subjects sub    on sub.id = ts.subject_id
        where bp.day_of_week = %s
        order by bp.period_number
    """, (dow,))
    day_slots = cur.fetchall()

    cur.execute("select count(*) as n from timetable_slots")
    n_tt = cur.fetchone()["n"]
    if n_tt < 100:
        issues.append(
            f"timetable_slots has only {n_tt} rows total — this is demo data, not a real "
            f"timetable. Free/busy for every other teacher is vacuously 'free', so the "
            f"dry run exercises the pipeline, not real scheduling pressure.")

    if not day_slots:
        print(f"No timetable slots on {dow} {on_date} — nothing to cover. "
              f"(timetable_slots total rows: {n_tt})")
        return

    # absent teacher = the one with the most lessons that day
    per_teacher = defaultdict(list)
    for s in day_slots:
        per_teacher[s["teacher_id"]].append(s)
    absent_id, absent_slots = max(per_teacher.items(), key=lambda kv: len(kv[1]))
    absent_name = absent_slots[0]["full_name"]

    # --- candidate pool ----------------------------------------------------
    cur.execute("""
        select t.id, t.full_name, t.primary_dept, c.weekly_period_cap
        from teachers t
        left join teacher_contracts c on c.teacher_id = t.id
        where t.employment_status = 'active'
        order by t.full_name
    """)
    teachers = cur.fetchall()

    no_contract = [t["full_name"] for t in teachers if t["weekly_period_cap"] is None]
    if no_contract:
        issues.append(
            f"{len(no_contract)} active teacher(s) have no teacher_contracts row "
            f"({', '.join(no_contract)}) — no weekly cap known; daily cap left unset for them.")

    null_dept = sum(1 for t in teachers if not t["primary_dept"])
    if null_dept:
        issues.append(
            f"teachers.primary_dept is NULL for {null_dept}/{len(teachers)} active teachers — "
            f"same-department matching finds NOBODY. (Departments are derivable from "
            f"subjects.department via the load matrix; see Part C of schema/011_substitutions.sql.)")

    cur.execute("select teacher_id, subject_id from teacher_section_subject")
    subj_by_teacher = defaultdict(set)
    for r in cur.fetchall():
        subj_by_teacher[r["teacher_id"]].add(r["subject_id"])
    no_subjects = [t["full_name"] for t in teachers if not subj_by_teacher.get(t["id"])]
    if no_subjects:
        issues.append(
            f"{len(no_subjects)} active teacher(s) have no load-matrix rows, so no known "
            f"subjects: {', '.join(no_subjects)} — they can never same-subject match.")

    # busy periods for this day-of-week, from the timetable
    busy_by_teacher = defaultdict(list)
    for s in day_slots:
        busy_by_teacher[s["teacher_id"]].append(
            {"date": on_date, "bell_period_id": str(s["bell_period_id"])})

    cur.execute("select count(*) as n from bell_periods where day_of_week=%s and is_teaching", (dow,))
    teaching_periods = cur.fetchone()["n"]

    # fairness history — substitutions table (expected empty today)
    cur.execute("""
        select substitute_teacher_id, count(*) as n
        from substitutions group by substitute_teacher_id
    """)
    covers = {r["substitute_teacher_id"]: r["n"] for r in cur.fetchall()}
    if not covers:
        issues.append("substitutions table is empty — cover_done_recently is 0 for everyone "
                      "(expected: no cover history exists yet).")

    cur.execute("select count(*) as n from rooms")
    if cur.fetchone()["n"] == 0:
        issues.append("rooms table is empty — room continuity can't be considered (harmless "
                      "for cover, matters for the timetable builder).")

    teacher_payload = []
    for t in teachers:
        cap = t["weekly_period_cap"]
        busy = busy_by_teacher.get(t["id"], [])
        teacher_payload.append({
            "teacher_id": str(t["id"]),
            "subject_ids": sorted(str(x) for x in subj_by_teacher.get(t["id"], set())),
            "department": t["primary_dept"],
            "max_periods_per_day": math.ceil(cap / 5) if cap else None,
            "busy": busy,
            "free_periods_today": {on_date: max(0, teaching_periods - len(busy))},
            "cover_done_recently": covers.get(t["id"], 0),
        })

    request = {
        "scope": {
            "school_id": str(school["id"]),
            "academic_year_id": str(ay["id"]),
            "date_from": on_date,
            "date_to": on_date,
        },
        "absences": [{
            "teacher_id": str(absent_id),
            "dates": [on_date],
            "periods": "all",
            "reason": "sick (synthetic dry-run)",
        }],
        "slots_to_cover": [{
            "slot_id": str(s["slot_id"]),
            "date": on_date,
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

    # --- plain-language report ---------------------------------------------
    names = {str(t["id"]): t["full_name"] for t in teachers}
    slot_label = {str(s["slot_id"]): f"P{s['period_number']} {s['subject_code']} ({s['section_code']})"
                  for s in absent_slots}

    print(f"School: {school['name']}   AY: {ay['label']}")
    print(f"Pretend absence: {absent_name} out all day {dow} {on_date}")
    print(f"Lessons to cover: {len(absent_slots)}")
    print()
    print(f"Solver status: {resp['status']}   confidence: {resp['confidence']}")
    print(f"Summary: {resp['notes_for_admin']}")
    print()
    for a in resp["assignments"]:
        alts = ", ".join(f"{names.get(x['substitute_teacher_id'],'?')} ({x['match_type']})"
                         for x in a["alternatives"]) or "none"
        print(f"  COVERED  {slot_label[a['slot_id']]}: {names.get(a['substitute_teacher_id'],'?')} "
              f"[{a['match_type']}, score {a['score']}] — alternatives: {alts}")
    for u in resp["unfilled"]:
        print(f"  UNFILLED {slot_label[u['slot_id']]}: {u['reason']}")
    print()
    print("DATA ISSUES NOTICED:")
    for i, msg in enumerate(issues, 1):
        print(f"  {i}. {msg}")

    out = ROOT / "solver" / "dryrun_last_response.json"
    out.write_text(json.dumps({"request_summary": {
        "absent_teacher": absent_name, "date": on_date,
        "slots": len(absent_slots), "candidates": len(teacher_payload)},
        "response": resp, "issues": issues}, indent=2))
    print(f"\nFull response saved to {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
