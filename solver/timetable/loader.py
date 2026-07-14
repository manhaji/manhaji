#!/usr/bin/env python3
"""Load an approved timetable plan into timetable_slots.

SAFETY MODEL:
  - Default mode is --dry-run: connects READ-ONLY, prints exactly what would
    happen, changes nothing.
  - --apply mode requires typing the school name to confirm, runs in ONE
    transaction: delete existing source='solver' rows for (school, AY), then
    insert the new plan. Rows with source='human' are never touched.
  - PREREQUISITE for --apply: schema/012_timetable_parallel.sql must have
    been applied first (the old unique rule forbids parallel section lessons).
  - Pre-flight collision check: the delete only clears source='solver', so a
    surviving row from another source (e.g. leftover 'demo' scaffolding) can
    carry the exact same (section, subject, teacher, bell_period) as a plan
    row — 012's new unique rule would then reject the insert mid-transaction.
    Both modes report these collisions; --apply refuses to proceed while any
    exist.
  - --replace-demo (only meaningful with --apply): widens the delete to
    source in ('solver', 'demo'). The demo rows are hand-seeded scaffolding
    that predates the real generated timetable and is superseded by it.

Usage:  .venv/bin/python solver/timetable/loader.py                      (dry run)
        .venv/bin/python solver/timetable/loader.py --apply              (real write)
        .venv/bin/python solver/timetable/loader.py --apply --replace-demo
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from solver.db import connect  # noqa: E402

OUT_DIR = ROOT / "solver" / "timetable_out"


def plan_to_rows(plan, school_id, ay_id):
    """Pure: BuildResponse dict -> list of insert tuples."""
    return [
        (school_id, ay_id, s["section_id"], s["subject_id"], s["teacher_id"],
         s["bell_period_id"], "solver")
        for s in plan["slots"]
    ]


def find_collisions(plan_rows, existing_rows):
    """Pure: which surviving non-solver rows clash with the plan under 012?

    plan_rows are loader insert tuples; existing_rows are dicts (keys:
    section_id, subject_id, teacher_id, bell_period_id, source) for rows the
    delete will NOT remove. A collision is an existing row whose
    (section_id, subject_id, teacher_id, bell_period_id) also appears in the
    plan — 012's unique rule would reject that insert.
    """
    plan_keys = {(r[2], r[3], r[4], r[5]) for r in plan_rows}
    return [
        row for row in existing_rows
        if (row["section_id"], row["subject_id"], row["teacher_id"],
            row["bell_period_id"]) in plan_keys
    ]


def main():
    apply_mode = "--apply" in sys.argv
    replace_demo = "--replace-demo" in sys.argv
    plan = json.loads((OUT_DIR / "plan.json").read_text())
    request = json.loads((OUT_DIR / "request.json").read_text())
    school_id = request["scope"]["school_id"]
    ay_id = request["scope"]["academic_year_id"]
    rows = plan_to_rows(plan, school_id, ay_id)

    doomed_sources = ("solver", "demo") if replace_demo else ("solver",)

    conn = connect(readonly=not apply_mode)
    cur = conn.cursor()
    cur.execute("""
        select source, count(*) from timetable_slots
        where school_id = %s and academic_year_id = %s group by source""",
        (school_id, ay_id))
    existing = dict(cur.fetchall())
    print(f"existing timetable_slots by source: {existing or '{}'}")
    print(f"plan rows to insert (source='solver'): {len(rows)}")
    print(f"rows that would be deleted first (source in {doomed_sources}): "
          f"{sum(existing.get(s, 0) for s in doomed_sources)}")

    # Pre-flight: rows the delete won't clear that clash with the plan.
    cur.execute("""
        select section_id::text, subject_id::text, teacher_id::text,
               bell_period_id::text, source
        from timetable_slots
        where school_id = %s and academic_year_id = %s and source <> 'solver'""",
        (school_id, ay_id))
    surviving = [
        {"section_id": r[0], "subject_id": r[1], "teacher_id": r[2],
         "bell_period_id": r[3], "source": r[4]}
        for r in cur.fetchall()
        if r[4] not in doomed_sources  # rows --replace-demo would clear don't collide
    ]
    collisions = find_collisions(rows, surviving)
    if not collisions:
        print("collisions with surviving non-solver rows: 0")
    else:
        for c in collisions:
            print(f"collision (source={c['source']}): section={c['section_id']} "
                  f"subject={c['subject_id']} teacher={c['teacher_id']} "
                  f"bell_period={c['bell_period_id']}")
        print("--apply would ABORT on these; re-run with --apply --replace-demo "
              "to also clear source='demo' rows")

    if not apply_mode:
        print("\nDRY RUN — nothing changed. Re-run with --apply to load.")
        return

    if collisions:
        sys.exit(f"aborting: {len(collisions)} collision(s) with surviving "
                 f"non-solver rows would violate the 012 unique rule — "
                 f"re-run with --apply --replace-demo to also clear "
                 f"source='demo' rows. Nothing changed.")

    confirm = input("Type the school name to confirm the write: ").strip()
    cur.execute("select name from schools where id = %s", (school_id,))
    if confirm != cur.fetchone()[0]:
        sys.exit("confirmation mismatch — aborting, nothing changed")

    cur.execute("""
        delete from timetable_slots
        where school_id = %s and academic_year_id = %s and source = any(%s)""",
        (school_id, ay_id, list(doomed_sources)))
    deleted = cur.rowcount
    cur.executemany("""
        insert into timetable_slots
            (school_id, academic_year_id, section_id, subject_id, teacher_id,
             bell_period_id, source)
        values (%s, %s, %s, %s, %s, %s, %s)""", rows)
    conn.commit()
    print(f"done: deleted {deleted} old rows (source in {doomed_sources}), "
          f"inserted {len(rows)}.")


if __name__ == "__main__":
    main()
