# Phase 1 Review — Manhaji live site + database

**Date:** 2026-07-10 · **Reviewer:** PM agent system (first job) · **Target:** live site
`https://manhaji-bay.vercel.app` (external developer's deployment), black-box, all 4 user
types, demo creds. Database audit: complete (database-engineer, read-only — nothing modified).

> **Status: COMPLETE** — browser walkthrough + database audit both done.

---

## Executive summary (plain language)

The site is **real and impressively built on the surface** — all four user types log in, the
navigation works, the pages are rich and polished, and **some screens genuinely read live data
from the database** (Faculty shows 69 real ISO teachers; Students shows the real enrolment count).
Phase 1's core goal — "wire the backend to the front end for reads" — is **partially achieved**.

But there are **systemic gaps that make it not yet trustworthy as a working product**:
1. **Many buttons and cards are broken or do nothing** — including every dashboard summary card
   (they 404), the "Submit attendance" button (saves nothing), and profile/message buttons (dead).
2. **All AI features are offline** — "Ask Manhaj" and every "Generate" button hit a missing
   endpoint (`/api/chat` returns 404).
3. **A lot of what looks like data is still fake** (mock/demo numbers), and where data is real,
   some of it isn't joined up (every teacher shows 0 periods and department "Other").
4. **A database-pointer risk:** your code still points at the OLD database (the emouawad2 one),
   not the migrated emouawad1 one — the cutover was never finished.

**Verdict:** solid Phase-1 *reading* foundation on a few screens, but the "critical functionality"
and full backend integration are **not complete**. The fix list below is the proposed Sprint 1.

---

## What works ✅
- **Auth + access control:** password login and the one-click `/demo` picker both work for all four
  roles; role guards redirect correctly (unauthenticated hits 307 → login); sign-out works.
- **Real database reads (confirmed live):**
  - **Faculty** (`/admin/faculty`): reads real ISO staff names from the DB (JO AN, Dr MOHD Saab,
    Tania Harder, …). Genuine read integration. _(Caveat: it shows **69** while the DB holds **105**
    teachers — it under-counts, see 🟠 below.)_
  - **Students** (`/admin/students`): "of 23 enrolled" + at-risk list — matches the real 23 rows in DB.
- **Rich, polished UI** across every persona; bilingual (EN/عربية) course-selection wizard renders.
- **Routes exist:** no page-level 404s on the main admin/teacher/parent/student routes.

## What's broken 🔴 (critical)
| # | Issue | Where | Evidence |
|---|-------|-------|----------|
| 1 | **All dashboard summary cards 404** — links miss the persona prefix (`/faculty` instead of `/admin/faculty`, `/homework` instead of `/student/homework`, etc.) | Admin dashboard (5 cards), Student dashboard (4 cards) | Clicking Faculty card → HTTP 404 page; console 404s for `/faculty /schedule /attendance /reports /homework` |
| 2 | **AI features entirely dead** — "Ask Manhaj" chat + all "Generate insight / Generate diff" buttons | All personas | `GET/POST /api/chat` → 404 |
| 3 | **One-Tap Attendance doesn't save** — Submit fires no write request | Teacher `/teacher/attendance` | Clicked Submit → zero network mutations (only nav prefetch) |
| 4 | **Dead action buttons** — "Open profile", "Message parent" do nothing (no nav, no modal, no log) | Admin `/admin/students` | Clicked → no-op |
| 5 | **Calendar feed + sections API missing** | — | `/api/calendar/feed.ics` 404, `/api/sections` 404 |

## What's incomplete / low-quality 🟠
- **Faculty page has three real-data bugs** (the DB has the data; the page mishandles it):
  - **Under-counts:** shows **69** teachers though the DB holds **105** (and the admin dashboard
    correctly says 105). Likely an inner-join to `teacher_contracts` (69 rows) dropping the rest.
  - **Load shows 0 for everyone** even though the DB has **458 teaching assignments + 2,009 timetable
    slots** — the load simply isn't being joined/computed. Not missing data; a query bug.
  - **Department = "Other" for everyone** — confirmed real cause: `teachers.primary_dept` is **NULL for
    all 105** in the DB. Needs a backfill (or the page should use `primary_subject_text`).
- **Mock vs real is mixed and unlabelled:** weekly digests, monthly briefings, KPI tiles, Contracts
  dashboard, Hiring pipeline, Performance composite all look like hardcoded demo data sitting next to
  the real reads. No client-side Supabase/API calls were observed during page loads → pages are
  server-rendered, so "real vs baked-in" must be confirmed against the DB (see audit below).
- **Demo-data inconsistencies:** Layla shows "Grade 5" on the parent digest but "10A · HS" in the
  child switcher; teacher Ms Swart is an English teacher but her attendance screen shows "G5B Maths".
- **Navigation gaps:** parent top-nav has no Messages or Course-selection entry (course wizard only
  reachable by direct URL); several student sub-pages (Schedule, Homework, Past Reports) are only
  reachable through the broken 404 cards.

## Database / backend integration (database-engineer, read-only audit)

**Two live databases, exact clones, in sync — this is the biggest risk.** Both the OLD ref
`dxrkbjftkfhlddqefmaq` (emouawad2) and the MIGRATED ref `qntmzazndkcdgkwmrhae` (emouawad1) are
reachable and hold **identical data** (same 68 tables, same exact row counts, same school UUID). The
app points at the **OLD** one — confirmed in code: `apps/web/.env.local` has
`NEXT_PUBLIC_SUPABASE_URL=…dxrkbjftkfhlddqefmaq…`. The cutover to emouawad1 was never finished.
🔴 **Risk = silent drift:** two writable copies means the first write to either one makes them
diverge, and a later cutover could lose data. Decision needed — finish the cutover and retire the
old one, or abandon the migration and decommission the copy. **Don't leave both live.**

**Real data is substantial** (identical on both DBs): 1 school, **23 students**, **105 teachers**,
82 sections, 50 subjects, **2,009 timetable slots**, 458 teaching assignments, 400 attendance marks,
69 teacher contracts, 8 login accounts. So the reads that are wired up have real data behind them.

**Empty tables → any screen backed by these renders blank:** `staff_absences` (0), `substitutions`
(0), `student_enrollments` (0), `announcements` (0), `notifications` (0). Also **parent data is thin**
— only **2 parent records for 23 students** — so parent-facing screens have almost nothing to show.

**Security (RLS) = strong.** All 68 tables have row-level security ON with correct multi-tenant
isolation (the `add_school_id_to_jwt` → `tenant_id()` → `school_id = tenant_id()` chain is verified
end-to-end). ⚠️ One config caveat: the JWT auth hook's *registration* is a Supabase dashboard setting,
not in the DB — **it must be re-registered on the emouawad1 project before any cutover**, or logins
there return empty data.

**Integrity:** no orphaned foreign keys found. `teachers.primary_dept` is **NULL for all 105**
(explains the "Other" department bug above). Enums consistent; no drift between the two copies.

_(A red herring was ruled out: approximate internal stats briefly suggested the two DBs differed on
teacher/subject counts; exact `COUNT(*)` confirmed they're identical — stale planner statistics, not
real divergence.)_

---

## Proposed Sprint 1 (prioritized fix list)

**P0 — critical, and cheap to fix:**
1. **Fix the persona-prefix bug** on all dashboard cards (admin ×5, student ×4) — one-line href fixes
   that clear the most visible breakage (clicking a summary card 404s today). _(frontend-engineer)_
2. **Resolve the two-live-database situation** (data-loss risk). Decide with Elias: finish the cutover
   to emouawad1 or abandon it. Until decided, treat the emouawad1 copy as frozen/read-only so the two
   can't drift. If cutting over: register the JWT auth hook on emouawad1 + test-login first.
   _(database-engineer drafts + Elias approves — live change, needs sign-off)_

**P1 — complete critical read/write integration:**
3. Make **One-Tap Attendance actually persist** (write path → `attendance_marks` + confirmation).
   _(backend + database)_
4. **Fix the Faculty page:** show all 105 teachers (not 69), join real load from the 458 assignments /
   2,009 slots, and backfill or stop using `teachers.primary_dept` (100% NULL → "Other"). _(backend + database)_
5. Wire or hide the **dead action buttons** (Open profile, Message parent). _(frontend + backend)_
6. Restore or remove the **AI features** (`/api/chat` 404) so "Ask Manhaj"/Generate buttons aren't dead ends. _(backend)_

**P2 — quality / trust:**
7. **Handle the empty tables gracefully** (staff_absences, substitutions, announcements, notifications,
   student_enrollments — all 0 rows) and thin parent data — show clean "no data yet" states, not broken UI;
   or seed representative demo data. _(frontend + database)_
8. Label or replace remaining **mock blocks** (weekly/monthly digests, contracts, hiring, performance) so
   real vs demo is unambiguous. _(frontend + backend)_
9. Fix **demo-data inconsistencies** (Layla's grade 5-vs-10A; Ms Swart English-vs-G5B-Maths). _(database)_
10. Add **missing nav entries** (parent Messages/Course-selection; student Schedule/Homework/Past-reports). _(frontend)_

---

## Methodology / evidence
Black-box browser walkthrough (Playwright) of all four personas via the `/demo` one-click picker;
route + API existence probed via HTTP status; console + network captured per page. No data was
written to the live database (course-selection submit deliberately not completed). The DB audit runs
read-only.
