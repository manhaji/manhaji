# Sprint 1.6 — Post-1.5 review feedback (Admin Dashboard first)

**Branch:** `sprint-1.6` (off `main` @ `bd2f72e`, #12 merged) · **Status:** in_progress · **Opened:** 2026-07-24
**Container for Elias's round-2 review feedback after the 1.5 merge.** Wave 1 = **Admin Dashboard** (from demo picker). More apps to follow as Elias reviews them.
**Triage source:** `docs/pm/reviews/2026-07-24-admin-dashboard-1.5-feedback.md`.

## Elias's locked decisions (2026-07-24)
1. **Real faculty data** — A2–A6 are built against the real 78-teacher query, not the mock fallback. The real render branch (which currently lacks Sections/Contract columns) gets built out to match.
2. **A1** — remove the **Teacher** tab; keep **Student Advisor** with a "coming soon" ribbon; **Principal** stays default. *(confirmed)*
3. **A5** — a **committed sample placeholder PDF** (served statically, no live Storage write) is acceptable for the demo. *(confirmed)*
4. **A6** — approved to **draft a new migration** for an applicant status-history / comments table. The migration and any live `job_applicants` writes come back to Elias for explicit approval before being applied.
5. **"Contracts due" (2026-07-24)** — keep the interim definition "teacher has no current-year contract on file" (`has_contract === false`). Matches the shipped A4b build → no rework. Revisit to date-based once contract expiry data exists.

## Task table

| id | title | owner | wave | status | acceptance |
|----|-------|-------|------|--------|------------|
| 1.6-A1 | Role tabs: remove Teacher, Student Advisor = "coming soon" ribbon, Principal default | frontend-engineer | A | todo | Teacher gone; Advisor shows ribbon + inert (no broken view); Principal default; no console errors |
| 1.6-A2 | Department filter chips actually filter the breakdown (incl. Over-capacity / Contracts-due) | frontend-engineer | A | todo | Clicking a dept chip filters Dept Breakdown + expands it; "All" resets; active chip selected |
| 1.6-A3 | Department Breakdown = expandable bucketing (open a dept → its teachers) | frontend-engineer | A | todo | Clicking a dept row/chip expands to that dept's teachers on **real data**; collapse works; counts correct |
| 1.6-A4 | Faculty roster 3-state header sort (asc→desc→default) on real data | frontend-engineer | A | todo | Any header cycles asc/desc/none w/ arrow; correct for text+numeric; existing filters still work. Excel-style per-column dropdown = fast-follow |
| 1.6-A4b | Real roster branch gains Sections + Contract columns (to match the annotated view) | frontend-engineer | A | todo | Real faculty table shows Sections + Contract columns populated from real data |
| 1.6-A5 | Contract preview/download popup with committed sample PDF | frontend-engineer + backend-engineer | B | todo | "Review contracts" / Contract cell opens popup previewing a PDF + Download; serves committed sample; closes cleanly; no live Storage write |
| 1.6-A6-db | Draft migration: applicant status-history / comments table | database-engineer | C | todo | Migration file drafted (not applied); table + RLS designed to store per-status-change comments/history keyed to `job_applicants`; PR for Elias review |
| 1.6-A6-ui | Hiring pipeline: bucketing + Edit modal + status-comment + history + Add candidate | frontend-engineer + backend-engineer | C | blocked-on-A6-db | Each stage expands to its applicants (real `job_applicants`); Edit changes info/status; status change requires+records a comment; full history viewable; Add-candidate mirrors fields. Live writes need Elias approval |

## Sequencing
- **Now (parallel):** Wave A (frontend, one task branch) + 1.6-A6-db (database, migration draft PR).
- **After Wave A merges + A6 table approved:** Wave B (A5) and 1.6-A6-ui.
- All work on task branches off `sprint-1.6`; PM integrates; single `sprint-1.6`→`main` PR reaches main with a handover for Karim. **No pushes to main. Elias approves + merges. Live DB writes/migrations need explicit approval.**

## Process fix carried from 1.5
The 1.5 handover flagged "writes not click-tested" but did **not** list per-widget dead/placeholder controls — which is why these comments slipped through. **Sprint-1.6 handover MUST include a "Known non-functional / placeholder controls" section**, distinct from the "not yet verified" caveat.
