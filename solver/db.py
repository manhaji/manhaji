"""Shared Postgres connection helper for solver scripts.

Reads the same .env the ETL uses (SUPABASE_POOLER_HOST / SUPABASE_PROJECT_REF /
SUPABASE_DB_PASSWORD) and connects via the transaction pooler. readonly=True
(the default) forces the session read-only at the Postgres level — scripts
using it cannot change data even by accident.
"""
import os
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parent.parent


def connect(readonly: bool = True):
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
    if readonly:
        conn.set_session(readonly=True, autocommit=True)
    else:
        # The postgres role has default_transaction_read_only = on (a deliberate
        # safety default so a plain connection can never write by accident).
        # Writers must explicitly opt out for their session.
        cur = conn.cursor()
        cur.execute("set session characteristics as transaction read write")
        cur.close()
        conn.commit()
    return conn
