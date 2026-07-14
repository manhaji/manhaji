# Sprint 1 — Phase 1 Go-Live (guided demo on real data)

**Status:** PROPOSED · **Window:** week of 2026-07-14 → 07-18 (Mon–Fri) · **Drafted:** 2026-07-11
**Goal:** A credible, non-broken **guided demo on ISO's real data** we can put in front of the pilot school (International School of Oman) by Friday — core loops (Schedule, Faculty, Attendance) working live; everything else shown cleanly as "preview."
**Build model:** the external **developer** and the **specialist agents** both build, in parallel, split by area; every change is a branch → PR → CI → PM review → **Elias approves + merges**.
**Sources:** `docs/pm/reviews/2026-07-10-phase1-visual-buildstatus-report.md` + `2026-07-10-phase1-review.md`.

---

## What "go-live" means this week (the bar)
The principal sees a walkthrough where:
- **Faculty, Sections, and the Timetable/Scheduler show ISO's REAL data** and look correct.
- **Attendance** can be taken and it **saves** (one real write loop).
- **Nothing is visibly broken** — no dead cards, no 404s, no garbled copy, no dead buttons.
- Everything not yet real is **clearly labelled "Preview / Phase 2"** — honest, not broken.

Explicitly **NOT** required for go-live (→ Phase 2): AI features, manage-admins, teacher goal-setting, parent-comms pipeline, payments, full real-data wiring of parent/student screens.

---

## The work in 6 sections

Owners: **DEV** = external developer · **FE/BE/DB** = frontend/backend/database agents · **SCHED** = scheduler work (the "Manhaj Development Session" stream) · **ELIAS** = decision/merge.

### S0 · Foundations — *must land Monday; blocks everything*
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S0.1 | Dev pushes the live-site Phase-1 code into `Emouawad1/manhaj` as a branch (`phase1-dev`) | DEV + ELIAS | 🔴 |
| S0.2 | DB cutover to emouawad1 (per cutover runbook) — run in parallel, **NOT a demo blocker**: the demo runs fine on the current DB, so freeze the old copy against drift and cut over when convenient this week | DB + ELIAS | 🟠 |
| S0.3 | ~~Scheduler state-check~~ — ✅ **DONE 2026-07-12** (`docs/pm/2026-07-12-scheduler-state-check.md`): engine works, no UI wiring; S3 rescoped to read-only + precomputed covers. Remaining: S3.3 reconcile vs other chat | — | ✅ |
| S0.4 | Confirm branch/PR/CI flow works for both dev + agents (test PR) | BE | 🟠 |

### S1 · De-risk the shell — *make the walkthrough safe (quick wins)*
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S1.1 | Fix the dashboard/Input card 404 link bug (admin ×5, student ×4, input ×3) — one shared fix | FE | 🔴 |
| S1.2 | Hide or clearly "Preview" the dead/disabled controls (Upload, Send batch, Open profile, Message parent, Ask-Manhaj/Generate) | FE | 🔴 |
| S1.3 | Clean garbled demo copy + fix data inconsistencies (Layla grade, Swart subject) | FE + DB | 🟠 |
| S1.4 | Fix nav gaps that matter for the demo path (course-selection reachable, etc.) | FE | 🟡 |

### S2 · Real-data spine — *the credibility core*
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S2.1 | Faculty: show all **105** teachers, real **load** (from 458 assignments / 2,009 slots), real **department** (backfill `primary_dept`) | BE + DB | 🔴 |
| S2.2 | Section Mapping: confirm the Confirm/save path writes to the DB | BE + DB | 🟠 |
| S2.3 | Students roster: wire to real students; make "Open profile" work (or hide) | BE + FE | 🟠 |
| S2.4 | Admin dashboard cards: connect the count cards to live numbers | BE | 🟡 |

