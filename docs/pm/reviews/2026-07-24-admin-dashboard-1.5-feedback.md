# Admin Dashboard — Elias review feedback (post-1.5 merge)

**Date:** 2026-07-24 · **Source:** `Admin_Dashboard_S1.5_Comments.docx` (Elias) · **Context:** comments given *before* PR #12 merge that did not make it into the build. Entry point: **Admin Dashboard, reached from the demo picker.** This is round-2 feedback to be actioned as a follow-on to sprint-1.5.

Each item below is anchored to a screenshot Elias annotated.

## A1 — Role tabs (Principal / Student Advisor / Teacher)
*Screenshot: tab row above "Faculty".*
- The tabs **do nothing** (dead buttons).
- Elias doesn't believe **Student Advisor** or **Teacher** is scoped here.
- **Teacher** tab should be **removed** entirely.
- **Student Advisor** should stay but carry a **"coming soon" ribbon**.

## A2 — Department filter chips
*Screenshot: chip row — All departments / Mathematics / Sciences / Languages / Humanities / Arts / PE / Primary / KG / "Over capacity · 1" / "Contracts due · 0".*
- The chips **do nothing**.
- They should **filter the Department Breakdown section** and **open up the selected department(s)**.
- Design intent: Department Breakdown is a **bucketing view** — chips drive it.

## A3 — Department Breakdown = bucketing view
*Screenshot: "Department breakdown · 9 departments" list (Mathematics/Mr Faisal Hussain, Sciences, etc.).*
- Clicking a department should **open the bucket** and reveal the teachers inside it (e.g. Mathematics → Mr. Faisal … ; Sciences → Mrs. X …).
- Same bucketing pattern is reused in the Hiring Pipeline (see A6).

## A4 — Faculty roster: sortable columns
*Screenshot: "Faculty roster · 25 of 69 teachers shown" table — Name / Department / Primary Subject / Sections / Periods/wk / Status / Contract.*
- **Column headers do not sort when clicked.** Expected: 1st click ascending → 2nd descending → 3rd back to standard view.
- Additionally add a **drop-down on the right of each column** for filtered sorting (Excel-style), e.g. "only math professors with multiple sections."

## A5 — Contracts: preview / download popup
*Screenshot: Contracts dashboard ("Review contracts" buttons) + the Contract column in the roster.*
- The contract buttons **do nothing**.
- At minimum: a **popup to view contracts uploaded as PDFs** — **Preview with a Download option**. For now the download should pull a **sample contract placeholder**.

## A6 — Hiring pipeline: bucketing + edit
*Screenshot: "Hiring pipeline · this cycle" funnel (Applicants 47 / Shortlisted 12 / Interviewed 8 / Offered 3 / Hired 2) + "+ Add candidate".*
- Same **bucketing** concept as Department Breakdown — each stage opens to its list.
- Each teacher/applicant in the pipeline needs an **Edit button** for admins / hiring managers to:
  - edit the applicant's information,
  - edit their **status**,
  - **add a comment every time the status changes**,
  - **review all historical comments**.
- Fields should mirror **"Add candidate"** — which **also does nothing** right now.
- General note from Elias: **"pop-up missing in many places."**

---

## PM triage + fix plan (2026-07-24)

**Verified against merged `sprint-1.5` (HEAD `6aec6c7`). All findings are read-only.**

### Cross-cutting finding (read first) — the demo screen shows MOCK data
The Faculty page (`apps/admin/app/faculty/page.tsx:7-13`) fetches real teachers only when there is a
current academic-year/session; on failure/empty it hands the client `teachers = []`, and every child
component then falls back to `@manhaj/lib/mock-faculty`. Elias's screenshots — "9 departments" incl.
"Admin / Ops", "25 of 69 teachers", dept head "Mr Faisal Hussain" — are all mock values
(`mock-faculty.ts:77-85`, `172-177`). **So the entry screen he reviewed is rendering the MOCK fallback,
not the 78 real teachers from migration 019.** This matters because the two render branches differ (e.g.
the real roster branch has NO Sections/Contract columns; the mock branch does). **Open question for the
whole wave: should the demo Faculty page show the 78 real faculty, or is the mock view acceptable for
the demo?** The answer decides whether A2–A6 are built against real query data or the mock shapes.

Also note the handover context: A1–A4 are controls the sprint shipped as *scaffold only*; A5 (contracts)
and A6 (hiring pipeline) were **explicitly deferred** in handover §2/§6 as "needs real school data" — so
they are "deferred," not "sprint claimed done but dead."

---

### A1 — Role tabs (Principal / Student Advisor / Teacher)
- **Current state:** genuinely dead. `FacultyPageClient.tsx:39` holds `lens` state and passes it to
  `BreadcrumbLensBar` (`FacultyPageClient.tsx:58-65`); the component renders three interactive pills
  (`packages/ui/src/BreadcrumbLensBar.tsx:37-50`). Clicking updates `lens` but **`lens` is never read**
  to change any content — pure highlight toggle. All three tabs (incl. Teacher) present.
