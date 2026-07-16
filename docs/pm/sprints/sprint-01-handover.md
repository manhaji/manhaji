# Sprint 1 — Merge Handover (for Karim)

**Branch:** `sprint-1` → **`main`** · **Prepared by:** Manhaji PM (AI) · **Date:** 2026-07-14
**Goal of the sprint:** a credible **guided demo on ISO real data** for the pilot — core screens
work and show real data, nothing reads as broken, and everything not-yet-real is clearly labelled.

This doc explains **everything the sprint did** so you can approve the merge with full context. It
covers work already merged (for the whole picture) and the work in *this* PR.

---

## How this sprint was run (new workflow)
All sprint work lands on **one integration branch** (`sprint-1`); specialists worked on short-lived
task branches that the PM integrated here. **This is the only PR** — one sprint, one review for you,
instead of a PR per task. Going forward every sprint works this way.

---

## A. Already merged into `main` (context — NOT in this PR)
These landed as separate PRs earlier today (#5, #6, #8, #9) and are already in `main`:
- **#5 — Solver + PM tooling import.** Brought the CP-SAT timetable/substitution engine (`solver/`),
  the precomputed cover plans, and the PM agent tooling (`.claude/`, `docs/pm/`) into the repo.
- **#6 — Route-prefix 404 fix (S1.1).** Dashboard/Input cards and client `/api` calls (`/api/chat`,
  `/api/sections/save-mapping`) were missing the `/admin`·`/student` prefix and 404'd on the portal.
- **#8 — Dead controls → "Phase 2" preview (S1.2).** Upload, Send-batch, Open-profile, Message-parent
  were disabled/no-ops; now visibly labelled preview so nothing looks broken.
- **#9 — Mock-data consistency (S1.3).** Reconciled Ms Swart to her real History/Geography/MUN
  identity and Layla to Grade 10 across the demo fixtures; fixed two garbled copy strings.

---

## B. In THIS PR (`sprint-1` → `main`)

### B1. PM tooling correction (`.claude/`, `docs/pm/board.json`)
The `.claude` copies imported in #5 predated later fixes. This syncs the corrected definitions:
the agent domain is the **monorepo** (`apps/{admin,…}` + `packages/`, there is no `apps/web`), an
**artifact-hygiene** rule (never commit build outputs/caches; the PM re-audits), and the **single
sprint-branch workflow**. Docs-only / tooling — no app impact.

### B2. Hygiene — stop tracking `next-env.d.ts` + sibling-comparison fix
- **`next-env.d.ts` untracked** (`.gitignore` += `**/next-env.d.ts`; `git rm --cached` on all 5 apps).
  These are Next.js-**generated** files that were tracked and flipped content on every build, polluting
  every diff. They regenerate on build — **nothing to do; safe.**
- **Sibling-comparison family drift** (`apps/parent/app/sibling-comparison/SiblingComparisonClient.tsx`):
  fixtures showed Omar as "Grade 8 / G8C" and a sibling "Yusuf" — corrected to the canonical family in
  `packages/lib/src/child.tsx`: **Omar 7B**, **Yasmin** (name + grade + AI-summary copy + pronoun).

### B3. S2.1 — Faculty page shows all teachers, real load, real department
The admin Faculty page had three real-data defects (the DB **has** the data; the code mishandled it).
Fixed in `packages/lib/src/queries/teachers.ts` + `timetable.ts` + the faculty page:
1. **Under-count 69 → 105.** The roster query read from `teacher_contracts` (69 rows); now reads all
   **105** from `teachers` and left-joins contracts for the weekly cap only.
2. **Load was 0 for everyone.** Load now comes from the **timetable** (`getTeacherDailyLoads`), via a
   new `resolveTimetableYearId` helper. **68 teachers now show real load** (e.g. Mary Boyle 44); 37
   show 0 honestly (they have no timetable rows).
3. **Department was "Other" for everyone** (`teachers.primary_dept` is NULL for all). Added a code-side
   `deriveDepartment(primary_subject_text)` map (Math→Mathematics, History/Geography→Humanities, …).
   **63/105 now land in a named department**; the rest split Unassigned (36 blank subjects) / Other (6).
   **No live DB write** — this is derived in code.
- Result on screen: 105 teachers, avg utilisation ~63%, over-capacity ~28 — all driven by real data.
- Also drafted **`schema/018_backfill_teacher_primary_dept.sql`** (NOT applied) — an optional migration
  to persist the same derivation into `primary_dept`. Your call whether/when to run it.

---

## C. Decisions for you / Elias (flagged, not assumed)
1. **⚠️ Which year's load does Faculty show?** The real timetable lives in **2025-2026** (1,925 teaching
   slots), but the *current* academic year **2026-2027** has contracts yet an **empty timetable** (6
   slots). S2.1 sources load from the year that actually has a timetable, so the demo shows real
   numbers. If the demo must reflect strictly *current-year* load, it'll read ~0 until a 2026-2027
   timetable is published. **Decide before the demo.**
2. **Migration 018** (backfill `primary_dept`) — drafted, not applied. Run it if you want the department
   persisted in the DB; otherwise the code-side derivation covers the demo.
3. **`next-env.d.ts` untracking** — standard Next.js convention; just regenerates on build.

---

## D. DB / seed / env implications (important for the demo)
- **The app still runs on the OLD Supabase project** (`dxrkbjftkfhlddqefmaq`) in `.env` **and**
  `.mcp.json`. The cutover to the ISO project (`qntmzazndkcdgkwmrhae`) is **not done** — runbook:
  `docs/pm/2026-07-10-db-cutover-runbook.md`. Not blocking this PR, but it's the demo's real linchpin.
- **Real-vs-mock hinges on seeding.** Many screens read the DB but **silently fall back to Layla/Swart
  mock data when a table is empty** (map: `docs/pm/2026-07-14-real-vs-mock-map.md`). So a screen can
  *look* real and be showing mock. The demo depends on pointing at a **seeded** DB and verifying each
  screen shows real ISO data, not fallback.
- **Security:** a leaked OLD-project `service_role` key (found in an earlier doc, since redacted) should
  be **rotated** — it's in `Emouawad1/manhaj` history. Folds into the cutover.
- **Ask-Manhaj / AI** needs `ANTHROPIC_API_KEY` in the environment to function (the `/api/chat` route is real).

---

## E. What to manually check after merge
- **Faculty** (`/admin/faculty`): 105 teachers listed; Periods/wk populated for most; departments show
  real names (not all "Other"); avg-load / over-capacity tiles non-zero.
- **Parent → Sibling comparison**: three children = Layla 10A, **Omar 7B**, **Yasmin** (no "Yusuf", no "Grade 8").
- **Diffs going forward**: `next-env.d.ts` no longer shows up in `git status` after a build.
- CI (Lint/test/build + Vercel preview) runs on this PR — the Vercel preview URL is the place to click through.

## F. Verification already done
- Each task built + linted clean on its own app (admin, parent). S2.1 verified against the live DB
  (read-only) replicating the exact merge: 105 teachers, 68 with real load, 63 dept-mapped.
- CI will validate the integrated branch end-to-end before you merge.

## G. Not in this sprint (next)
- **DB cutover + seeding** (Elias/dashboard + data) — the demo linchpin.
- **Phase 2**: wire the remaining mock screens (parent monthly report, etc.), the AI layer, missing
  screens (manage-admins, teacher goal-setting, admin attendance analytics), parent-comms + payments.
