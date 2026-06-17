#!/usr/bin/env python3
"""
Load the school workbook into Supabase.

WHAT THIS DOES (plain English):
  Reads the school's xlsx file from disk, parses it (using the same logic as
  parse_workbook.py), and inserts/updates rows in the Supabase tables.
  After it runs, the canonical school data lives in the database instead of
  in JSON files.

  This is RE-RUNNABLE — safe to run multiple times. Stable rows (teachers,
  subjects, sections) are upserted; the volatile teacher×section×subject load
  matrix is fully reloaded per academic year (so re-running picks up changes
  to the workbook without orphaning old rows).

SETUP (one time, ~2 minutes):
  cd ~/dev/manhaj
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt

  # Copy .env.example to .env and fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  cp .env.example .env

RUN:
  source .venv/bin/activate
  python etl/load_to_postgres.py

What you'll see on success:
  → Connecting to Supabase...
  → Looking up school 'International School of Oman'...
  → Parsing workbook...
    parsed 69 teachers, 41 sections, 482 load rows
  → Upserting subjects... (32 rows)
  → Upserting teachers... (69 rows)
  → Upserting teacher contracts...
  → Upserting sections... (41 rows)
  → Reloading load matrix... (482 rows)
  → Recording source import...

  ✓ ETL complete.
    subjects: 32, teachers: 69, sections: 41, load_rows: 482
"""

from __future__ import annotations
import os, sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "etl"))

import openpyxl
from dotenv import load_dotenv
from supabase import create_client, Client


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit(
            "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\n"
            "  Get them from: Supabase Dashboard → Project Settings → API"
        )
    return create_client(url, key)


from parse_workbook import (
    parse_26_27a,
    course_offerings,
    SUBJECT_CATALOG,
    parse_section_code,
    file_sha256,
)


def env(name: str, default: str | None = None) -> str:
    return os.environ.get(name, default)  # type: ignore


