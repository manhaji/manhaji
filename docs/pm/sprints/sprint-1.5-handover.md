# Sprint 1.5 — Merge Handover (for Karim)

**Branch:** `sprint-1.5` → **`main`** · **PR:** #12 · **Prepared by:** Manhaji PM (AI) · **Date:** 2026-07-20
**Scope:** Phase-1 finish + Elias's full app-by-app review feedback. 19 commits, ~135 files.
Triage source: `docs/pm/sprints/sprint-1.5-plan.md`. Demo script: `docs/pm/sprints/sprint-02-demo-script.md`.

This is the single review for the whole sprint (new workflow: all work on one branch, one PR). Read this + the manual-verify checklist (§7) before merging.

---

## 1. Two live database migrations (ALREADY APPLIED to emouawad1 — do NOT re-apply)

Both were applied to the live target `qntmzazndkcdgkwmrhae` with Elias's approval, atomically, verified. The migration files are in the PR as the record.

- **`schema/019_merge_duplicate_teachers.sql`** — merged 27 duplicate teacher rows (each teacher had an ALL-CAPS "contract" row + a proper-case "timetable" row). Repointed 789 `timetable_slots` + 1 `staff_absence` to the keepers, stamped readable names onto `teachers.full_name`, deleted the 27 dupes. **Roster 105 → 78, and it fixed the "0 periods" load bug.** Undo snapshot lives in `public._teacher_merge_backup` (drop when happy). Two name changes to confirm vs the school list: "Dr MOHD Saab"→"Mohammed Saab", "Ghada Buheisi"→"Ghada Albhaisi".
- **`schema/020_sprint15_feedback.sql`** — the schema for all the new write paths: `students.{re_enrolled_on, final_enrollment_date, leaver_reason, leaver_comment}`; `applicants.{parent_id, owner_admin_id, updated_at}`; `job_applicants.subject`; `teacher_contracts.{contract_url, contract_uploaded_at, contract_uploaded_by}`; `lessons.{plan_notes, pre_class_checklist}`; `lesson_followups` (lesson_id now nullable + section_id + CHECK); `study_blocks.is_done`; `applications.university_id`; new tables `universities` (40 seeded), `student_master_docs`, `booking_requests` (all RLS-on). **Two private Storage buckets created:** `teacher-contracts`, `student-master-docs`.

> ⚠️ **Schema drift note:** the live ledger has an untracked migration `admin_corrections` (reshaped `applicants`, created `job_applicants`, retyped several enums) with no file in `schema/`. 020 targets the live shapes. Worth back-filling that file so `schema/` is a true record — a separate housekeeping task.

## 2. Admin

- **Faculty:** roster gets column filters (name/dept/subject/status) + top-10 with expand. `apps/admin/app/faculty/components/FacultyRoster.tsx`. *(Contracts dashboard, hiring pipeline, performance composite need real school data — see §6; contracts/hiring added to the ISO data request.)*
- **Sections:** removed from admin nav + dashboard/input card (page still reachable by URL for implementation use). `AdminNav.tsx`, `input/page.tsx`.
- **Students:** "Export list" → real **XLSX** of the on-screen filtered list (SheetJS, loaded on click). `AtRiskDashboardClient.tsx`.
- **Admissions** (`apps/admin/app/attendance/`, new `admissions.ts` query + `actions/admissions.ts` + 3 modals): re-enrollment funnel computes from the new `students` columns (OR-fallback while null); **Retention summary** pop-up (data-plug, downloadable) + **Schedule retention call** (`mailto:`, graceful no-contact state) — nudge/barrier/open-all removed; red **Confirm No Re-enrollment** → writes `final_enrollment_date` + `leaver_reason`/`leaver_comment`; **Add applicant** pop-up writes `applicants` with a **searchable parent dropdown + inline create-new-parent**; **Export CSV** works; pipeline stages are clickable → candidate lists → Edit pop-up (status auto-reflects).
- **Reports** (`apps/admin/app/reports/`, new `catalogue.ts` + `generate/[slug]/route.ts` + `actions.ts` + `history/`): regulator sub-tabs removed (Oman only); **R1 Annual Comprehensive Report generator** = server-rendered printable, filled from the DB per Art. 49, **no AI**; other catalogue items generate a data-plug doc or a labelled "needs the school's official template" state; **internal (non-ministry) reports render visually** (charts); Recent-submissions has a real write path (`report_submissions`) + working Download + OR-fallback; "view full history" → new `/reports/history`. Grounded in `docs/research/oman-regulatory-reporting/report-catalogue-2026-07.md`.

## 3. Teacher (`apps/teacher/…`) — includes 5 real bug fixes