- **What's needed:** remove the **Teacher** pill; keep **Principal** (active/default) and **Student
  Advisor**; give Student Advisor a "coming soon" ribbon and a non-broken inert state.
- **Owner:** frontend-engineer.
- **Effort:** S.
- **Acceptance:** Teacher tab gone; Student Advisor visible with a "coming soon" ribbon and does not
  switch to a broken/blank view; Principal is the default active lens; no console errors.
- **Dependencies / open questions:** `BreadcrumbLensBar` is currently used **only** on the Faculty page
  (grep), so trimming lenses is low-blast-radius — but the `Lens` type is shared, so prefer making the
  lens list a prop rather than hard-deleting the type. **Elias decision:** confirm "remove Teacher,
  Student Advisor = coming-soon ribbon (non-functional for now)."

### A2 — Department filter chips
- **Current state:** dead filter. `FacultyPageClient.tsx:42-54` builds the chips; `:105` wires
  `onToggle` to `setActive`, but `active` (`:40`) is used **only** to mark chip highlight styling. It is
  **not** passed to `DepartmentBreakdown` (`:107`) or `FacultyRoster` (`:108`) — so nothing filters.
- **What's needed:** feed the active chip into Department Breakdown so it filters to the selected
  department(s) and opens that bucket (see A3); "Over capacity" / "Contracts due" chips filter to those.
- **Owner:** frontend-engineer.
- **Effort:** M (couples tightly to A3).
- **Acceptance:** clicking a dept chip filters Department Breakdown to that dept and expands its bucket;
  "All departments" resets; "Over capacity" narrows to over-cap depts; active chip is visibly selected.
- **Dependencies / open questions:** chip keys (`math`, `sciences`, …) are hard-coded and must map to
  the actual dept labels. On **real** data depts come from free-text `primary_dept`; on **mock** they're
  fixed labels — so the mapping (and whether the fixed chip list even matches the real depts) depends on
  the cross-cutting real-vs-mock decision above.

### A3 — Department Breakdown = bucketing view
- **Current state:** dead bucketing. `DepartmentBreakdown.tsx` renders one static row per department
  (`:57-87`) with count/avg-load/pills; **no onClick, no expand**, teachers inside a dept are never
  shown. On real data the dept `head` is even set to "—" (`:35`).
- **What's needed:** make each dept row expandable to reveal the teachers in that bucket (name, subject,
  load); collapse works; also driven by the A2 chips.
- **Owner:** frontend-engineer.
- **Effort:** M.
- **Acceptance:** clicking a dept row (or its chip) expands to list that department's teachers and
  collapses again; the "9 departments" count and per-dept rows stay correct.
- **Dependencies / open questions:** on **real** data the teacher→dept grouping already exists
  (`computeFromTeachers`, `DepartmentBreakdown.tsx:16-41`) so per-dept teacher lists are available. On
  **mock** data `MOCK_DEPARTMENTS` carries only counts (no per-teacher lists) — so bucketing on the mock
  view would need mock teacher-per-dept lists added. Ties back to the real-vs-mock decision.

### A4 — Faculty roster: sortable columns
- **Current state:** "filters but doesn't sort." `FacultyRoster.tsx` real branch (`:132-163`) and mock
  branch (`:194-221`) both use plain `<th>` — **headers are not clickable and there is no sort**. It
  does have working filter dropdowns (name/dept/subject/status, `:91-131`). No per-column Excel-style
  dropdown. Note: the real branch has columns Name/Dept/Subject/Periods/Status (**no Sections, no
  Contract**); only the mock branch shows Sections + Contract — the columns Elias annotated.
- **What's needed:** clickable headers with 3-state sort (1st asc → 2nd desc → 3rd default), with a sort
  indicator; plus (stretch) a per-column dropdown for combined filter+sort.
- **Owner:** frontend-engineer.
- **Effort:** M for the 3-state header sort; L if the full Excel-style per-column dropdown is in scope.
- **Acceptance:** clicking any column header cycles asc/desc/none with a visible arrow; sort is correct
  for text and numeric columns; existing filters still work alongside it.
- **Dependencies / open questions:** recommend phasing — ship the 3-state header sort first, treat the
  per-column filter-dropdown as a fast-follow. The real-vs-mock column mismatch (Sections/Contract) again
  depends on the cross-cutting decision.

### A5 — Contracts: preview / download popup
- **Current state:** dead placeholder (and a deferred item per handover §2/§6). `ContractsDashboard.tsx:32`
  "Review contracts" button has **no onClick**; the component reads `MOCK_TEACHERS` only. The roster
  Contract column exists only in the **mock** branch (`FacultyRoster.tsx:216`) and is also inert.
- **What's needed:** a popup that **previews a PDF** with a **Download** option; for the demo, download a
  **sample placeholder** contract.
- **Owner:** frontend-engineer (modal + PDF preview/download) + backend-engineer (serve the file / signed
  URL) — no DB migration needed.