def main() -> None:
    load_dotenv(ROOT / ".env")

    XLSX_PATH           = env("XLSX_PATH", str(ROOT / "data/source/24-25 provisional_18-8-2024.xlsx"))
    SCHOOL_NAME         = env("SCHOOL_NAME", "International School of Oman")
    ACADEMIC_YEAR_LABEL = env("ACADEMIC_YEAR_LABEL", "2026-2027")

    if not Path(XLSX_PATH).exists():
        sys.exit(f"ERROR: workbook not found at {XLSX_PATH}. Place it locally (gitignored) or set XLSX_PATH.")

    print("→ Connecting to Supabase...")
    sb = get_client()
    print("  connected")

    print(f"→ Looking up school '{SCHOOL_NAME}'...")
    res = sb.table("schools").select("id").eq("name", SCHOOL_NAME).execute()
    if not res.data:
        sys.exit(f"ERROR: School '{SCHOOL_NAME}' not in schools table. Run schema/005_seed_iso_pilot.sql first.")
    school_id = res.data[0]["id"]
    print(f"  school_id = {school_id}")

    print(f"→ Looking up academic year '{ACADEMIC_YEAR_LABEL}'...")
    res = sb.table("academic_years").select("id").eq("school_id", school_id).eq("label", ACADEMIC_YEAR_LABEL).execute()
    if not res.data:
        sys.exit(f"ERROR: Academic year '{ACADEMIC_YEAR_LABEL}' not seeded for this school.")
    academic_year_id = res.data[0]["id"]
    print(f"  academic_year_id = {academic_year_id}")

    print(f"→ Parsing workbook: {XLSX_PATH}")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    teachers, sections, load = parse_26_27a(wb)
    print(f"  parsed {len(teachers)} teachers, {len(sections)} sections, {len(load)} load rows")

    for t in teachers:
        if not t.get("cap"):
            t["cap"] = 30

    # =========================================================
    # 1. UPSERT SUBJECTS
    # =========================================================
    print("→ Upserting subjects...")
    seen_codes = {r["subject_code"] for r in load if r["subject_code"] != "?"}
    all_codes  = seen_codes | set(SUBJECT_CATALOG.keys())
    subj_rows = []
    for code in sorted(all_codes):
        info = SUBJECT_CATALOG.get(code, {"name_en": code, "name_ar": "", "department": "Unknown"})
        subj_rows.append({
            "school_id":     school_id,
            "code":          code,
            "name_en":       info["name_en"],
            "name_ar":       info.get("name_ar", ""),
            "department":    info["department"],
            "is_ap":         info.get("is_ap", False),
            "is_self_study": info.get("is_self_study", False),
        })
    sb.table("subjects").upsert(subj_rows, on_conflict="school_id,code").execute()
    print(f"  {len(subj_rows)} subjects upserted")

    # =========================================================
    # 2. UPSERT TEACHERS
    # =========================================================
    print("→ Upserting teachers...")
    teacher_rows = [
        {"school_id": school_id, "full_name": t["name"], "primary_subject_text": t.get("primary_subject", "")}
        for t in teachers
    ]
    sb.table("teachers").upsert(teacher_rows, on_conflict="school_id,full_name").execute()
    print(f"  {len(teacher_rows)} teachers upserted")

    # =========================================================
    # 3. UPSERT TEACHER CONTRACTS
    # =========================================================
    print("→ Upserting teacher contracts...")
    res = sb.table("teachers").select("id,full_name").eq("school_id", school_id).execute()
    teacher_id_by_name = {r["full_name"]: r["id"] for r in res.data}

    contract_rows = [
        {"teacher_id": teacher_id_by_name[t["name"]], "academic_year_id": academic_year_id, "weekly_period_cap": int(t["cap"])}
        for t in teachers
        if t["name"] in teacher_id_by_name
    ]
    sb.table("teacher_contracts").upsert(contract_rows, on_conflict="teacher_id").execute()
    print(f"  {len(contract_rows)} contracts upserted")

    # =========================================================
    # 4. UPSERT SECTIONS (codes only — mapping is a human step)
    # =========================================================
    print("→ Upserting sections (codes only — mapping is a human step)...")
    section_rows = [
        {"school_id": school_id, "academic_year_id": academic_year_id, "code": s["code"]}
        for s in sections
    ]
    sb.table("sections").upsert(section_rows, on_conflict="school_id,academic_year_id,code", ignore_duplicates=True).execute()
    print(f"  {len(section_rows)} section codes upserted (no auto-mapping)")

    # =========================================================
    # 5. RELOAD TEACHER × SECTION × SUBJECT load matrix
    # =========================================================
    print("→ Reloading load matrix...")
    res = sb.table("sections").select("id").eq("academic_year_id", academic_year_id).execute()
    section_ids = [r["id"] for r in res.data]
    if section_ids:
        sb.table("teacher_section_subject").delete().in_("section_id", section_ids).execute()
        print(f"  cleared existing load rows for this academic year")

    res = sb.table("subjects").select("id,code").eq("school_id", school_id).execute()
    subject_id_by_code = {r["code"]: r["id"] for r in res.data}
    section_id_by_code = {r["code"]: r["id"] for r in
                          sb.table("sections").select("id,code").eq("academic_year_id", academic_year_id).execute().data}

    synthetic_to_db = {}
    for t in teachers:
        db_id = teacher_id_by_name.get(t["name"])
        if db_id:
            synthetic_to_db[t["id"]] = db_id

    agg: dict = defaultdict(lambda: {"weekly_periods": 0, "source_cells": []})
    for r in load:
        key = (r["teacher_id"], r["section_code"], r["subject_code"])
        agg[key]["weekly_periods"] += int(r["weekly_periods"])
        agg[key]["source_cells"].append(r.get("source_cell", ""))
    n_dupes = len(load) - len(agg)
    if n_dupes:
        print(f"  aggregated {len(load)} cells → {len(agg)} unique tuples (collapsed {n_dupes} duplicates)")

    load_rows = []
    skipped = 0
    for (synthetic_tid, section_code, subject_code), v in agg.items():
        t_db   = synthetic_to_db.get(synthetic_tid)
        s_db   = section_id_by_code.get(section_code)
        sub_db = subject_id_by_code.get(subject_code)
        if not (t_db and s_db and sub_db):
            skipped += 1
            continue
        load_rows.append({
            "teacher_id":     t_db,
            "section_id":     s_db,
            "subject_id":     sub_db,
            "weekly_periods": v["weekly_periods"],
            "source_cell":    ",".join(v["source_cells"])[:255],
        })

    if load_rows:
        sb.table("teacher_section_subject").upsert(load_rows, on_conflict="teacher_id,section_id,subject_id").execute()
    print(f"  inserted {len(load_rows)} load rows (skipped {skipped} unresolvable)")

    # =========================================================
    # 6. RECORD SOURCE IMPORT
    # =========================================================
    print("→ Recording source import...")
    sha = file_sha256(XLSX_PATH)
    sb.table("source_imports").insert({
        "school_id":   school_id,
        "filename":    Path(XLSX_PATH).name,
        "sheet_name":  "26-27A",
        "file_sha256": sha,
        "row_count":   len(load_rows),
        "notes":       f"ETL via load_to_postgres.py ({len(teacher_rows)} teachers, "
                       f"{len(section_rows)} sections, {len(load_rows)} load rows)",
    }).execute()

    print("\n✓ ETL complete.\n")

    # Final counts
    counts = {
        "subjects": sb.table("subjects").select("id", count="exact").eq("school_id", school_id).execute().count,
        "teachers": sb.table("teachers").select("id", count="exact").eq("school_id", school_id).execute().count,
        "sections": sb.table("sections").select("id", count="exact").eq("school_id", school_id).execute().count,
        "load_rows": sb.table("teacher_section_subject").select("teacher_id", count="exact")
                       .in_("teacher_id", list(teacher_id_by_name.values())).execute().count,
    }
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
