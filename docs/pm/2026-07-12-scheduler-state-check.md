# Scheduler / Timetable Engine — State Check (read-only)

**Date:** 2026-07-12 · **Author:** backend-engineer (audit) · **Purpose:** scope Sprint-1 §S3
(admin Schedule screen on ISO's real timetable for the pilot go-live demo next week).
**Read-only:** no code or DB changed.

> **RECONCILIATION FLAG (read first).** The scheduler was also being advanced in a separate
> "Manhaj Development Session" chat that is not readable from here. **This report reflects the
> git repo only** (branch `tooling/research-agent`, latest solver commit `e0a0eb1`, 2026-07-08).
> The repo may not contain the newest scheduler work. **Elias must confirm which is authoritative
> before Monday** — if the other session produced an API layer or newer engine code, the effort
> math in §3 changes.

---

## 1. What exists & maturity

**Branch:** All the real scheduler work lives on **`tooling/research-agent`**, NOT `main`.
`main` is ~15 solver commits behind (it stops before coverage v3/v4, gen2627, the principal
dashboard, and the engineering handover). Anyone reviewing `main` would see a materially older engine.

**Engine inventory (all Python, all in `~/dev/manhaj/solver/`):**

| Component | Files | State |
|---|---|---|
| Substitution solver (absence → who covers) | `solver/core.py` (`solve()`), `solver/models.py` | Mature, TDD'd, CP-SAT |
| Data-gathering adapter (current AY 25-26) | `solver/adapter_2526.py` | Reads real `timetable_slots`, builds solve request, cross-band aware |
| Timetable builder v2 (rebuild whole school) | `solver/timetable/v2core.py`, `v2models.py` | Mature — **not needed for S3** |
| Coverage repair v3 / v4 | `solver/timetable/coverage_resolve.py`, `coverage_resolve_v4.py` | Advanced — not needed for S3 |
| 26-27 generator, benchmarks, dashboards | `gen2627.py`, `benchmark.py`, `render_*` | Research/pitch tooling — not needed for S3 |
| Postgres connector | `solver/db.py` | Read-only by default; session-pooler |

**Tests:** I ran the fast suite in the repo venv:
`.venv/bin/python -m pytest solver/tests/ -q` → **227 passed, 1 deselected (slow)** in ~48s.
(The 2026-07-07 handover recorded 177; the branch has since grown to 227 — engine is being
actively worked, tests are green.)

**Runs on real ISO data — yes, confirmed.** Two independent checks:
- Live DB (`dxrkbjftkfhlddqefmaq`, the OLD project) has the real timetable: **2,003 `timetable_slots`
  rows** (`source='human'`), **42 sections**, 105 teachers, 50 subjects, 175 bell rows — verified
  read-only via `solver/db.py`.
- `solver/dryrun_2526_last_response.json` is a **real solved substitution** for an actual absence
  ("Mohammed Saab", Monday, 5 lessons, 62 candidate teachers) — status `solved`, same-subject
  covers with scored alternatives. This is `adapter_2526.py` gathering from the live DB + `core.solve()`
  end-to-end. **The substitution engine already works on ISO's real data from the command line.**

**Bottom line:** the engine is real, tested, and proven on live data. What does not exist is any
way for the web app to reach it.

---

## 2. Integration gap — engine works as Python vs. principal sees it in the UI

Two hard gaps sit between the working engine and the demo goal.

### Gap A — There is NO service/API layer. It's pure Python + CLIs.
- Grep for `fastapi`/`uvicorn` across the repo: **nothing.** The intended runtime (per
  `docs/backend_handover_2026-07-07.md` §8 and `docs/golive_architecture_review.md`) is a
  **stateless Python FastAPI microservice** exposing `POST /solve` — **it has not been built.**
  Today the only entry points are `solve()`/`rebuild()` as library functions and the CLI adapters.
- Good news: the handover notes the functions are pure with Pydantic contracts, so "FastAPI wrapping
  is ~50 lines each." The design is done; only the wrapper and a deploy target are missing.

### Gap B — The live admin Schedule screen is 100% MOCK. It touches no real data.
- `apps/web/app/admin/schedule/page.tsx` imports `MOCK_SLOTS, MOCK_ACTIONS, MOCK_TEACHER_LOADS,
  MOCK_CURRICULUM` from `apps/web/lib/mock-schedule.ts`. Every number is hardcoded
  (e.g. "Periods this week **230**", "**41 sections**", "Subs needed **2**").
- No web-app file queries `timetable_slots` or `bell_periods` — grep across `apps/web/lib` and
  `apps/web/app` returns nothing. `mock-schedule.ts`'s own header says its shape "mirrors a **future**
  RPC return." So the real data path was always intended but never wired.
- The web app DOES point at the right DB: `apps/web/.env.local` →
  `NEXT_PUBLIC_SUPABASE_URL=https://dxrkbjftkfhlddqefmaq.supabase.co` — the same OLD project that
  holds the 2,003 real slots. So for the demo, **no DB cutover is required** (the emouawad1 cutover
  is a separate, later task and would ADD risk if pulled into this sprint).
- Web-app data-access is thin: only `apps/web/lib/supabase.ts` + `supabase-middleware.ts`. Existing
  API routes are unrelated (`chat`, `sections/save-mapping`, `calendar/feed.ics`). There is no
  schedule server action or data-access function to extend — one must be created.

**Distance in one sentence:** the engine is done; the *plumbing to the UI is entirely absent* —
no read query from the DB to the screen, and no call path from the app to the solver.

---

## 3. S3 scope recommendation (the key output)

**Full production integration is NOT realistic in ~1 week** and isn't needed for the stated goal.
Full integration means: stand up + deploy a FastAPI service, build the Next.js data-gathering side
(port `adapter_2526.py`'s queries into TypeScript), build an approval/write-back UI, and apply the
DRAFT `schema/011_substitutions.sql` for write-back. That's multi-week and drags in a live DB write
(needs Elias approval) and a hosting decision.

For a **guided demo on real data**, recommend splitting S3 into a committed core + a stretch:

### S3-core (COMMIT to this): "Show the real timetable" — read-only, no Python service
Replace the mock in the admin Schedule screen with real rows from the live DB.
- Add a server-side read (a server action or `app/api/schedule/route.ts`) that queries
  `timetable_slots` + `bell_periods` + section/teacher/subject names, scoped to ISO's school_id,
  via the existing `apps/web/lib/supabase.ts` client (respects RLS — no service role).
- Feed `TimetableGrid` and the KPI row from that instead of `MOCK_SLOTS`.
- **No Python, no FastAPI, no DB write, no DB cutover.** Pure read against a DB the app already
  connects to. **Effort: roughly 1–2 focused days** (one query + shape-map + swap the mock import;
  the component and Slot type already exist).
- Result the principal sees: the real ISO 25-26 timetable — real sections, teachers, periods — live
  in the admin UI. This is the credible, low-risk win.

### S3-stretch (attempt only if core lands early): "Run one substitute-cover"
Two viable routes, cheapest first:
1. **Precomputed / thin route (recommended for a demo):** `precompute_covers.py` already generated
   **302 cover plans** (`data/processed/tt_2526/derived/cover_plans.json`) — every teacher × day.
   For a *scripted* demo (admin picks a known absent teacher), the app can read a canned solved plan
   and render "Manhaj proposes X covers Y" with no live solver call at all. **Effort: ~1 day**,
   near-zero risk. This is the safest way to show substitution next week.
2. **Live solve (only if there's slack):** wrap `core.solve()` in the ~50-line FastAPI service,
   deploy it, and have the app POST a gathered request. This is the "real" path but needs a deployed
   service + porting the adapter's data-gathering. **Effort: ~3–5 days**, higher risk. Not advisable
   to promise for Monday.

**Recommendation:** commit S3 = **S3-core (real timetable, read-only)**. Demo the substitute-cover
via the **precomputed plan** (stretch route 1) if core finishes with time to spare. Treat the live
FastAPI solve as post-pilot. Keep the emouawad1 DB cutover out of this sprint entirely.

---

## 4. Open flags for Elias (decisions needed before Monday)

1. **Authoritative source (blocking):** confirm the git repo `tooling/research-agent` is the latest
   scheduler state, or hand over whatever the separate "Manhaj Development Session" produced. If that
   session already built an API layer, §3 effort drops.
2. **`main` is stale:** the branch, not `main`, is authoritative. Any go-live build must branch from
   `tooling/research-agent` (or it must be merged first). Flag for the team.
3. **DB target:** the demo runs on the OLD project `dxrkbjftkfhlddqefmaq` (which the app already
   targets and where the real data lives). Recommend NOT attempting the emouawad1 cutover this sprint.
4. **Any live write (substitution write-back) is out of scope** for a read-only demo and would need
   `schema/011_substitutions.sql` applied + explicit Elias approval. Keep the demo read-only.