### S3 · The Scheduler — *the flagship (scope now SET by the state-check)*
State-check verdict (`docs/pm/2026-07-12-scheduler-state-check.md`): the **engine is real + tested (227 tests, runs on ISO's 2,003 real timetable rows)** but there is **no API/service layer and no UI wiring** — the live Schedule screen is 100% mock (`apps/web/lib/mock-schedule.ts`). Solver code is on branch **`tooling/research-agent`** (main is ~15 commits behind). Full integration is multi-week → **descoped for the demo**. Demo path needs no live solver call:
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S3.1 | **Show the real timetable** (read-only): replace `mock-schedule.ts` with a real read of `timetable_slots` (a DB query — no Python service needed) | BE + FE | 🔴 |
| S3.2 | **Substitute-cover (stretch)**: scripted "Manhaj proposes cover" using the **302 precomputed cover plans** (`data/processed/tt_2526/derived/cover_plans.json`) — no live solver call | BE | 🟡 stretch |
| S3.3 | **Reconcile before Monday**: confirm the repo (`tooling/research-agent`) is the latest scheduler state vs. the separate "Manhaj Development Session" chat; if that built an API layer, S3 shrinks further | ELIAS | 🔴 |

### S4 · One live daily loop — *proof it's real, not a mockup*
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S4.1 | Teacher One-Tap Attendance **saves** to `attendance_marks` (+ confirmation, survives reload) | BE + DB | 🟠 (stretch) |
| S4.2 | (If S4.1 lands) minimal admin attendance readout so the saved data is visible | BE | 🟡 |

### S5 · Demo readiness — *the go-live cut (Fri)*
| # | Task | Owner | Critical |
|---|------|-------|:---:|
| S5.1 | Seed/verify ISO real data across the whole demo path (teachers, sections, timetable, a class for attendance) | DB + DEV | 🔴 |
| S5.2 | Write the **demo script** — what the principal sees, in what order, on which screens | PM + ELIAS | 🔴 |
| S5.3 | Full dry-run walkthrough on the live demo; PM sign-off vs the go-live bar | PM + ELIAS | 🔴 |

---

## The week with the engineer

**Ownership split (avoid collisions):** the **DEV owns the live-site page/UI code** they wrote (S1 shell fixes, S2 data wiring inside their components); the **agents take well-bounded parallel tasks** that don't overlap the dev's files (DB cutover + `primary_dept` backfill + load-join query (DB/BE), the isolated 404 link fix if dev hands it off, demo-data cleanup, verification). **Elias** decides + merges. **SCHED** runs as its own stream and meets the app at S3.

**Daily rhythm:**
- **Mon** — S0 foundations. Dev pushes code; run DB cutover; scheduler state-check. *Nothing downstream starts until code is in the repo.*
- **Tue** — S1 shell de-risk (quick wins, mostly agent/dev PRs) + start S2 faculty/sections wiring + kick S3 scheduler integration.
- **Wed** — S2 real-data spine + S3 scheduler integration continue.
- **Thu** — finish S2/S3; S4 attendance-save if on track; begin S5 data seeding.
- **Fri** — S5: seed check, demo script, full dry-run, go/no-go sign-off.

**How work flows (dev + agents in one repo):** everyone branches off `main`; both dev and agents open PRs; CI (lint+test+build) gates every PR; the PM reviews against the task's acceptance criteria; **Elias merges**. Split by area = few conflicts. Live-DB changes (cutover, backfill, attendance write) are approval-gated.

**PM cadence:** each morning `/pm status` (board + what's blocked); dispatch agent tasks with `/pm assign`; each afternoon `/pm review` the live demo to catch regressions early. Board = this file, kept current.

**Go-live readiness checklist (Friday gate):**
- [ ] App runs on the emouawad1 DB (single live copy)
- [ ] No 404s / dead cards / dead buttons on the demo path
- [ ] Faculty, Sections, Timetable show real ISO data, correct
- [ ] Scheduler: view real timetable + run one real substitute-cover
- [ ] Attendance saves (or is a clean, labelled preview)
- [ ] Everything non-real is labelled "Preview / Phase 2"
- [ ] Demo script written; full dry-run passed; Elias signed off

---

## Division of labour — "us" vs the agents

**Done by us (Elias + the human developer):**
- **Elias — git + accounts (agents can't):** push code to `main` + cut the `phase1` branch; add the dev as a collaborator; the Supabase dashboard steps + keys and the Vercel env change for the DB cutover; **reconcile the scheduler branch (S3.3)**; **approve + merge every PR**; co-write the demo script + the final go/no-go.
- **The developer — their own app code:** integrating the agents' data/query work into their page components where deep knowledge of their architecture is needed (Faculty/Students/dashboard rendering, the attendance Submit wiring); anything in their components the agents shouldn't touch blind.

**Outsourced to the agents (built as PRs, you merge):**
- **Frontend agent:** all of S1 (the 404 link fix, hide/label dead+disabled buttons, clean garbled copy + data inconsistencies, demo-path nav) — isolated, well-bounded cleanup.
- **Backend + Database agents:** the S2 data layer (`primary_dept` backfill, faculty load-join, section-mapping save-path, dashboard count queries); **S3.1 replace `mock-schedule.ts` with a real timetable read**; **S3.2 wire the 302 precomputed covers**; S4 attendance write-path; the repo-side of the cutover + all read-only checks; S5 data seeding/verification.
- **All agents:** daily verification passes; PM reviews everything before it reaches Elias.

> **Git caution during the push:** your **solver engine**, the **precomputed cover plans** (`data/processed/tt_2526/derived/cover_plans.json` — S3.2 needs it), and the **PM planning docs + agent definitions** live on `tooling/research-agent`, **not** on the dev's live-site code. When you set `main` to the dev's code, **merge those in — don't overwrite** — or `phase1` won't have what S3 and the PM workflow need.

## Definition of done
Every task shipped as branch → PR → CI green → PM review → Elias merge. The Friday checklist passes. Live-DB steps explicitly approved.

## Risks / dependencies
- **S0.1 (code in repo) gates almost everything** — if the dev is slow to push, the week compresses.
- **S0.3 scheduler state is unknown** — if the engine isn't ready, S3 shrinks to "show the real timetable" (read-only) and full auto-scheduling slips to Phase 2.
- **S4 attendance-write is a stretch** — drop first if time is tight; a guided demo can show it as a labelled preview.
- Solo-ish dev capacity + agent PR throughput is the main constraint on how much of S2 lands.

---

## Phase 2 split (starts in parallel once the demo is live)
- **P2-A · Full real-data wiring** — turn every remaining 🟡 Demo screen (parent digest/invoices/slips/siblings, student goals/planner/tracker/growth, teacher tools) into live data.
- **P2-B · Intelligence layer** — restore + build the AI: Ask-Manhaj, rubric AI, homework/summary generators, dashboard briefings (`/api/chat` is offline).
- **P2-C · Missing screens** — manage-admins (A1), teacher goal-setting, admin attendance analytics (A6), sick-leave approval queue (A4).
- **P2-D · Comms + payments** — parent-comms pipeline (draft→approve→send via Resend) and real invoices/payment status (P5).
- **P2-E · Write-path hardening** — make every "save" action across all personas persist reliably (daily-use readiness).
- **P2-F · Docs** — produce the Phase 2 & Phase 3 handover breakdowns (were pending) as the specs for the above.
