# Manhaji DB Cutover Runbook — OLD → MIGRATED

**Date drafted:** 2026-07-10
**Status:** PLAN ONLY. Nothing here has been executed. Every step that touches a live
database, a live website, or an env file is **approval-gated** — it happens only after
Elias says "yes" to that specific step.

---

## Plain-language overview (read this first)

Manhaji's data lives in a Supabase database. There are currently **two copies**:

| Nickname | Supabase project ref | Account | Role today |
|----------|---------------------|---------|------------|
| **OLD** | `dxrkbjftkfhlddqefmaq` | emouawad2 | The one the live app is talking to **right now** |
| **MIGRATED** | `qntmzazndkcdgkwmrhae` | emouawad1 | An exact copy we want to switch the app over to |

The hard part (copying schema + data + user logins) was already done on 2026-07-05, and
today's audit confirmed **both copies are still byte-for-byte identical** (same row counts
on all 68 tables, security fully on). So this runbook is **not** a data migration — it's the
much smaller job of **pointing the app at the new copy, checking it works, then retiring the
old one safely.**

Think of it like moving house when all the furniture is already in the new place. All that's
left is to change the address on file and forward the mail.

### The one nuance that matters: there are TWO things pointing at the OLD database

1. **The live public website** — `manhaji-bay.vercel.app`. This is hosted on the **external
   developer's** Vercel account, not Elias's. Its database address is set in **the developer's
   Vercel dashboard**. Changing it is what actually flips the live site. **The developer does
   this** (or Elias, only if he has login access to that Vercel project).

2. **Elias's own code repository** (`~/dev/manhaj/…`) — a few text files (`.env`) that local
   scripts and any future deploy read. These are separate and simpler; an agent can update
   them on a branch for review.

Both must be updated, but they are **independent** — changing one does not change the other.

### Who does what — legend used throughout

- **[ELIAS-DASH]** = Elias, clicking in a web dashboard (Supabase or Vercel). Non-technical,
  point-and-click.
- **[DEVELOPER]** = the external developer, in their own Vercel project.
- **[AGENT]** = an AI agent, only after Elias approves that exact step. Read-only checks and
  editing repo text files on a branch are the only things an agent does. **An agent never
  changes a live database or a live website.**

---

## Step 0 — What you need in hand before starting

[ELIAS-DASH] Collect these three values from the **MIGRATED** project's Supabase dashboard.
They are **secrets that are NOT in the repo** and must be copied fresh:

1. Open https://supabase.com/dashboard → sign in to the **emouawad1** account → open the
   project `qntmzazndkcdgkwmrhae`.
2. Go to **Settings → API**.
3. Copy these three items into a password manager or a secure note (never paste them into
   chat):
   - **Project URL** — will read `https://qntmzazndkcdgkwmrhae.supabase.co`
   - **Publishable / anon key** — the browser-safe key (starts `sb_publishable_…`)
   - **service_role / secret key** — the server-only key (starts `sb_secret_…`); click
     "Reveal" to see it. This one bypasses all security — treat it like a master password.

You will also need, already known:
- MIGRATED DB password: `<DB_PASSWORD — from Supabase dashboard, not stored here>`
- MIGRATED session pooler host: `aws-1-ap-south-1.pooler.supabase.com:5432`
- MIGRATED pooler user: `postgres.qntmzazndkcdgkwmrhae`

> **Why fresh from the dashboard?** The anon and service_role keys are unique to each
> Supabase project. The OLD keys in the repo will NOT work against the MIGRATED database.

---

## Step 1 — Pre-cutover checks (read-only, safe)

Nothing here changes anything. An agent can run all of it after approval.

### 1a. Re-confirm the two databases are still identical (guard against drift)

[AGENT, read-only] Connect to **both** databases with read-only transactions and compare
row counts on all 68 tables, exactly as today's audit did. Command pattern (run once per DB):

```
set session characteristics as transaction read only;
```

then count rows per table and diff the two results.

