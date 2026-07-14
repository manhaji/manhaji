#!/usr/bin/env python3
"""READ-ONLY adapter: build the timetable-builder request from live Supabase.

What it does (plain English):
  1. Connects read-only (solver/db.py — cannot change data).
  2. Reads the bell schedule (teaching periods only) and the 458-row load
     matrix (who teaches what to which class, how many periods a week).
  3. Assembles the BuildRequest JSON and saves it, together with a names
     file (id -> human label) for dashboards, and a plain-language gap
     report for ISO.

Usage:  .venv/bin/python solver/timetable/adapter.py
Writes: solver/timetable_out/request.json, names.json, gap_report.md
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from solver.db import connect  # noqa: E402

OUT_DIR = ROOT / "solver" / "timetable_out"


def assemble_request(school_id, ay_id, bells, demands):
    """Pure: bells = [(day, period_number, bell_period_id, is_teaching)],
    demands = [(teacher_id, section_id, subject_id, weekly_periods)]."""
    per_day = defaultdict(list)
    for day, pnum, bid, teaching in sorted(bells, key=lambda b: (b[0], b[1])):
        if teaching:
            per_day[day].append(bid)
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    unknown = set(per_day) - set(day_order)
    if unknown:
        raise ValueError(
            f"unsupported day_of_week values: {sorted(unknown)} — expected Mon..Sun; "
            f"'All' bell rows must be expanded to per-day rows before building")
    days = sorted(per_day.keys(), key=day_order.index)
    counts = {d: len(per_day[d]) for d in days}
    if len(set(counts.values())) > 1:
        raise ValueError(f"days with unequal teaching-period counts: {counts}")
    return {
        "scope": {"school_id": school_id, "academic_year_id": ay_id},
        "grid": {
            "days": days,
            "periods_per_day": counts[days[0]],
            "bell_period_ids": {d: per_day[d] for d in days},
        },
        "demands": [
            {"teacher_id": t, "section_id": s, "subject_id": j, "weekly_periods": w}
            for t, s, j, w in sorted(demands)
        ],
    }


def main():
    conn = connect(readonly=True)
    cur = conn.cursor()

    # single-tenant pilot assumption: exactly one school / one current AY
    cur.execute("select id from schools order by name limit 1")
    row = cur.fetchone()
    if row is None:
        raise SystemExit("no schools row found — is the DB seeded and .env "
                         "pointing at the right project?")
    school_id = str(row[0])
    cur.execute("select id from academic_years where is_current "
                "order by label desc limit 1")
    row = cur.fetchone()
    if row is None:
        raise SystemExit("no current academic_years row found — is the DB seeded "
                         "and .env pointing at the right project?")
    ay_id = str(row[0])

    cur.execute("""
        select day_of_week, period_number, id, is_teaching
        from bell_periods order by day_of_week, period_number""")
    bells = [(r[0], r[1], str(r[2]), r[3]) for r in cur.fetchall()]

    cur.execute("""
        select teacher_id, section_id, subject_id, weekly_periods
        from teacher_section_subject""")
    demands = [(str(r[0]), str(r[1]), str(r[2]), r[3]) for r in cur.fetchall()]

    request = assemble_request(school_id, ay_id, bells, demands)

    names = {"teachers": {}, "sections": {}, "subjects": {}}
    cur.execute("select id, coalesce(display_name, full_name) from teachers")
    names["teachers"] = {str(r[0]): r[1] for r in cur.fetchall()}
    cur.execute("select id, code from sections")
    names["sections"] = {str(r[0]): r[1] for r in cur.fetchall()}
    cur.execute("select id, coalesce(name_en, code) from subjects")
    names["subjects"] = {str(r[0]): r[1] for r in cur.fetchall()}

    # Gap report (plain language, for ISO)
    gaps = []
    lm = json.loads((ROOT / "data/processed/load_matrix.json").read_text())
    unk = [r for r in lm if r["subject_code"] in (None, "?", "")]
    if unk:
        gaps.append(f"- {len(unk)} workbook cells had unreadable subject codes and are "
                    f"not scheduled (cells: {', '.join(r['source_cell'] for r in unk[:8])}…).")
    cur.execute("""
        select coalesce(t.display_name, t.full_name)
        from teachers t
        where t.employment_status = 'active'
          and not exists (select 1 from teacher_section_subject x where x.teacher_id = t.id)""")
    no_subj = [r[0] for r in cur.fetchall()]
    if no_subj:
        gaps.append(f"- {len(no_subj)} active teachers have no load-matrix rows and are "
                    f"not in the generated timetable: {', '.join(no_subj)}.")
    cur.execute("""
        select coalesce(t.display_name, t.full_name), sum(x.weekly_periods)
        from teacher_section_subject x join teachers t on t.id = x.teacher_id
        group by 1 having sum(x.weekly_periods) > 30""")
    for name, tot in cur.fetchall():
        gaps.append(f"- {name} is assigned {tot} weekly periods but the week has 30 "
                    f"slots — the builder places 30 and reports the shortfall.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "request.json").write_text(json.dumps(request, indent=1))
    (OUT_DIR / "names.json").write_text(json.dumps(names, indent=1))
    (OUT_DIR / "gap_report.md").write_text(
        "# Timetable data gaps — for ISO\n\n" + "\n".join(gaps) + "\n")
    print(f"request: {len(request['demands'])} demands, "
          f"{len(request['grid']['days'])}x{request['grid']['periods_per_day']} grid")
    print(f"gaps: {len(gaps)} items -> {OUT_DIR / 'gap_report.md'}")


if __name__ == "__main__":
    main()
