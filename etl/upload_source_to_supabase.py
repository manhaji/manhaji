#!/usr/bin/env python3
"""
Upload the school's source files (xlsx, doc, csv) to Supabase Storage.

WHAT THIS DOES (plain English):
  Takes the files in data/source/ and uploads them to a private Supabase
  Storage bucket called 'raw-uploads'. Path pattern is
  raw-uploads/{school_id}/{YYYY-MM-DD-HHMM}-{filename}. After running, the
  files live in Supabase (encrypted, ACL-protected by service role) and
  the local copies can be deleted if you want — though keeping them is
  fine since data/source/ is gitignored anyway.

  Closes the data-storage-policy loop documented in
  docs/data_storage_policy.md: code in git, data in Supabase.

  Re-runnable. Each run uploads with a new timestamp prefix so older
  versions of the same file are preserved.

REQUIRES:
  In .env:
    SUPABASE_URL=https://dxrkbjftkfhlddqefmaq.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase Dashboard → Settings → API>

  WARNING: the service_role key bypasses RLS. Never commit it; keep it only
  in .env and in your hosting platform's encrypted environment variables.

SETUP:
  pip install -r requirements.txt

RUN:
  source .venv/bin/activate
  python etl/upload_source_to_supabase.py
"""

from __future__ import annotations
import os, sys, hashlib
from pathlib import Path
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT       = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
BUCKET     = "raw-uploads"
SCHOOL_NAME = "International School of Oman"

SUPABASE_URL: str = ""
SERVICE_KEY:  str = ""


def env(name, required=False, default=None):
    v = os.environ.get(name, default)
    if required and not v:
        sys.exit(f"ERROR: env var {name} is required. See header of this file.")
    return v


def get_client() -> Client:
    return create_client(SUPABASE_URL, SERVICE_KEY)


def sb_request(method, path, *, headers=None, **kwargs):
    """Storage REST call — base URL derived from SUPABASE_URL."""
    url = f"{SUPABASE_URL}/storage/v1{path}"
    h = {"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
    if headers:
        h.update(headers)
    return requests.request(method, url, headers=h, **kwargs)


def ensure_bucket(name):
    """Create the bucket if it doesn't exist. Idempotent."""
    r = sb_request("GET", f"/bucket/{name}")
    if r.status_code == 200:
        print(f"  ✓ bucket '{name}' exists")
        return
    if r.status_code == 404:
        print(f"  → creating bucket '{name}' (private)...")
        r2 = sb_request("POST", "/bucket", json={
            "id": name,
            "name": name,
            "public": False,
            "file_size_limit": 100 * 1024 * 1024,  # 100 MB
            "allowed_mime_types": None,
        })
        r2.raise_for_status()
        print(f"  ✓ bucket '{name}' created")
        return
    r.raise_for_status()


def file_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def upload_one(local_path, storage_path):
    with open(local_path, "rb") as f:
        r = sb_request(
            "POST",
            f"/object/{BUCKET}/{storage_path}",
            data=f.read(),
            headers={
                "Content-Type": "application/octet-stream",
                "x-upsert": "false",
                "Cache-Control": "3600",
            },
        )
    if r.status_code in (200, 201):
        return {"ok": True, "path": storage_path}
    return {"ok": False, "path": storage_path, "status": r.status_code, "body": r.text[:300]}


def main():
    global SUPABASE_URL, SERVICE_KEY

    load_dotenv(ROOT / ".env")

    SUPABASE_URL = env("SUPABASE_URL", required=True)
    SERVICE_KEY  = env("SUPABASE_SERVICE_ROLE_KEY", required=True)

    if not SOURCE_DIR.exists():
        sys.exit(f"ERROR: source directory {SOURCE_DIR} doesn't exist.")
    files = sorted([p for p in SOURCE_DIR.iterdir() if p.is_file() and not p.name.startswith(".")])
    if not files:
        sys.exit(f"ERROR: no files in {SOURCE_DIR}.")

    sb = get_client()

    print("→ Looking up school_id...")
    res = sb.table("schools").select("id").eq("name", SCHOOL_NAME).execute()
    if not res.data:
        sys.exit(f"ERROR: school '{SCHOOL_NAME}' not found. Run schema/005_seed_iso_pilot.sql first.")
    school_id = res.data[0]["id"]
    print(f"  school_id = {school_id}")

    print(f"→ Ensuring Storage bucket '{BUCKET}' exists...")
    ensure_bucket(BUCKET)

    print(f"→ Uploading {len(files)} file(s) from {SOURCE_DIR}...")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    results = []
    for f in files:
        sha = file_sha256(f)
        storage_path = f"{school_id}/{ts}-{f.name}"
        print(f"  ↑ {f.name} ({f.stat().st_size / 1024:.1f} KB · sha {sha[:8]})")
        result = upload_one(f, storage_path)
        result["sha256"] = sha
        result["bytes"]  = f.stat().st_size
        result["local_name"] = f.name
        results.append(result)
        if not result["ok"]:
            print(f"    ✗ FAILED status={result['status']}: {result['body']}")
        else:
            print(f"    ✓ uploaded → {BUCKET}/{result['path']}")

    n_ok = sum(1 for r in results if r["ok"])
    print(f"\n✓ {n_ok} / {len(results)} uploaded")

    if n_ok:
        print("→ Recording uploads in source_imports table...")
        import_rows = [
            {
                "school_id":   school_id,
                "filename":    r["local_name"],
                "file_sha256": r["sha256"],
                "notes":       f"storage_path: {BUCKET}/{r['path']} · {r['bytes']} bytes",
            }
            for r in results if r["ok"]
        ]
        sb.table("source_imports").insert(import_rows).execute()
        print(f"  ✓ {n_ok} source_imports row(s) added")

    print(f"\nStorage URL pattern for retrieval (server-side only, requires service_role):")
    print(f"  {SUPABASE_URL}/storage/v1/object/{BUCKET}/{{path}}")
    if results and results[0]["ok"]:
        print(f"  Example: {results[0]['path']}")


if __name__ == "__main__":
    main()