- **If every table matches** → good, proceed.
- **If any table differs** → the OLD copy has received writes since 2026-07-05. STOP and go
  to **Step 2 (optional delta re-sync)** before continuing. Report the exact tables + row
  deltas to Elias.

> Plain language: we're making sure nobody added or changed data in the old copy since we
> took the snapshot. Because this is a low-traffic demo with essentially no live users
> writing data, drift is very unlikely — but we check anyway because it's free and it's the
> one thing that could cause silent data loss.

### 1b. Confirm the JWT auth hook is registered on the MIGRATED project

The app's security depends on a hook called **`add_school_id_to_jwt`**. In plain terms: when
a user logs in, this hook stamps their `school_id` onto their login token, and the database's
row-security rules use that stamp to show each user only their own school's data. If the hook
is missing, users log in but see **no data** (or an error).

It was reportedly registered and verified on the MIGRATED project on 2026-07-05. Re-verify:

- **[AGENT, read-only]** Query the auth hook configuration / the function definition on
  `qntmzazndkcdgkwmrhae` to confirm the `add_school_id_to_jwt` function exists. (The
  function lives in `schema/007_jwt_rls_no_service_role.sql` in the repo for reference.)
- **[ELIAS-DASH]** Confirm the hook is actually *wired up* (a function existing is not the
  same as it being switched on): open the MIGRATED project → **Authentication → Hooks
  (Auth Hooks)** → confirm **"Customize Access Token (JWT) Claims"** is enabled and points
  at `add_school_id_to_jwt`.

**If the hook is NOT enabled** — this is a required **[ELIAS-DASH]** step:
1. MIGRATED project → **Authentication → Hooks**.
2. Under "Customize Access Token (JWT) Claims hook", choose the Postgres function
   `add_school_id_to_jwt` and **Enable**.
3. Save. (No data changes — this only affects future logins.)

> The definitive proof that this works comes later in **Step 4**, when we actually log in on
> the cut-over site and see real data appear. This check is the pre-flight version.

### 1c. Write down exactly which settings change and where they live

There are **five** places the database address is configured. Know all five before you touch
any:

| # | Location | Who owns it | What changes | Notes |
|---|----------|-------------|--------------|-------|
| 1 | `~/dev/manhaj/apps/web/.env.local` | Elias's repo | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | [AGENT] on a branch |
| 2 | `~/dev/manhaj/.env` (root) | Elias's repo | `SUPABASE_PROJECT_REF`, `SUPABASE_POOLER_HOST`, `SUPABASE_DB_PASSWORD` | [AGENT] on a branch |
| 3 | `~/dev/manhaj/.env.example` | Elias's repo | example values / the `dxrkbjftkfhlddqefmaq` reference in comments | [AGENT] on a branch; example only, no secrets |
| 4 | **Developer's Vercel project** env vars | DEVELOPER | same three as row 1 | **[DEVELOPER]** — this is the one that flips the LIVE site |
| 5 | GitHub Actions secrets (if any CI uses the DB) | Elias's repo settings | any `SUPABASE_*` secrets | [ELIAS-DASH]; check Settings → Secrets → Actions first |

> **[AGENT] to verify before the switch:** grep the repo for any other hardcoded
> `dxrkbjftkfhlddqefmaq` occurrences and check GitHub → repo Settings → Secrets and variables
> → Actions to see whether any workflow references the OLD ref. Report the full list so
> nothing is missed.

---

## Step 2 — Freeze to prevent drift (and optional re-sync)

**Real risk level: very low.** This is a demo with no real parents/staff writing data day to
day. A hard "maintenance mode" is likely overkill. Choose based on Step 1a's result:

- **If Step 1a showed the DBs identical** → no freeze needed. The gap between the check and
  the switch is minutes, and there are no active writers. Proceed to Step 3.
- **If you want belt-and-braces** → [ELIAS-DASH] avoid using the live site during the switch
  window, and tell the developer not to run any data jobs. That's the whole "freeze" for a
  demo of this size.

