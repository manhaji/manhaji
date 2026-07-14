# Parent · Messages 2.4b-1 · Implementation Plan (DB schema + page refactor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace `MOCK_THREADS` with real Postgres persistence via 4 SECURITY DEFINER RPCs. Page splits into server-fetch + client UI. Seed script preserves the demo.

**Spec reference:** [`docs/superpowers/specs/2026-05-27-parent-messages-2-4b1.md`](../specs/2026-05-27-parent-messages-2-4b1.md)

**User actions after merge** (~5 min):
1. Open Supabase SQL editor → paste `schema/010_messages.sql` → run.
2. From `~/dev/manhaj`: `source .venv/bin/activate && python etl/seed_messages.py`.
3. Refresh `/parent/messages` — same 12 threads now coming from the DB.

---

## File map

**Create:**
- `schema/010_messages.sql`
- `apps/web/lib/messages.ts`
- `apps/web/app/parent/messages/MessagesClient.tsx`
- `apps/web/app/parent/messages/actions.ts`
- `etl/seed_messages.py`
- `etl/data/messages_seed.json`

**Modify:**
- `apps/web/app/parent/messages/page.tsx`

---

## Task 1 — Schema migration

**Files:**
- Create: `schema/010_messages.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Manhaj schema · 010_messages.sql
-- ============================================================================
-- WHAT THIS DOES (plain English)
-- ----------------------------------------------------------------------------
-- Adds parent-school messaging persistence. Three tables:
--   1. messages_threads   — top-level conversation envelope
--   2. thread_messages    — individual messages inside a thread
--   3. messages_audit_log — PDPL audit trail
--
-- Demo mode: SECURITY DEFINER RPCs make these anon-callable. Production
-- (post-Phase 3) will route via authenticated parent users instead.
--
-- 2.4b-1 only writes to the DB; no email delivery. 2.4b-2 will add the
-- Resend send + inbound webhook + reply-to routing on top of these tables.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists messages_threads (
    id                uuid primary key default gen_random_uuid(),
    school_id         uuid not null references schools(id),
    parent_email      text not null,
    student_id        uuid references students(id) on delete set null,
    subject           text not null,
    category          text not null check (category in ('academic','admin','finance','calendar')),
    from_label        text not null,
    last_activity_at  timestamptz not null default now(),
    unread            boolean not null default true,
    created_at        timestamptz not null default now()
);

create index if not exists idx_messages_threads_school_parent
  on messages_threads (school_id, parent_email, last_activity_at desc);

create table if not exists thread_messages (
    id          uuid primary key default gen_random_uuid(),
    thread_id   uuid not null references messages_threads(id) on delete cascade,
    ts          timestamptz not null default now(),
    role        text not null check (role in ('school','parent')),
    from_name   text not null,
    from_label  text not null,
    body        text not null,
    opened_at   timestamptz
);

create index if not exists idx_thread_messages_thread_ts
  on thread_messages (thread_id, ts);

create table if not exists messages_audit_log (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id),
    thread_id   uuid references messages_threads(id) on delete set null,
    ts          timestamptz not null default now(),
    direction   text not null check (direction in ('out_to_parent','in_from_parent','out_to_teacher_bcc','in_from_teacher')),
    from_email  text,
    to_email    text,
    template_id text,
    outcome     text not null
);

-- RLS off (gated by RPCs below)
alter table messages_threads   disable row level security;
alter table thread_messages    disable row level security;
alter table messages_audit_log disable row level security;

-- ---------------------------------------------------------------------------
-- 2. Demo identity view
-- ---------------------------------------------------------------------------
-- Maps the demo parent email to known student IDs. Production replaces
-- this with a real `parent_contacts` table (Phase 3).

create or replace view parent_child_demo as
  select
    'mahmoud.al-habsi@example.com'::text as parent_email,
    s.id as student_id,
    s.full_name as student_name
  from students s
  where s.full_name in ('Layla Al-Habsi','Omar Al-Habsi','Yasmin Al-Habsi');

grant select on parent_child_demo to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC · list threads for a parent
-- ---------------------------------------------------------------------------
create or replace function manhaj_threads_for_parent_public(
    p_school_name  text,
    p_parent_email text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_school_id uuid;
    v_result jsonb;
begin
    select id into v_school_id from schools where name = p_school_name;
    if v_school_id is null then
        return '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(t order by t.last_activity_at desc), '[]'::jsonb)
      into v_result
    from (
      select
        mt.id,
        mt.subject,
        mt.category,
        coalesce(mt.student_id::text, 'household') as child_id,
        mt.from_label,
        mt.last_activity_at,
        mt.unread,
        coalesce(
          (select jsonb_agg(
             jsonb_build_object(
               'id',         tm.id,
               'thread_id',  tm.thread_id,
               'ts',         tm.ts,
               'role',       tm.role,
               'from_name',  tm.from_name,
               'from_label', tm.from_label,
               'body',       tm.body,
               'opened_at',  tm.opened_at
             ) order by tm.ts asc
           )
           from thread_messages tm where tm.thread_id = mt.id),
          '[]'::jsonb
        ) as messages
      from messages_threads mt
      where mt.school_id = v_school_id
        and mt.parent_email = p_parent_email
    ) t;

    return v_result;
end;
$$;

grant execute on function manhaj_threads_for_parent_public(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC · append a message to an existing thread
-- ---------------------------------------------------------------------------
create or replace function manhaj_append_message_public(
    p_thread_id  uuid,
    p_role       text,
    p_from_name  text,
    p_from_label text,
    p_body       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new_id    uuid;
    v_school_id uuid;
begin
    if p_role not in ('school','parent') then
        raise exception 'invalid role: %', p_role;
    end if;

    select school_id into v_school_id from messages_threads where id = p_thread_id;
    if v_school_id is null then
        raise exception 'unknown thread: %', p_thread_id;
    end if;

    insert into thread_messages (thread_id, role, from_name, from_label, body)
      values (p_thread_id, p_role, p_from_name, p_from_label, p_body)
      returning id into v_new_id;

    update messages_threads
       set last_activity_at = now(),
           unread = case when p_role = 'school' then true else unread end
     where id = p_thread_id;

    insert into messages_audit_log (school_id, thread_id, direction, outcome)
      values (v_school_id, p_thread_id,
              case when p_role = 'school' then 'out_to_parent' else 'in_from_parent' end,
              'queued');

    return v_new_id;
end;
$$;

grant execute on function manhaj_append_message_public(uuid, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC · create a new thread + initial message
-- ---------------------------------------------------------------------------
create or replace function manhaj_create_thread_public(
    p_school_name  text,
    p_parent_email text,
    p_student_id   uuid,
    p_category     text,
    p_subject      text,
    p_from_name    text,
    p_from_label   text,
    p_body         text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_school_id  uuid;
    v_thread_id  uuid;
begin
    if p_category not in ('academic','admin','finance','calendar') then
        raise exception 'invalid category: %', p_category;
    end if;

    select id into v_school_id from schools where name = p_school_name;
    if v_school_id is null then
        raise exception 'unknown school: %', p_school_name;
    end if;

    insert into messages_threads (
        school_id, parent_email, student_id, subject, category, from_label,
        unread, last_activity_at
    ) values (
        v_school_id, p_parent_email, p_student_id, p_subject, p_category, p_from_label,
        false,      -- a thread parent just opened isn't unread for themselves
        now()
    ) returning id into v_thread_id;

    insert into thread_messages (thread_id, role, from_name, from_label, body)
      values (v_thread_id, 'parent', p_from_name, p_from_label, p_body);

    insert into messages_audit_log (school_id, thread_id, direction, outcome)
      values (v_school_id, v_thread_id, 'in_from_parent', 'queued');

    return v_thread_id;
end;
$$;

grant execute on function manhaj_create_thread_public(text, text, uuid, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC · mark a thread as read
-- ---------------------------------------------------------------------------
create or replace function manhaj_mark_thread_read_public(
    p_thread_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update messages_threads
       set unread = false
     where id = p_thread_id;
end;
$$;

grant execute on function manhaj_mark_thread_read_public(uuid) to anon, authenticated;

comment on table messages_threads   is 'Parent–school conversation envelopes. Demo phase: SECURITY DEFINER RPCs gate access.';
comment on table thread_messages    is 'Individual messages inside a thread. Multi-role (school | parent).';
comment on table messages_audit_log is 'PDPL audit trail · every send + reply + bounce row-stamped here.';
```

