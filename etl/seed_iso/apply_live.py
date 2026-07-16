#!/usr/bin/env python3
"""
apply_live.py — LIVE, ATOMIC apply of the ISO seed + migrations 009/010/018 to
the Manhaj TARGET DB (qntmzazndkcdgkwmrhae). Approved by Elias 2026-07-16.

Everything runs inside ONE transaction:
  BEGIN
    009_section_mapping_save.sql
    010_messages.sql            (canonical, already fixed full_name -> full_name_en)
    018_backfill_teacher_primary_dept.sql
    seed_iso_roster.sql         (722 students, 838 parents, 1444 links)
    seed_iso_demo.sql           (idempotent demo family)
    track_migrations.sql        (record 009/010/018 in the tracker)
  verify counts + integrity INSIDE the transaction
  COMMIT only if every expectation matches; otherwise ROLLBACK and report.

Run with:  --commit   to really commit. Without it, it ROLLS BACK (safe dry-run).
"""
import psycopg2, os, sys

HERE   = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.abspath(os.path.join(HERE, "..", "..", "schema"))
DSN = dict(host="aws-1-ap-south-1.pooler.supabase.com", port=5432,
           user="postgres.qntmzazndkcdgkwmrhae",
           password="Mhj2026MigrateKxQw9RtZn6Bp", dbname="postgres")

COMMIT = "--commit" in sys.argv

TABLES = ['students','parents','student_parents','lessons','staff_absences','substitutions']
EXPECT_DELTA = dict(students=722, parents=838, student_parents=1444,
                    lessons=2, staff_absences=1, substitutions=1)

def counts(cur):
    out = {}
    for t in TABLES:
        cur.execute(f"select count(*) from {t}"); out[t] = cur.fetchone()[0]
    for t in ['messages_threads','thread_messages']:
        cur.execute("select to_regclass(%s)", (f"public.{t}",))
        if cur.fetchone()[0] is None:
            out[t] = None
        else:
            cur.execute(f"select count(*) from {t}"); out[t] = cur.fetchone()[0]
    return out

def run(cur, label, path):
    with open(path) as f:
        cur.execute(f.read())
    print(f"  [OK]   {label}")

def main():
    conn = psycopg2.connect(**DSN); conn.autocommit = False
    cur = conn.cursor()
    cur.execute("select current_database(), current_user")
    db, usr = cur.fetchone()
    print(f"== identity == db={db} user={usr}  MODE={'COMMIT' if COMMIT else 'DRY-RUN (rollback)'}")

    print("\n== BEFORE ==")
    before = counts(cur)
    for k, v in before.items(): print(f"  {k:18}{v}")
    cur.execute("select count(*) from students where current_section_id is null")
    before_null_sec = cur.fetchone()[0]
    print(f"  students NULL section (pre): {before_null_sec}")

    print("\n== migrations ==")
    run(cur, "009_section_mapping_save.sql", os.path.join(SCHEMA, "009_section_mapping_save.sql"))
    run(cur, "010_messages.sql (fixed)",     os.path.join(SCHEMA, "010_messages.sql"))
    run(cur, "018_backfill_teacher_primary_dept.sql", os.path.join(SCHEMA, "018_backfill_teacher_primary_dept.sql"))

    print("\n== seed ==")
    run(cur, "seed_iso_roster.sql", os.path.join(HERE, "seed_iso_roster.sql"))
    run(cur, "seed_iso_demo.sql",   os.path.join(HERE, "seed_iso_demo.sql"))

    print("\n== tracker ==")
    run(cur, "track_migrations.sql", os.path.join(HERE, "track_migrations.sql"))

    print("\n== AFTER (deltas) ==")
    after = counts(cur)
    ok = True
    for k in TABLES:
        d = after[k] - before[k]
        exp = EXPECT_DELTA.get(k)
        mark = "" if exp is None or d == exp else f"  <-- EXPECTED +{exp}"
        if exp is not None and d != exp: ok = False
        print(f"  {k:18}{after[k]:>6}  (+{d}){mark}")
    print(f"  messages_threads   {after['messages_threads']}")
    print(f"  thread_messages    {after['thread_messages']}")
    if after['messages_threads'] != 3 or after['thread_messages'] != 4:
        ok = False; print("  <-- EXPECTED messages_threads=3, thread_messages=4")

    print("\n== integrity ==")
    cur.execute("select count(*) from students where current_section_id is null")
    null_sec = cur.fetchone()[0]; null_sec_delta = null_sec - before_null_sec
    print(f"  students NULL section: {null_sec} (+{null_sec_delta} new R-stream, expect +18; {before_null_sec} pre-existing)")
    cur.execute("""select count(*) from students s left join sections sec on sec.id=s.current_section_id
                   where s.current_section_id is not null and sec.id is null""")
    orphan_sec = cur.fetchone()[0]; print(f"  students -> missing section (expect 0): {orphan_sec}")
    cur.execute("select count(*) from student_parents sp left join parents p on p.id=sp.parent_id where p.id is null")
    orphan_p = cur.fetchone()[0]; print(f"  links -> missing parent (expect 0): {orphan_p}")
    cur.execute("select count(*) from student_parents sp left join students s on s.id=sp.student_id where s.id is null")
    orphan_s = cur.fetchone()[0]; print(f"  links -> missing student (expect 0): {orphan_s}")
    cur.execute("select count(*) from teachers where primary_dept is null")
    dept_null = cur.fetchone()[0]; print(f"  teachers primary_dept NULL (expect 0): {dept_null}")
    cur.execute("select count(*) from teachers where primary_dept is not null")
    dept_set = cur.fetchone()[0]; print(f"  teachers primary_dept set: {dept_set}")
    cur.execute("select to_regclass('public.parent_child_demo')")
    print(f"  parent_child_demo view exists: {cur.fetchone()[0] is not None}")

    if null_sec_delta != 18 or orphan_sec or orphan_p or orphan_s or dept_null:
        ok = False

    print("\n== decision ==")
    if ok and COMMIT:
        conn.commit(); print("  ALL CHECKS PASSED -> COMMITTED.")
    elif ok:
        conn.rollback(); print("  ALL CHECKS PASSED -> DRY-RUN, rolled back (pass --commit to persist).")
    else:
        conn.rollback(); print("  CHECKS FAILED -> ROLLED BACK. Nothing persisted.")
    conn.close()
    sys.exit(0 if ok else 2)

if __name__ == "__main__":
    main()