**Optional final delta re-sync (only if Step 1a found drift):**
- [AGENT, after approval — this is the one live-write exception and needs an explicit yes]
  Export only the changed rows from OLD and apply them to MIGRATED, then re-run Step 1a to
  confirm parity. Show Elias the exact rows before applying. If drift is complex, prefer a
  fresh full re-copy over a hand-patched delta.

---

## Step 3 — The switch (repoint the app)

### 3a. [DEVELOPER] Update the LIVE site (this is the real cutover)

In the **developer's Vercel project** that deploys `manhaji-bay.vercel.app`:

1. Go to **Project → Settings → Environment Variables** (Production scope).
2. Set these three to the **MIGRATED** values from Step 0:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://qntmzazndkcdgkwmrhae.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = *(emouawad1 publishable/anon key)*
   - `SUPABASE_SERVICE_ROLE_KEY` = *(emouawad1 service_role secret key)*
3. Save. **Do not redeploy yet** — redeploy is Step 4a, done deliberately so the verification
   is clean.

> If Elias has access to this Vercel project himself, he can do this as an [ELIAS-DASH] step
> instead. Either way it is a dashboard change, never an agent change.

### 3b. [AGENT] Update Elias's repo `.env` files (on a branch, for review)

On a branch named like `pm/db-cutover-repoint` (never `main`):

- **`apps/web/.env.local`**
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://qntmzazndkcdgkwmrhae.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → emouawad1 publishable key
  - `SUPABASE_SERVICE_ROLE_KEY` → emouawad1 service_role key
- **`.env` (root)**
  - `SUPABASE_PROJECT_REF` → `qntmzazndkcdgkwmrhae`
  - `SUPABASE_POOLER_HOST` → `aws-1-ap-south-1.pooler.supabase.com`
  - `SUPABASE_DB_PASSWORD` → `<DB_PASSWORD — from Supabase dashboard, not stored here>`
- **`.env.example`**
  - Update the example `dxrkbjftkfhlddqefmaq` references in comments to the new ref, keeping
    it example-only (no real secrets committed).

> Note: `.env.local` and `.env` are gitignored, so the *values* are not committed — but the
> agent still makes the edits on a branch and opens a PR so the change is auditable and Elias
> confirms before local scripts start pointing at the new DB. **Elias applies/merges; the
> agent does not.**

### 3c. [ELIAS-DASH] GitHub Actions (only if Step 1c found any)

If any workflow references the OLD ref or its secrets, update those secrets in
repo Settings → Secrets and variables → Actions to the MIGRATED values.

---

## Step 4 — Verify after the switch

### 4a. [DEVELOPER] Redeploy the live site

Trigger a fresh Production deployment in the developer's Vercel so the new env values take
effect. (Env changes only apply to new deployments.)

### 4b. [ELIAS-DASH] Log in as each of the 4 personas and confirm real data appears

This is the true proof that the login → security → data chain works on the MIGRATED database.
The app's roles are **principal, teacher, finance, admin** (defined in
`schema/007_jwt_rls_no_service_role.sql`).

For **each** of the four persona logins on `manhaji-bay.vercel.app`:
1. Log in.
2. Confirm you land on the dashboard **and see real school data** (students, timetable,
   messages — not empty tables, not an error).
3. Confirm you see **only** the correct school's data (tenant isolation intact).

- **All four show real, correctly-scoped data** → the cutover succeeded. The JWT hook and
  row-security are working on MIGRATED.
- **Login works but data is empty or errors** → almost certainly the JWT hook (Step 1b) is
  not enabled on MIGRATED. Enable it, re-login. If still broken → **Rollback (Step 6).**

> [AGENT, read-only] can additionally query MIGRATED to confirm each persona's `school_id`
> row exists in the profile/mapping table, but the human login test is the acceptance gate.

---

## Step 5 — Retire the OLD copy safely (do NOT delete)

Once Step 4 passes, the OLD database is no longer serving the app — but **do not delete it.**