- **Effort:** M.
- **Acceptance:** clicking "Review contracts" (and/or a roster Contract cell) opens a popup that previews
  a PDF and offers Download; the demo serves a sample placeholder PDF; closes cleanly.
- **Dependencies / open questions:** schema is **already in place** — migration 020 added
  `teacher_contracts.{contract_url, contract_uploaded_at, contract_uploaded_by}` and the private
  `teacher-contracts` Storage bucket, so **no new migration**. But there is **no sample PDF** yet. Two
  routes: **(a)** commit a small sample PDF into the app (e.g. `apps/admin/public/`) and serve it
  statically — **no live DB/Storage write, recommended for the demo**; or **(b)** upload the sample into
  the `teacher-contracts` bucket and set `contract_url` — that's a **live Storage/DB write → needs
  Elias's explicit approval**. **Elias decision:** is a committed sample-PDF-as-placeholder acceptable?

### A6 — Hiring pipeline: bucketing + edit
- **Current state:** dead placeholder (deferred per handover §2/§6). `OnboardingFunnel.tsx` renders
  `MOCK_ONBOARDING_PIPELINE` bars (`:15-35`); **no stage is clickable/expandable**; "+ Add candidate"
  (`:38`) has **no onClick**. There is no edit, status change, or comments anywhere. A working pattern to
  mirror already exists in Admissions (`apps/admin/app/attendance/` — clickable pipeline stages →
  candidate list → Edit pop-up with auto-reflecting status, per handover §2).
- **What's needed:** bucketing (each stage opens to its applicant list); an **Edit** modal per applicant
  (edit info + status); **a comment captured on every status change**; a **full comment history** view;
  and an **Add candidate** modal mirroring the same fields — all backed by `job_applicants`.
- **Owner:** frontend-engineer (bucketing + modals) + backend-engineer (server actions to read/write
  `job_applicants`) + database-engineer (**new migration** — see below).
- **Effort:** L.
- **Acceptance:** each stage expands to its applicants (from `job_applicants`); each applicant has Edit →
  change info/status; changing status requires and records a comment; the full comment history is
  viewable; "Add candidate" uses the same fields and creates a new applicant.
- **Dependencies / open questions:**
  - **NEW MIGRATION REQUIRED (needs Elias approval before applying).** There is **no applicant
    comment/status-history table today** — grep of `schema/` finds only `behaviour_notes` and the
    017 `COMMENT ON` file. `job_applicants` has a `status` enum (020 added `subject` + a status index)
    but nowhere to store per-status-change comments/history. A5's contracts schema exists; **A6's
    history/comment store does not.** So a `job_applicant_notes` / `job_applicant_status_history`
    table must be **drafted and reviewed first**, then applied only with Elias's sign-off.
  - **Live DB writes.** Add-candidate / edit-status / add-comment all write to live `job_applicants`
    (+ the new history table) → **each live write needs Elias's approval**; drafts/migrations reviewed
    first. The UI currently shows only mock pipeline numbers, so the demo will also need real seed rows
    (or an OR-fallback) for the buckets to be non-empty.

---

## Proposed grouping / build sequence

**Wave A — pure front-end quick wins (no DB, no new data; buildable immediately once Elias confirms A1):**
- **A1** role tabs (remove Teacher, Student Advisor "coming soon"). *S*
- **A4** roster 3-state header sort (defer the Excel-style per-column dropdown to a fast-follow). *M*
- **A2 + A3** chips + Department-Breakdown bucketing — do together, they're one interaction. *M* each.
  (All four are front-end only; the only caveat is the real-vs-mock data decision below.)

**Wave B — front-end + light backend, no schema change:**
- **A5** contract preview/download popup, using a **committed sample PDF** (route (a)). Needs a backend
  serve path but **no migration**. Buildable right after Wave A if Elias OKs the sample-PDF placeholder.

**Wave C — blocked on schema + live data (needs Elias approval before build):**
- **A6** hiring-pipeline bucketing + edit + status-comments + history + Add-candidate. Blocked on a
  **new draft migration** (applicant comment/status-history table) and on **live `job_applicants`
  writes**. Draft migration first → Elias reviews/approves → build.

### Decisions needed from Elias before anyone builds
1. **Real vs mock demo data (affects A2–A6):** should the demo Faculty page show the 78 real teachers,
   or is the current mock view acceptable? This decides whether the bucketing/sort/contracts work is
   built against real query shapes or the mock shapes.
2. **A1:** confirm "remove the Teacher tab entirely; keep Student Advisor with a non-functional
   'coming soon' ribbon; Principal stays the default."
3. **A5:** confirm a **committed sample placeholder PDF** (no live Storage write) is acceptable for the
   demo — vs. uploading a real sample into the `teacher-contracts` bucket (which would need approval).
4. **A6:** approve drafting a **new migration** for an applicant status-history / comments table, on the
   understanding it (and any live `job_applicants` writes) come back for explicit approval before being
   applied.

*Board.json will be updated by the conductor once Elias approves this plan.*
