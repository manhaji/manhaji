#!/usr/bin/env python3
"""
Seed messages_threads + thread_messages with the demo fixtures.

WHAT THIS DOES (plain English):
  Reads etl/data/messages_seed.json (12 threads), connects to Supabase,
  clears the existing message tables for this school, and inserts the demo
  threads + messages.

  After this runs, /messages shows the same 12 threads that the mock fixture
  showed — but now they're persisted in the database.

  Re-runnable. Clears existing data for this school first.

SETUP (one-time, ~2 min):
  cd ~/dev/manhaj
  source .venv/bin/activate
  pip install -r requirements.txt

  # Env vars needed in .env:
  #   SUPABASE_URL=https://<ref>.supabase.co
  #   SUPABASE_SERVICE_ROLE_KEY=<service role key>

  python etl/seed_messages.py
"""

import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT      = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "etl" / "data" / "messages_seed.json"

SCHOOL_NAME       = os.getenv("MANHAJ_SCHOOL_NAME", "International School of Oman")
DEMO_PARENT_EMAIL = "mahmoud.al-habsi@example.com"


def get_client() -> Client:
    load_dotenv(ROOT / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit(
            "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\n"
            "  Get them from: Supabase Dashboard → Project Settings → API"
        )
    return create_client(url, key)


def load_seed() -> list[dict]:
    if not SEED_PATH.exists():
        sys.exit(f"Seed file not found at {SEED_PATH}")
    with SEED_PATH.open() as f:
        return json.load(f)


def main() -> None:
    sb = get_client()
    threads = load_seed()
    print(f"Loaded {len(threads)} threads from {SEED_PATH}")

    # School lookup
    res = sb.table("schools").select("id").eq("name", SCHOOL_NAME).execute()
    if not res.data:
        sys.exit(f"Unknown school: {SCHOOL_NAME}")
    school_id = res.data[0]["id"]

    # Student id lookup
    res = sb.table("students").select("id,full_name").eq("school_id", school_id) \
            .in_("full_name", ["Layla Al-Habsi", "Omar Al-Habsi", "Yasmin Al-Habsi"]).execute()
    students = {r["full_name"]: r["id"] for r in res.data}
    for name in ["Layla Al-Habsi", "Omar Al-Habsi", "Yasmin Al-Habsi"]:
        if name not in students:
            print(f"WARN: student '{name}' not seeded in DB — single-child threads for this student will be skipped.")

    # Clear existing data for this school (child tables first)
    print("Clearing existing message data for this school...")
    existing = sb.table("messages_threads").select("id").eq("school_id", school_id).execute()
    if existing.data:
        thread_ids = [r["id"] for r in existing.data]
        sb.table("thread_messages").delete().in_("thread_id", thread_ids).execute()
        sb.table("messages_threads").delete().eq("school_id", school_id).execute()

    inserted_threads  = 0
    inserted_messages = 0

    for t in threads:
        student_name = t.get("student_name")
        student_id   = students.get(student_name) if student_name and student_name != "household" else None

        if student_name and student_name != "household" and student_id is None:
            print(f"  SKIP thread '{t['subject']}' (no student row for {student_name})")
            continue

        res = sb.table("messages_threads").insert({
            "school_id":       school_id,
            "parent_email":    DEMO_PARENT_EMAIL,
            "student_id":      student_id,
            "subject":         t["subject"],
            "category":        t["category"],
            "from_label":      t["from_label"],
            "unread":          t.get("unread", False),
            "last_activity_at": t["messages"][-1]["ts"],
        }).execute()
        thread_id = res.data[0]["id"]
        inserted_threads += 1

        message_rows = [
            {
                "thread_id":  thread_id,
                "ts":         m["ts"],
                "role":       m["role"],
                "from_name":  m["from_name"],
                "from_label": m["from_label"],
                "body":       m["body"],
                "opened_at":  m.get("opened_at"),
            }
            for m in t["messages"]
        ]
        sb.table("thread_messages").insert(message_rows).execute()
        inserted_messages += len(message_rows)

    print(f"Seeded {inserted_threads} threads, {inserted_messages} messages.")


if __name__ == "__main__":
    main()