1. **Soak period — keep OLD as a read-only backup for 14 days** (recommended). During this
   window the MIGRATED DB is the sole source of truth for the live site; OLD is a safety net
   in case a subtle issue surfaces days later.
2. [ELIAS-DASH] Optionally, to guarantee OLD receives no accidental writes during the soak,
   leave it running but simply do not point anything at it (already true after Step 3). No
   need to actively lock it for a demo.
3. **After the soak, if no issues:** [ELIAS-DASH] in the emouawad2 account, **pause** the OLD
   project (Supabase Dashboard → project `dxrkbjftkfhlddqefmaq` → Settings → **Pause project**).
   Pausing keeps the data recoverable but stops it running. Only consider full deletion much
   later, once a separate independent backup exists.
4. **Decommission note** (write into the decisions log / this file's changelog when done):

   > *YYYY-MM-DD — Manhaji live site (`manhaji-bay.vercel.app`) cut over from OLD
   > `dxrkbjftkfhlddqefmaq` (emouawad2) to MIGRATED `qntmzazndkcdgkwmrhae` (emouawad1). All 4
   > personas verified with real, tenant-scoped data. OLD retained read-only as backup until
   > YYYY-MM-DD, then paused. Rollback instructions in
   > docs/pm/2026-07-10-db-cutover-runbook.md.*

---

## Step 6 — Rollback plan (if anything breaks post-switch)

Because OLD is untouched and still fully intact, rollback is just "change the address back."

1. **[DEVELOPER]** In the developer's Vercel project, set the three env vars back to the
   **OLD** values:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://dxrkbjftkfhlddqefmaq.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `<SUPABASE_PUBLISHABLE_KEY — from .env / dashboard>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<SUPABASE_SERVICE_ROLE_KEY — from .env / dashboard, not stored here>`
   *(These OLD values are the current repo values, preserved here for rollback.)*
2. **[DEVELOPER]** Redeploy Production.
3. **[ELIAS-DASH]** Re-test one persona login to confirm the site is healthy on OLD again.
4. **[AGENT]** Revert the repo `.env` branch (or don't merge it) so local files still point at
   OLD.
5. Diagnose the MIGRATED-side issue (most likely the JWT hook, Step 1b) before re-attempting.

**Rollback is safe and low-cost precisely because we did NOT delete or alter the OLD copy.**
That is the whole reason Step 5 forbids early deletion.

---

## One-page checklist

- [ ] **[ELIAS-DASH]** Step 0 — copy MIGRATED URL + anon key + service_role key from
      Supabase Settings → API.
- [ ] **[AGENT]** Step 1a — read-only row-count parity check on both DBs.
- [ ] **[AGENT + ELIAS-DASH]** Step 1b — confirm `add_school_id_to_jwt` hook enabled on
      MIGRATED (enable if not).
- [ ] **[AGENT + ELIAS-DASH]** Step 1c — list all 5 env locations; check GitHub Actions +
      grep repo for OLD ref.
- [ ] Step 2 — freeze only if drift found (unlikely); optional approved delta re-sync.
- [ ] **[DEVELOPER]** Step 3a — set MIGRATED env vars in developer's Vercel (the live flip).
- [ ] **[AGENT]** Step 3b — repoint repo `.env` files on a branch → PR.
- [ ] **[ELIAS-DASH]** Step 3c — update GitHub Actions secrets if any.
- [ ] **[DEVELOPER]** Step 4a — redeploy Production.
- [ ] **[ELIAS-DASH]** Step 4b — log in as principal, teacher, finance, admin; confirm real,
      correctly-scoped data.
- [ ] **[ELIAS-DASH]** Step 5 — keep OLD read-only 14 days, then pause; write decommission
      note.
- [ ] Step 6 — rollback ready if needed (repoint dev Vercel back to OLD, redeploy, retest).

**Approval gates:** every [DEVELOPER] and [ELIAS-DASH] step, and the single optional
approved-write re-sync in Step 2, require an explicit "yes" before running. Agents do
read-only checks and branch/PR edits only.