- [ ] **Step 2: Commit (don't run the migration yet — the user runs it after merge)**

```bash
cd ~/dev/manhaj && git add schema/010_messages.sql && git commit -m "schema/010: messages_threads + thread_messages + messages_audit_log + 4 RPCs"
```

---

## Task 2 — `lib/messages.ts` server-side wrappers

**Files:**
- Create: `apps/web/lib/messages.ts`

- [ ] **Step 1: Write the wrapper**

```ts
/**
 * Server-side wrappers for the messages RPCs in schema/010.
 *
 * All four functions return the same shapes as lib/mock-messages.ts so the
 * UI components don't need re-typing. On error the wrapper logs + returns
 * a safe fallback (empty list / no-op).
 */

import { serverClient } from "./supabase";
import type { Thread, MessageCategory } from "./mock-messages";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";
const DEMO_PARENT_EMAIL = "mahmoud.al-habsi@example.com";

export type NewThreadPayload = {
  student_id:  string | null;   // null for household
  category:    MessageCategory;
  subject:     string;
  from_name:   string;
  from_label:  string;
  body:        string;
};

/** Fetch threads + nested messages for the (demo) parent. */
export async function listThreadsForParent(
  parentEmail: string = DEMO_PARENT_EMAIL,
): Promise<Thread[]> {
  const sb = await serverClient();
  const { data, error } = await sb.rpc("manhaj_threads_for_parent_public", {
    p_school_name:  SCHOOL_NAME,
    p_parent_email: parentEmail,
  });
  if (error) {
    console.error("[messages] listThreadsForParent failed:", error);
    return [];
  }
  return (data as Thread[]) ?? [];
}

/** Append a parent reply to an existing thread. Returns the new message id. */
export async function createReply(
  threadId: string,
  body:     string,
  parentName: string = "Mr Al-Habsi",
): Promise<string | null> {
  const sb = await serverClient();
  const { data, error } = await sb.rpc("manhaj_append_message_public", {
    p_thread_id:  threadId,
    p_role:       "parent",
    p_from_name:  parentName,
    p_from_label: "Parent",
    p_body:       body,
  });
  if (error) {
    console.error("[messages] createReply failed:", error);
    return null;
  }
  return (data as string) ?? null;
}

/** Create a brand-new thread + initial parent message. Returns the new thread id. */
export async function createThread(
  payload:    NewThreadPayload,
  parentEmail: string = DEMO_PARENT_EMAIL,
): Promise<string | null> {
  const sb = await serverClient();
  const { data, error } = await sb.rpc("manhaj_create_thread_public", {
    p_school_name:  SCHOOL_NAME,
    p_parent_email: parentEmail,
    p_student_id:   payload.student_id,
    p_category:     payload.category,
    p_subject:      payload.subject,
    p_from_name:    payload.from_name,
    p_from_label:   payload.from_label,
    p_body:         payload.body,
  });
  if (error) {
    console.error("[messages] createThread failed:", error);
    return null;
  }
  return (data as string) ?? null;
}

/** Clear the unread flag on a thread. */
export async function markThreadRead(threadId: string): Promise<void> {
  const sb = await serverClient();
  const { error } = await sb.rpc("manhaj_mark_thread_read_public", {
    p_thread_id: threadId,
  });
  if (error) {
    console.error("[messages] markThreadRead failed:", error);
  }
}
```

- [ ] **Step 2: Verify tsc clean**

```bash
cd ~/dev/manhaj/apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd ~/dev/manhaj && git add apps/web/lib/messages.ts && git commit -m "lib/messages: server-side RPC wrappers (list / reply / create / markRead)"
```

---

## Task 3 — Python seed script + JSON data file

**Files:**
- Create: `etl/data/messages_seed.json`
- Create: `etl/seed_messages.py`

- [ ] **Step 1: Write `etl/data/messages_seed.json`** — the 12 threads mirroring `mock-messages.ts`. Each thread:

```json
[
  {
    "id_hint": "t1",
    "subject": "Layla — three things from April",
    "category": "academic",
    "student_name": "Layla Al-Habsi",
    "from_label": "Ms Sandra Swart · Student Advisor",
    "unread": true,
    "messages": [
      {
        "ts": "2026-05-14T09:14:00Z",
        "role": "school",
        "from_name": "Ms Sandra Swart",
        "from_label": "Student Advisor · 10A",
        "body": "Dear Mr Al-Habsi,\n\nJust sharing Layla's April highlights..."
      },
      {
        "ts": "2026-05-14T11:32:00Z",
        "role": "parent",
        "from_name": "Mr Al-Habsi",
        "from_label": "Parent",
        "body": "Dear Ms Swart,\n\nThank you for the lovely note...",
        "opened_at": "2026-05-14T12:08:00Z"
      },
      { "ts": "2026-05-14T12:08:00Z", "role": "school", "from_name": "Ms Sandra Swart", "from_label": "Student Advisor · 10A · via Outlook", "body": "Of course — how about Wed 22 May at 09:30?..." }
    ]
  },
  ... 11 more threads ...
]
```

The full content mirrors `lib/mock-messages.ts` exactly. The implementer pastes the same 12 thread bodies into JSON form. `student_name` is "household" for the 4 household threads.

For brevity in this plan, only the structural template is shown — the implementer copies each thread body literally from `mock-messages.ts` (the bodies are in there verbatim).

- [ ] **Step 2: Write `etl/seed_messages.py`**

```python
#!/usr/bin/env python3
"""
Seed messages_threads + thread_messages with the demo fixtures.

WHAT THIS DOES (plain English):
  Reads etl/data/messages_seed.json (12 threads, mirror of apps/web/lib/
  mock-messages.ts), connects to Supabase Postgres, truncates the existing
  message tables, and inserts the demo threads + messages.

  After this runs, /parent/messages shows the same 12 threads that the
  2.4a mock fixture showed — but now they're persisted in Postgres.

  Re-runnable. Truncates first, so always lands in the same end state.

SETUP (one-time, ~2 min):
  cd ~/dev/manhaj
  source .venv/bin/activate    # or: python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt   # if not done already

  # Env (set once in ~/.env or via direnv):
  #   SUPABASE_DB_HOST=...
  #   SUPABASE_DB_USER=...
  #   SUPABASE_DB_PASSWORD=...
  #   SUPABASE_DB_NAME=postgres

  python etl/seed_messages.py
"""

import json
import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "etl" / "data" / "messages_seed.json"

SCHOOL_NAME      = os.getenv("MANHAJ_SCHOOL_NAME", "International School of Oman")
DEMO_PARENT_EMAIL = "mahmoud.al-habsi@example.com"

REQUIRED_ENV = ["SUPABASE_DB_HOST", "SUPABASE_DB_USER", "SUPABASE_DB_PASSWORD"]

def env_or_die(key: str) -> str:
    v = os.getenv(key)
    if not v:
        sys.exit(f"Missing required env var: {key}. See script header for setup.")
    return v

def connect():
    return psycopg2.connect(
        host     = env_or_die("SUPABASE_DB_HOST"),
        user     = env_or_die("SUPABASE_DB_USER"),
        password = env_or_die("SUPABASE_DB_PASSWORD"),
        dbname   = os.getenv("SUPABASE_DB_NAME", "postgres"),
        port     = int(os.getenv("SUPABASE_DB_PORT", "5432")),
        sslmode  = "require",
    )

def load_seed() -> list[dict]:
    if not SEED_PATH.exists():
        sys.exit(f"Seed file not found at {SEED_PATH}")
    with SEED_PATH.open() as f:
        return json.load(f)

def main():
    threads = load_seed()
    print(f"Loaded {len(threads)} threads from {SEED_PATH}")

    with connect() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # School + student id lookup
            cur.execute("select id from schools where name = %s", (SCHOOL_NAME,))
            row = cur.fetchone()
            if not row:
                sys.exit(f"Unknown school: {SCHOOL_NAME}")
            school_id = row["id"]

            cur.execute(
                "select id, full_name from students where school_id = %s and full_name = any(%s)",
                (school_id, ["Layla Al-Habsi", "Omar Al-Habsi", "Yasmin Al-Habsi"]),
            )
            students = {r["full_name"]: r["id"] for r in cur.fetchall()}
            for name in ["Layla Al-Habsi", "Omar Al-Habsi", "Yasmin Al-Habsi"]:
                if name not in students:
                    print(f"WARN: student '{name}' not seeded in DB — household-only fallback OK, single-child threads will skip.")

            # Truncate existing rows (re-runnable)
            print("Truncating messages tables...")
            cur.execute("truncate messages_threads, thread_messages, messages_audit_log cascade;")

            inserted_threads = 0
            inserted_messages = 0

            for t in threads:
                student_name = t.get("student_name")
                student_id = students.get(student_name) if student_name and student_name != "household" else None

                # If the seed expects a student but the student doesn't exist in DB, skip the thread
                if student_name and student_name != "household" and student_id is None:
                    print(f"  SKIP thread '{t['subject']}' (no student row for {student_name})")
                    continue

                cur.execute(
                    """
                    insert into messages_threads
                      (school_id, parent_email, student_id, subject, category, from_label,
                       unread, last_activity_at)
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    returning id
                    """,
                    (
                        school_id, DEMO_PARENT_EMAIL, student_id,
                        t["subject"], t["category"], t["from_label"],
                        t.get("unread", False),
                        t["messages"][-1]["ts"],   # set last_activity_at to the most recent message
                    ),
                )
                thread_id = cur.fetchone()["id"]
                inserted_threads += 1

                for m in t["messages"]:
                    cur.execute(
                        """
                        insert into thread_messages
                          (thread_id, ts, role, from_name, from_label, body, opened_at)
                        values (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            thread_id, m["ts"], m["role"],
                            m["from_name"], m["from_label"], m["body"],
                            m.get("opened_at"),
                        ),
                    )
                    inserted_messages += 1

        conn.commit()

    print(f"Seeded {inserted_threads} threads, {inserted_messages} messages.")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit (don't run yet — user runs after merge)**

```bash
cd ~/dev/manhaj && git add etl/data/messages_seed.json etl/seed_messages.py && git commit -m "etl/seed_messages: idempotent loader for the 12 demo threads"
```

---

## Task 4 — Page refactor (server fetch + MessagesClient + actions)

**Files:**
- Modify: `apps/web/app/parent/messages/page.tsx`
- Create: `apps/web/app/parent/messages/MessagesClient.tsx`
- Create: `apps/web/app/parent/messages/actions.ts`

- [ ] **Step 1: Read the existing `page.tsx`** — copy ALL the code into a new file `MessagesClient.tsx` (rename the function, take `initialThreads` as a prop).

- [ ] **Step 2: Write `MessagesClient.tsx`** — verbatim copy of the existing `page.tsx`, with these changes:
  - Add `"use client";` at the top (was already there).
  - Rename `export default function ParentMessagesPage()` to `export default function MessagesClient({ initialThreads }: { initialThreads: Thread[] })`.
  - Replace `import { MOCK_THREADS, ... } from "@/lib/mock-messages"` with `import { categoryCounts, threadsForChild, type MessageCategory, type Thread } from "@/lib/mock-messages"` (drop the `MOCK_THREADS` import).
  - Replace `MOCK_THREADS` references with `initialThreads`.
  - Replace the existing `console.log` action handlers with calls to server actions:
    ```ts
    import { sendReplyAction, createThreadAction, markThreadReadAction } from "./actions";

    function onSelectThread(id: string) {
      setActiveThreadId(id);
      setMobileShowThread(true);
      // Mark read on the server; UI updates via revalidatePath.
      const thread = initialThreads.find(t => t.id === id);
      if (thread?.unread) {
        markThreadReadAction(id).catch(err => console.error(err));
      }
    }

    async function onReplySend(body: string) {
      if (!activeThreadId) return;
      await sendReplyAction(activeThreadId, body);
    }

    async function onNewMessageSend(payload: NewMessagePayload) {
      // Map the recipient ID to a from_name/from_label pair for the seed.
      // For 2.4b-1 we just store the parent's outgoing message; teacher fan-out
      // is 2.4b-2 territory.
      const recipient = MESSAGE_RECIPIENTS.find(r => r.id === payload.to);
      await createThreadAction({
        student_id: payload.child_id === "household" ? null : payload.child_id,
        category:   "admin",    // 2.4b-1 default; UX picker for category is a Phase 3 nicety
        subject:    payload.subject,
        from_name:  "Mr Al-Habsi",
        from_label: `Parent → ${recipient?.name ?? payload.to}`,
        body:       payload.body,
      });
    }
    ```
  - Add the necessary import: `import { MESSAGE_RECIPIENTS, type Thread } from "@/lib/mock-messages";` (kept, since the recipients list still drives the compose modal).
  - Add `import type { NewMessagePayload } from "./components/NewMessageComposer";`.

- [ ] **Step 3: Replace `apps/web/app/parent/messages/page.tsx`** with the server-component thin wrapper:

```tsx
/**
 * Parent · Messages tab.
 *
 * Server component. Fetches threads from Postgres via lib/messages.ts and
 * hands them to <MessagesClient /> (a client component that owns the
 * interactive state). After any mutation (reply / compose / mark-read),
 * the server action calls revalidatePath which re-runs this fetch.
 */

import { listThreadsForParent } from "@/lib/messages";
import MessagesClient from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function ParentMessagesPage() {
  const threads = await listThreadsForParent();
  return <MessagesClient initialThreads={threads} />;
}
```

- [ ] **Step 4: Create `apps/web/app/parent/messages/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import {
  createReply, createThread, markThreadRead, type NewThreadPayload,
} from "@/lib/messages";

export async function sendReplyAction(threadId: string, body: string) {
  const newId = await createReply(threadId, body);
  revalidatePath("/parent/messages");
  return newId;
}

export async function createThreadAction(payload: NewThreadPayload) {
  const newId = await createThread(payload);
  revalidatePath("/parent/messages");
  return newId;
}

export async function markThreadReadAction(threadId: string) {
  await markThreadRead(threadId);
  revalidatePath("/parent/messages");
}
```

- [ ] **Step 5: Verify**

```bash
cd ~/dev/manhaj/apps/web && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -10
```

Build green. Lint clean. tsc clean.

Note on visual smoke: the page will now show an **empty inbox** because the migration + seed haven't been applied to the running database. That's the expected behaviour for 2.4b-1 per the spec — the user runs the migration + seed after merge.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/manhaj && git add apps/web/app/parent/messages/page.tsx apps/web/app/parent/messages/MessagesClient.tsx apps/web/app/parent/messages/actions.ts && git commit -m "/parent/messages: server fetch + MessagesClient split + server actions"
```

---

## Task 5 — Verification + push + memory + user-action checklist

- [ ] **Step 1: Full test + lint + build**

```bash
cd ~/dev/manhaj/apps/web && npm test && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -10
```

All clean. 70/70 tests (no new tests this PR — pure plumbing).

- [ ] **Step 2: Push**

```bash
cd ~/dev/manhaj && git push origin main
```

- [ ] **Step 3: Update memory** at `~/.claude/projects/.../memory/project_school_ops_decisions.md` with the new entry including the user-action checklist:

```markdown
## 2026-05-27 — Phase 2.4b-1 shipped · Messages DB persistence

- **Spec:** docs/superpowers/specs/2026-05-27-parent-messages-2-4b1.md
- **Plan:** docs/superpowers/plans/2026-05-27-parent-messages-2-4b1.md
- **Pushed:** ...
- ...

### Required user actions (one-time, ~5 min)

1. **Apply the migration.** Open Supabase SQL editor →
   <https://supabase.com/dashboard/project/qntmzazndkcdgkwmrhae/sql/new>
   Paste the contents of `schema/010_messages.sql` → Run.

2. **Seed the demo threads.** From `~/dev/manhaj`:
   ```bash
   source .venv/bin/activate
   python etl/seed_messages.py
   ```
   Expected: "Seeded 12 threads, 18 messages."

3. **Verify in browser.** Refresh /parent/messages — same 12 threads, now reactive (replies + new messages persist).

### What stays mock
- `lib/mock-messages.ts` retained for tests + the seed script source.
- `lib/messages.ts` page now uses real DB.
```

---

## Self-review

| Spec section | Plan task |
|---|---|
| §5 schema | Task 1 |
| §6 RPCs | Task 1 |
| §9 lib/messages.ts | Task 2 |
| §11 seed script | Task 3 |
| §10 page refactor | Task 4 |
| §12 acceptance criteria | Task 5 |

Type consistency: `Thread`, `MessageCategory`, `NewThreadPayload` shared between `lib/mock-messages.ts` and `lib/messages.ts`. Server / client component boundaries explicit. Empty-inbox fallback documented. Migration is purely additive.