- Dashboard KPIs/greeting: real DB reads with OR-fallback (+ fixed a crash when no session).
- **My Week tabs** = same-department colleagues (real depts post-019), each switches to that teacher's real timetable. New `getDeptColleagues`, `getEffectiveTimetableYearId` (the published timetable is in the prior AY — resolved app-wide).
- **Substitute colour-coding** from `substitutions` (amber + "covering · X" chip + legend).
- **My students "Open"** slide-over: notes, missing homework, recent grades (OR).
- **One-tap attendance — 2 bugs fixed:** wrong AY (never resolved the current slot → permanent demo mode) and **Submit was calling mark-all-present, silently erasing tapped absences.** Now saves marks as-is. *(Write path was already correct.)*
- **Rubric — 3 bugs fixed:** `onConflict` didn't match the unique constraint (missing `subject_id`), month sent as `"YYYY-MM"` into a date column, `subject_id` always null. Now a class dropdown drives the student list and scores save to `rubric_scores`.
- **Class hub restructure:** section selector drives the page; Last/This/**Next week** all work; Next-week is the planner (writes `lessons.plan_notes` + `pre_class_checklist`); **Add follow-up** pop-up writes `lesson_followups`; `/teacher/input` is now a redirect to Class hub → Next week (old Input client deleted, nav entry removed); AI homework generator = visible + **Phase-2 labelled**; **Upload homework** = working file-select, upload itself Phase-2-labelled (bucket wiring left for P2).
- **Substitute sheet** now reads the SAME `lessons`/`lesson_followups` the Class hub writes — one source of truth.

## 4. Parent (`apps/parent/…`)

Reply-to-school (writes messages, OR-fallback), Sign-now/View-invoice/Full-report links, permission-slip Save/Sign (real writes, +error banner), invoice **Download PDF/receipt** (new server-rendered print route `invoices/print/`), calendar Add-to-Google/Apple + Copy-ICS with real data-carrying URLs (also fixed the ICS feed's missing portal prefix — that's why those were dead), sibling-comparison links; pickup-person/Open-in-app are **Phase-2 labelled** (no feature yet). **⚠️ `ISO_PARENT_PORTAL_URL` is a placeholder** in `InvoicesPageClient.tsx` — needs the real ISO payment URL from Elias.

## 5. Student (`apps/student/…`)

Dashboard schedule strip + `/student/schedule` richer visual with per-class "what to bring"/"due today" (homework tied to `lessons`); My Goals add/history/next-months/suggested-add/reflections all write (`student_goals`, `goal_checkins`, `goal_reflections`; AI card Phase-2); study-planner wrap-up tasks persist (`study_blocks.is_done`); application-tracker Add-university (from the 40-row `universities` table) → `applications`, test-scores → `student_test_scores` + status refresh, master-docs read view (`student_master_docs`, clean empty state; advisor upload = P2), counselor 1:1 = **request-based** (`booking_requests`, no calendar integration).

## 6. Global + build fixes

- **Brand = "Manhaji"** across all apps (navbars, titles, login, "Ask Manhaji", "Drafted by Manhaji", AI self-name). Internal identifiers/packages/CSS classes still say "manhaj" (not user-visible; bigger refactor deferred).
- **"OR" pattern** throughout: DB-first, demo-fallback only when a table is empty — nothing silently dead.
- **`tsconfig.tsbuildinfo`** untracked + gitignored (all 5 apps).
- **Build breakages fixed during integration** (these only appear when everything is combined; each isolated build passed): student `@/app/actions/*` → relative imports (the `@/` alias doesn't resolve in portal re-exports); `xlsx` added as a portal dependency; restored a CSS comment `/*` opener dropped at a merge seam; reports portal re-exports declare `dynamic` statically instead of re-exporting it. **`apps/portal` `next build` now passes (verified locally).**
- **Cover-planner Vercel fix:** `outputFileTracingIncludes` in admin + portal `next.config.ts` traces `cover_plans.json`/`bells.json` into the schedule route's serverless function (it was `fs`-reading a file that wasn't bundled).

## 7. Manual-verify checklist (please do a pass on the Vercel preview)

The build agents **could not reach the live DB** (no anon key locally), so all write paths are **code-verified against the live schema but not click-tested**. Please click-through on the PR preview (or the PM will, and note results):
- **Admin:** Faculty filter/top-10; Students → Export list downloads an XLSX of the filter; Admissions → Add applicant (with parent search + create-new), Confirm-No-Re-enrollment, CSV; Reports → generate R1 (renders), internal report (charts), Recent-submission download.
- **Teacher (Swart):** One-tap attendance → tap some absent → **Submit → reload → absences persisted** (the bug that was fixed); Rubric → pick section → score → save → reload; Class hub → Next week → save plan + checklist; Add follow-up → appears; check the substitute sheet shows it.
- **Parent (Azrin):** Reply-to-school; Permission slip Save/Sign; Invoice Download PDF.
- **Student (Aara):** Add goal; save reflection; study-planner task check persists; Add university; save test score; request a counselor booking.

## 8. Pending Elias inputs (non-blocking for merge)
- Real **ISO parent-payment URL** (parent invoice placeholder).
- **Fee-rule** confirmation (2 vs 3 years between fee approvals) for the reports tooling.
- **R1 Annual Report template** + the 6 ministry-pack documents — requested via the ISO data-request **addendum** (`04 Customers/ISO/…Addendum…`). The R1 generator matches Art. 49's content list; the school's last filed copy pins the exact layout.

## 9. Deferred (agreed P2/P3 — logged, not in this PR)
Student homework-submission portal (P3); AI summaries / goal-suggestion linking (P2/P3); university entrance-criteria research DB (P2/P3, pre-go-live); advisor master-docs upload surface (P2); performance-composite live wiring (on grades arrival); calendar-integrated counselor booking (P2); regenerating the generated Supabase types (hand-patched for 020 — cosmetic follow-up); back-filling the `admin_corrections` migration file.
