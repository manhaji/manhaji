# Manhaj — Build & Architecture Session Log

## Overview
Multi-session conversation covering Vercel build fixes, a full single-deployment architecture overhaul, auth gate, UI polish, mobile responsiveness, Supabase schema design, RLS/JWT auth, and full Phase 1 database migration aligned with spec PDFs.

---

## 1. Vercel Build Fixes

**Problem:** Turbo workspace resolution failing — missing `package-lock.json` and `packageManager` field.
**Fix:** Ran `npm install` to generate lockfile. Cleaned unused deps from `packages/ui` and `packages/lib`.

**Problem:** Vercel auto-detects `turbo.json` and overrides build command to `turbo run build`.
**Fix:** Explicitly set Build Command to `next build` in Vercel project settings.

**Problem:** `middleware` export deprecated in Next.js 16.
**Fix:** Renamed `middleware.ts` → `proxy.ts`, renamed exported function to `proxy`.

---

## 2. Environment Variables

Removed `NEXT_PUBLIC_` prefix from all variables project-wide.
- `NEXT_PUBLIC_` bakes values into the client bundle at build time.
- Server-only vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) read at request time — no prefix needed.

Required Vercel env vars:
- `SESSION_SECRET` — 32+ char random string for iron-session cookie signing
- `DEMO_PASSWORD_ADMIN`, `DEMO_PASSWORD_TEACHER`, `DEMO_PASSWORD_STUDENT`, `DEMO_PASSWORD_PARENT`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `SCHOOL_NAME`, `ACADEMIC_YEAR`

---

## 3. Single-Deployment Architecture (apps/portal)

**Goal:** Merge 4 separate app deployments into one domain while keeping Turborepo monorepo and per-role code separation intact.

**Solution:** `apps/portal` — thin Next.js shell that:
- Imports from all 4 role apps via `transpilePackages` in `next.config.ts`
- Routes `/admin/*`, `/teacher/*`, `/student/*`, `/parent/*` via `proxy.ts` middleware
- Hosts login, demo picker, and shared layout

**Key files:**
- `apps/portal/proxy.ts` — role-based routing using `unsealData` (Edge Runtime compatible)
- `apps/portal/app/layout.tsx` — root layout, imports shared CSS
- `apps/portal/app/admin/layout.tsx` — admin shell with AdminNav, LogoutButton, AskManhajDrawer
- `apps/portal/app/teacher/layout.tsx` — teacher shell
- `apps/portal/app/student/layout.tsx` — student shell
- `apps/portal/app/parent/layout.tsx` — parent shell
- `apps/portal/app/icon.tsx` — dynamic favicon via ImageResponse

**Nav href updates:** All nav links updated to role-prefixed paths (`/admin/...`, `/teacher/...`, etc.)

**`@/` alias fix:** `apps/parent/app/courses/page.tsx` used `@/app/actions/...` which broke when compiled by portal. Changed to relative import.

---

## 4. Auth Gate (packages/auth)

iron-session v8 — signed httpOnly cookies.

**Files:**
- `packages/auth/src/index.ts` — `login()`, `getSessionRole()`, `SESSION_OPTIONS`
- `packages/auth/src/actions.ts` — `"use server"` `logout()` server action
- `packages/auth/src/components.tsx` — `LogoutButton` with power SVG icon

**Login fix:** `ROLE_PASSWORDS` map was built at module load time with potentially undefined env vars (keys became `"undefined"`). Fixed by building the map inside `login()` at call time.

---

## 5. Demo Picker

- `apps/portal/app/demo/page.tsx` — 4 role cards (Admin, Teacher, Parent, Student), each a form
- `apps/portal/app/demo/actions.ts` — `demoLogin(role)` server action that calls `login()` with the role's password and redirects

---

## 6. Logout Button

Styled as a power icon (SVG), placed in `.top-right` of all 4 portal layouts:
- Admin / Teacher: before "AY 2026-2027"
- Student / Parent: before the user's name

CSS class `.signout-btn` in `packages/ui/src/globals.css` — circular transparent button, hover shows danger color.

`display: contents` on the form wrapper so the button doesn't break flex layout.

---

## 7. Mobile Navigation Fix

**Problem:** Fixed `height: 60px` on `.topbar` caused nav links to compress or overflow on mobile.

**Solution (packages/ui/src/globals.css):**

- `≤700px` — nav wraps to its own scrollable row below the logo:
  - `height: auto` on topbar
  - `.brand { flex-wrap: wrap }` — logo+name on row 1, nav on row 2
  - `.nav { flex: 0 0 calc(100vw - 32px) }` — nav spans full topbar width so fade reaches near the avatar
  - `mask-image` fade from 88%→100% gives visual scroll hint
  - `min-width: 0` on brand and nav (critical — without this, flex doesn't constrain the nav)
  - `.brand-sub` hidden on mobile to save space
  - `.top-right { background: #fff; z-index: 1 }` — covers nav border overlap zone

- `701px–1100px` — single-row topbar kept, nav scrolls in place:
  - `min-width: 0` on brand and nav
  - `overflow-x: auto` on nav
  - `flex-shrink: 0; white-space: nowrap` on links

---

## 8. Ask Manhaj Drawer

`apps/admin/app/components/AskManhajDrawer.tsx` — floating chat launcher + slide-in panel.

- Button: `position: fixed; right: 20px; bottom: 20px; z-index: 50` (follows viewport)
- Drawer: slides in from right, full height, `max-width: 420px`
- `paddingBottom: 90px` on admin `<main>` so the fixed button never covers the last page content

---

## 9. Supabase Schema — Initial Build (001–006)

Full relational schema for the pilot school (International School of Oman).

**001_init.sql** — Core tables:
- `schools`, `academic_years` — tenant root
- `teachers`, `students`, `parents`, `student_parents` — people
- `subjects`, `course_catalog`, `elective_bundles`, `elective_options` — curriculum
- `sections`, `section_subjects`, `student_enrollments` — class structure
- `teacher_contracts`, `teacher_section_subject` — load planning (the 26-27A matrix)
- `course_selection_forms`, `course_selection_picks` — parent course selection
- `source_imports` — ETL provenance

**002_rls.sql** — Tenant isolation:
- `tenant_id()` function reads `school_id` from JWT `app_metadata`
- `set_tenant_search_path()` for future hybrid schema routing
- RLS enabled + policies on all tables. Pattern: `school_id = tenant_id()` for direct FK tables, `EXISTS (...)` join for indirect FK tables.

**003_spine.sql** — Operational tables:
- `rooms`, `terms`, `bell_periods`, `timetable_slots` — scheduling spine
- `attendance_marks` — daily attendance with `notified_parent_at`
- `assessments`, `rubrics`, `rubric_criteria`, `rubric_scores`, `assessment_results` — academic assessment
- `lessons` — lesson plan + homework tracking
- `comm_drafts`, `comm_templates`, `consent_records` — communications
- `ai_usage_ledger`, `audit_log` — usage tracking and audit trail
- `behaviour_notes` — student behaviour incidents

**004_seed_manhaj_ip.sql** — Seeds ISO school record + 2026-2027 academic year.

**005_seed_iso_pilot.sql** — Seeds teachers, subjects, sections, and teacher-section-subject load matrix from the parsed Excel workbook.

**006_section_mapping.sql** — Section code → canonical grade/stream mapping.

---

## 10. JWT / RLS Without Service Role (007_jwt_rls_no_service_role.sql)

**Goal:** Eliminate runtime dependency on `SUPABASE_SERVICE_ROLE_KEY` in the Next.js app. The key is still used by offline ETL scripts (`etl/load_to_postgres.py`, `etl/upload_source_to_supabase.py`) which run from a trusted terminal — never from the deployed app.

**Changes:**
- `user_schools` table — links `auth.users` to manhaj schools with a `role` column (`principal | teacher | finance | admin`)
- `auto_link_new_user_to_iso()` trigger — auto-links every new auth user to ISO during single-tenant pilot. To be swapped for invitation-based flow at scale.
- `add_school_id_to_jwt(event jsonb)` — Supabase Custom Access Token Hook. Injects `school_id` into JWT `app_metadata`. Must be wired in Dashboard → Auth → Hooks → Customize Access Token (JWT) Claims → pick `public.add_school_id_to_jwt`.
- `manhaj_public_counts(school_name)` — SECURITY DEFINER RPC for landing-page stat tiles. Anonymous-callable via anon key.
- `submit_course_selection_public(...)` — SECURITY DEFINER RPC for anonymous parent course-selection. Validates input, upserts student + form, replaces picks atomically. No service-role needed.

**After this migration:** The app reads/writes via the user's JWT. RLS scopes to their `school_id` automatically. `packages/lib/src/supabase.ts` exports `browserClient()` and `serverClient()` — both use the anon key + user JWT, not service-role.

**Note on SUPABASE_SERVICE_ROLE_KEY:** It is still listed in Vercel env vars (§2) for reference and for any future server-side admin operations, but it is NOT used in any Next.js route or server action. Only ETL scripts use it.

---

## 11. Phase 1 Schema Migration (phase1_schema — applied 2026-06-25)

Full Phase 1 scope covering 4 archetypes: Admin (A1–A8), Teacher (T1/T2/T3/T6), Parent (P1/P4/P5/P6), Student (S1/S2/S3). Applied via Supabase MCP.

**New enum types (17):**
`user_role`, `admin_role`, `invitation_status`, `absence_reason`, `absence_status`, `applicant_status`, `risk_level`, `goal_status` (later corrected in §13), `goal_kind`, `goal_created_by`, `university_app_status`, `slip_status`, `invoice_status`, `lesson_plan_kind`, `regulatory_report_kind`, `report_submission_status`, `notification_kind`

**Extended enums:** `consent_kind` += `trip_photography`, `trip_participation`

**Existing tables altered:**
- `teachers` — added: `user_id` (→ auth.users), `phone_e164`, `email`, `avatar_url`, `hire_date`, `is_form_teacher`, `qualifications`
- `students` — added: `user_id`, `photo_url`, `current_section_id`, `current_ay_id`, `notes`
- `parents` — added: `user_id`, `avatar_url`, `verified_at`
- `user_schools` — added: `display_role` (user_role enum)
- `sections` — added: `room_id`, `form_teacher_id`
- `lessons` — added: `plan_kind` (lesson_plan_kind), `homework_description`, `homework_due_date`, `cover_teacher_id`
- `attendance_marks` — added: `notified_parent_at`, `notified_channel`

**FK fix:** `course_selection_forms.locked_by_admin_id` now → `school_admins(id)` (was → `teachers`)

**New tables (24):**
`school_admins`, `invitations`, `announcements`, `ai_briefings`, `staff_absences`, `substitutions`, `job_postings`, `applicants`, `risk_flags`, `lesson_followups`, `permission_slips` (later renamed → `activities`), `permission_slip_responses` (later renamed → `permission_slips`), `invoices`, `invoice_line_items` (later renamed → `invoice_lines`), `student_goals`, `goal_checkins`, `goal_reflections`, `study_blocks`, `university_profiles` (later dropped), `student_test_scores`, `university_applications` (later renamed → `applications`), `regulatory_report_catalog`, `report_submissions`, `notifications`

---

## 12. Phase 1 Gap Analysis (2026-06-28)

Deep comparison of all 5 Phase 1 spec PDFs against the live database. Found significant gaps.

**Missing tables (9):**
1. `staffing_categories` — teacher workload category list; `teachers.staffing_category_id` should FK here
2. `substitute_sheets` — generated sub handoff PDF artifact with `staff_absence_id`, `for_date`, `sub_teacher_id`, `pdf_path`, `version`, `ack_at`
3. `activities` — trip/event definitions (what `permission_slips` was incorrectly named); drives P4 permission slip dropdown
4. `student_health` — medical system-of-record: allergies, conditions, medications, emergency contacts, `consent_emergency_care`
5. `report_archive` — past report storage with retention/deletion clock (`delete_after`, `deleted_at`); different from `report_submissions`
6. `application_grades` — predicted + actual exam scores with validation workflow (`validated_by`, `validated_on`)
7. `personal_statements` — university PS drafts with versioning and counsellor review
8. `teacher_references` — reference letters; base + adapted per-application variants
9. `university_outcomes` — historic + benchmark admission data powering "students like you" panel

**Missing columns on existing tables:**
- `teachers.staffing_category_id`
- `students.advisor_id` (at-risk flag owner), `withdrawn_reason`
- `lessons.planned_for_week` (Monday-normalised date)
- `staff_absences.sub_teacher_id`
- `school_admins.invited_by`
- `invoices.parent_id`, `reference_code` (bank transfer code, e.g. ISO-ALHABSI-L10)

**Wrong enums / column names:**
- `student_goals.status` was `active/achieved/dropped` → spec requires `on_track/at_risk/met/missed`
- `student_goals` missing `metric` (goal_metric_kind) and `target_value` (numeric); `target_date` → `due_on`
- `goal_checkins` missing `value` (numeric) and `source` (student/auto); `checked_at` → `checked_on` (date, not timestamptz)
- `goal_reflections.reflection_text` → `body`; missing `month` (date) and `audience`
- `study_blocks` was recurring schedule (`day_of_week`, `recurs_weekly`) → spec wants dated blocks (`block_date`, `kind`, `origin`)

**Naming mismatches:**
- `permission_slips` → should be `activities` (event definitions)
- `permission_slip_responses` → should be `permission_slips` (per-student consent row)
- `invoice_line_items` → should be `invoice_lines`
- `university_applications` → should be `applications` (also missing `fit_tag`, `docs_done`, `docs_total`)
- `university_profiles` — not in spec at all; dropped

---

## 13. Phase 1 Corrections Migration (phase1_corrections — applied 2026-06-28)

Applied all fixes from the gap analysis. Database is now fully aligned with spec PDFs.

**Enum fix:**
- `goal_status`: dropped old type (`active/achieved/dropped`), recreated as `on_track | at_risk | met | missed`

**12 new enum types added:**
`activity_kind`, `study_block_kind`, `study_block_origin`, `goal_metric_kind`, `goal_checkin_source`, `ps_status`, `ref_kind`, `ref_status`, `grade_kind`, `report_archive_kind`, `report_archive_scope`, `outcome_kind`

**Table renames + column additions:**
- `permission_slips` → `activities` (added `kind`, `grade_level`, `depart_time`, `return_time`, `transport`, `supervisor_ratio`, `curriculum_link`, `risk_pdf_path`; renamed `event_date` → `activity_date`)
- `permission_slip_responses` → `permission_slips` (FK column `slip_id` → `activity_id`)
- `invoice_line_items` → `invoice_lines`
- `university_applications` → `applications` (added `fit_tag`, `docs_done`, `docs_total`)

**Table dropped:** `university_profiles`

**Columns added to existing tables:**
- `teachers.staffing_category_id` (FK → `staffing_categories`)
- `students.advisor_id`, `withdrawn_reason`
- `lessons.planned_for_week`
- `staff_absences.sub_teacher_id`
- `school_admins.invited_by`
- `invoices.parent_id`, `reference_code`
- `student_goals`: `metric`, `target_value`; renamed `target_date` → `due_on`
- `goal_checkins`: `value`, `source`; renamed `checked_at` → `checked_on` (type changed to date)
- `goal_reflections`: `month`, `audience`; renamed `reflection_text` → `body`
- `study_blocks`: `block_date`, `kind`, `origin`; dropped `day_of_week`, `recurs_weekly`

**9 new tables created:**
`staffing_categories`, `substitute_sheets`, `student_health`, `report_archive`, `application_grades`, `personal_statements`, `teacher_references`, `university_outcomes` — all with RLS + tenant isolation policy.

**Final DB state: 67 tables, 40+ enum types, full RLS. Fully aligned with Phase 1 spec PDFs.**

---

## Current Database — Table Reference (67 tables)

```
academic_years          activities              ai_briefings
ai_usage_ledger         announcements           applicants
application_grades      applications            assessment_results
assessments             attendance_marks        audit_log
behaviour_notes         bell_periods            comm_drafts
comm_templates          consent_records         course_catalog
course_selection_forms  course_selection_picks  elective_bundles
elective_options        goal_checkins           goal_reflections
invitations             invoice_lines           invoices
job_postings            lesson_followups        lessons
notifications           parents                 permission_slips
personal_statements     regulatory_report_catalog  report_archive
report_submissions      risk_flags              rooms
rubric_criteria         rubric_scores           rubrics
school_admins           schools                 section_subjects
sections                source_imports          staff_absences
staffing_categories     student_enrollments     student_goals
student_health          student_parents         student_test_scores
students                study_blocks            subjects
substitute_sheets       substitutions           teacher_contracts
teacher_references      teacher_section_subject teachers
terms                   timetable_slots         university_outcomes
user_schools
```

---

## Schema Files (schema/)

| File | Status | Description |
|------|--------|-------------|
| 001_init.sql | Applied | Core schema: schools, people, curriculum, load matrix |
| 002_rls.sql | Applied | RLS enable + tenant_id() + policies |
| 003_spine.sql | Applied | Scheduling spine, attendance, assessments, audit |
| 004_seed_manhaj_ip.sql | Applied | Seed ISO school + AY |
| 005_seed_iso_pilot.sql | Applied | Seed teachers, subjects, sections, load matrix |
| 006_section_mapping.sql | Applied | Section code mapping |
| 007_jwt_rls_no_service_role.sql | Applied | JWT hook, user_schools, public RPCs |
| 008_demo_dashboard_rpc.sql | Applied | Demo dashboard aggregate RPC |
| 009_section_mapping_save.sql | Applied | Section mapping save RPC |
| 010_messages.sql | Applied | Messages/comm system |
| 011_phase1_schema.sql | Applied | 24 new tables, 17 enums, Phase 1 coverage |
| 012_phase1_corrections.sql | Applied | Gap fixes: 9 new tables, renames, enum fixes |
| 013_admin_sweep_corrections.sql | Applied | school_admins.status, report_archive FKs |
| 014_parent_sweep_corrections.sql | Applied | slip_status enum, invoice enum + columns, AED rename |
| 015_student_sweep_corrections.sql | Applied | applications.course, app_grades additions, ref_kind |
| 016_teacher_sweep_corrections.sql | Applied | rubric_criteria.ai_suggested, rubric_scores.source, followups |
| 017_table_comments.sql | Applied | COMMENT ON TABLE for all 57 previously undescribed tables |

**Note:** Migrations 001–010 had `.sql` source files in `schema/` from the start. Migrations 011 and 012 were initially applied only via Supabase MCP with no SQL files; during the project code audit (§14) they were extracted and committed as `schema/011_phase1_schema.sql` and `schema/012_phase1_corrections.sql`. All 17 migrations now have readable SQL files in `schema/`.

---

## 14. Project Code Audit + Pre-Push Fixes (2026-06-28)

Before writing any backend code, a complete audit of the project folder was done to prepare it for multi-developer use (sharing the repo on GitHub so other developers can contribute alongside Claude). Seven issues were found and fixed.

### Issues found (7 points)

**1. CI pipeline broken** — `.github/workflows/ci.yml` had `working-directory: apps/web`. That directory does not exist. Every PR was failing immediately on install. Correct target is `apps/portal`.

**2. CONTRIBUTING.md referenced `apps/web`** — Told developers to `cd apps/web` and run commands from there. Same wrong path; would confuse every new developer on first clone.

**3. Mockups duplicated 4×** — `public/mockups/` folder was copied identically into all 4 role apps (admin/teacher/parent/student) plus in portal. ~100 MB of duplicate static assets checked into the repo.

**4. `.mcp.json` gitignored** — The MCP server config was excluded from git, so new developers who cloned the repo couldn't see the connection format or know MCP was in use.

**5. `phase1_schema` and `phase1_corrections` had no SQL files** — Both migrations were applied directly via Supabase MCP with no corresponding files in `schema/`. A new developer reading the repo had no way to understand what those migrations did without logging into Supabase.

**6. No TypeScript types** — `browserClient()` and `serverClient()` used `createClient<any>` (no type parameter). No autocomplete or compile-time type checking for any DB query.

**7. No Supabase CLI / local DB** — Not a bug, but a decision point: keep MCP-only or set up local Docker stack per developer.

### Fixes applied

1. ✅ **CI fixed** — `ci.yml` rewritten to install from monorepo root, run `npx turbo lint`, `npx turbo test`, `npx turbo build --filter=@manhaj/portal`.
2. ✅ **CONTRIBUTING.md fixed** — Updated to `npx turbo` commands from repo root, matching actual CI.
3. ✅ **Mockups consolidated** — Single canonical copy at `apps/portal/public/mockups/` (served as `/mockups/`). Removed from all 4 role apps.
4. ✅ **`.mcp.json` unblocked** — Line in `.gitignore` commented out. Developers who clone get the MCP config and can fill in their own credentials.
5. ✅ **SQL files extracted** — `schema/011_phase1_schema.sql` and `schema/012_phase1_corrections.sql` written from the live DB state. Schema history in `schema/` is now complete and readable (001–012 at this point).
6. ✅ **TypeScript types generated** — `packages/lib/src/types/supabase.ts` generated via `mcp__supabase__generate_typescript_types` (134K chars, all 67 tables + enums). Both `browserClient()` and `serverClient()` typed as `createClient<Database>`. `Database` type re-exported from `@manhaj/lib` for use across all apps.
7. ✅ **MCP-only decision made** — No local Supabase CLI / Docker stack. SQL files in `schema/` are the human-readable source of truth; every migration is applied via MCP and committed as a numbered file.

**Verdict after fixes:** Ready to share. New developer can clone, read `CONTRIBUTING.md`, run three turbo commands, open a PR, and CI passes.

---

## 15. Backend Baseline Structure (2026-06-28)

### Architecture decision

Server actions (write operations) live in `apps/portal/app/{role}/_actions/` — NOT in a separate package and NOT in the 4 non-deployed role apps. Reasons:

- `apps/portal` is the only deployed app; Next.js server actions are tied to its App Router runtime
- The other 4 apps (admin/teacher/parent/student) are component source only — they don't run a server
- The `_` prefix excludes the folder from Next.js routing (App Router convention); files inside are invisible to the URL system

Reusable **DB read helpers** shared across 2+ archetypes go in `packages/lib/src/queries/` — a shared package that every app can import.

### Server action scaffold created

```
apps/portal/app/
├── admin/_actions/
│   ├── admins.ts        — invite admin (insert school_admins + invitations), deactivate (set status = inactive)
│   ├── students.ts      — CRUD (update enrollment, convert applicant → student), withdraw
│   ├── faculty.ts       — create/update teacher_contracts, approve/reject staff_absences, assign substitute
│   ├── schedule.ts      — upsert timetable_slots, generate substitute_sheets
│   ├── reports.ts       — create/send comm_drafts, archive report, update report_submissions
│   └── applicants.ts    — update applicant stage, admit (convert to student)
├── teacher/_actions/
│   ├── attendance.ts    — upsertAttendanceMark(sectionId, date, period, studentId, status), bulkUpsertAttendance
│   ├── rubric.ts        — upsertRubricScore (axis, month, score, source), flagCriterionAiSuggested, createRubricCriterion
│   ├── lessons.ts       — upsertLessonPlan (plan_kind, topic, resources), saveLessonSummary (held_on, notes)
│   ├── followups.ts     — createLessonFollowup (tag, student_id, note), completeLessonFollowup (set is_done), updateFollowupTag
│   └── goals.ts         — setStudentGoal, updateGoalStatus (teacher side)
├── parent/_actions/
│   └── permission-slips.ts — signPermissionSlip (sets signed_by_parent_id + signed_name + signed_at), declinePermissionSlip
└── student/_actions/
    ├── goals.ts          — createStudentGoal, checkInGoal (insert goal_checkins), reflectOnGoal (insert goal_reflections)
    ├── study-blocks.ts   — upsertStudyBlock (drag-and-drop persist), deleteStudyBlock
    └── applications.ts   — addUniversityApplication, updateApplicationStatus, addApplicationGrade, upsertPersonalStatementDraft
```

### Initial shared queries written

Three query files in `packages/lib/src/queries/` were created as part of the baseline (before the full frontend wiring session):

- `queries/students.ts` — `getStudentsBySection`, `getStudentWithEnrollment`, `getStudentsWithRiskFlags`
- `queries/attendance.ts` — `getAttendanceForSection`, `getAttendanceSummaryForStudent`, `getAbsencesRequiringCoverage`
- `queries/sections.ts` — `getSectionsForTeacher`, `getSectionWithStudents`, `getMappedSections`

### Scope at this point (~15% of full backend)

The scaffold established the pattern and covered the highest-traffic write paths. Remaining work called out explicitly: ~50 more action functions, ~15 more query helpers, and 4–5 complex orchestration flows (timetable solver, substitute finder, AI usage ledger writes, comm pipeline with Resend dispatch, report retention clock on `delete_after`).

---

## 16. Demo Auth Users — Supabase (2026-06-29)

Four Supabase `auth.users` records created with hardcoded demo passwords, so RLS policies are satisfied when a demo user is active (the old iron-session-only flow had no JWT → `tenant_id()` returned null → all DB queries were blocked by RLS).

| Auth email | Auth UUID prefix | Password | Public record |
|---|---|---|---|
| demo-admin@manhaj.school | a0000000…001 | manhaj-admin | school_admins: Dr. Nadia Al-Farsi |
| demo-teacher@manhaj.school | a0000000…002 | manhaj-teacher | teachers: Sandra Swart |
| demo-student@manhaj.school | a0000000…003 | manhaj-student | students: Omar Al-Rashidi |
| demo-parent@manhaj.school | a0000000…004 | manhaj-parent | parents: Amina Al-Rashidi |

All four users have `raw_app_meta_data = {"school_id": "94e4ca02-4c4e-4b54-86e7-6790b185a547"}` so `tenant_id()` resolves correctly in every RLS policy.

Every public record (`school_admins`, `teachers`, `students`, `parents`) has `user_id` set to the corresponding auth user UUID so `getCurrentTeacherId()` / `getCurrentStudentId()` / `getCurrentParentId()` resolve correctly.

**`apps/portal/app/demo/actions.ts`** — `demoLogin(role)` now calls both:
1. `login(PASSWORDS[role])` — sets iron-session role cookie (routing gate)
2. `db.auth.signInWithPassword({ email: EMAILS[role], password: PASSWORDS[role] })` — sets Supabase JWT cookie (RLS gate)

---

## 17. Demo Seed Data (2026-06-29)

All seed data inserted via Supabase MCP `execute_sql`. School ID: `94e4ca02-4c4e-4b54-86e7-6790b185a547`. Academic year ID: `15c65b07-c1ba-4c64-9c04-07fe3a43fc88`. Student/teacher IDs use `b0000000-0000-0000-0000-0000000000XX` pattern; other students use `c0000000-0000-0000-0000-0000000000XX`.

### People

**sections** (updated `current_section_id`):
- 10A: `26177965-2bf8-4855-a055-e0cf32370e99` — 14 students
- 9A: `d8a6e62d-64eb-4581-9aa6-18147f95b92e` — 6 students
- 11 AS: `3ced72e3-a4a2-415b-a041-3914da6fdf1b` — 1 student (Layla)
- 12 A2: `bcfb0786-4f0d-435b-911e-daf76e296619`

**students** (21 total):
- 10A (14): Ahmed Mansour, Ali Al-Kindi, Fatima Al-Balushi, Huda Al-Siyabi, Khalid Al-Marzouqi, Khalil Ibrahim, Lena Habboubi, Maryam Al-Wahaibi, Nadia Hassan, Omar Al-Rashidi, Rania Khalifa, Sara Al-Tamimi, Tariq Said, Yousef Al-Amin
- 9A (6): Afra Al-Hinai, Hala Mohsen, Ibrahim Al-Rawahi, Marwa Al-Khatib, Yusuf Al-Zaabi, Ziad Nasser
- 11 AS (1): Layla Al-Rashidi

**student_parents**: Amina Al-Rashidi → Omar Al-Rashidi

### Schedule

**bell_periods** — 8 periods (P1–P8) seeded for 10A section, Mon–Fri.

**teacher_section_subject** — Sandra Swart linked to 10A History, 10A Geography/SSE, 10A MUN, 9A History, 11 AS English, 12 A2 English.

**timetable_slots** — Week slots for Sandra's sections wired to bell periods.

### Lessons + Homework

5 lessons for 10A, all with `homework_description` and `homework_due_date` (Jul 1–3, 2026 — within the student homework page's query window of ±4 weeks from today):
1. The Magna Carta and constitutional limits (History)
2. Persuasive writing — structure and techniques (English)
3. Rise of constitutional monarchies in Europe (History)
4. Reading comprehension — The Great Gatsby extract (English)
5. Industrial Revolution — social impact (History, 9A)

### Invoices

2 invoices for Amina Al-Rashidi (parent_id = `b0000000…005`):
- Term 3 Tuition — AED 8,500 (paid)
- School Trip Deposit — AED 150 (outstanding)

With line items in `invoice_lines`.

### Rubrics + Scores (Omar Al-Rashidi)

1 rubric: "Manhaj Core Rubric" (`3a000000-0000-0000-0000-000000000001`)

25 rubric_scores: 5 axes (analytical, written, oral, research, participation) × 5 months (Feb–Jun 2026). Scores show upward improvement arc (2.5→3.8 range), scored by Sandra Swart.

### Student Goals + Check-ins (Omar)

3 student_goals:
1. Reach 80% on History essay (academic, metric: assessment_pct, target: 80)
2. Maintain 95%+ attendance (personal)
3. Raise oral participation rubric to 3.8 (academic, metric: rubric_axis, target: 3.8)

5 goal_checkins across the 3 goals (Mar–Jun 2026), all source: `auto`.

### Report Archive

3 entries for Omar / Amina:
1. Q1 Parent Digest (sent Apr 2026)
2. Absence Summary May (sent May 2026)
3. Fee Statement Jun (generated, not yet sent)

### Risk Flags (3)

| Student | Severity | Category | Status |
|---|---|---|---|
| Khalid Al-Marzouqi | high | attendance | open |
| Hala Mohsen | high | attendance | in_progress |
| Rania Khalifa | medium | academic | open |

### Attendance Marks (400 rows)

Generated via `generate_series` CTE for 20 school days (Mon 2 Jun – Fri 26 Jun 2026):
- 10A: 14 students × 20 days = 280 rows. Khalid Al-Marzouqi absent 11 days (Jun 1–3, 5, 8–10, 12, 15–17).
- 9A: 6 students × 20 days = 120 rows. Hala Mohsen absent 15 days (Jun 1–5, 8–12, 15–19).
- All other students: `present`.

### Assessments + Results (teacher page)

4 assessments (Sandra Swart, `teacher_id = b0000000…002`):

| Label | Section | Subject | Submitted | Avg score |
|---|---|---|---|---|
| Y10 Essay — Rise of Constitutional Monarchies | 10A | History | 13/14 | 74% |
| Map Analysis Task — Geopolitical Zones | 10A | Social Studies (English) | 12/14 | 69% |
| Chapter 5 Quiz — Industrial Revolution | 9A | History | 6/6 | 81% |
| Position Paper Draft — UNSC | 10A | English | 14/14 | 88% |

45 `assessment_results` rows (CTE inserts per assessment). Khalid excluded from History/SSE (absent), included in MUN.

### Activities (Parent Calendar — 6 events)

| Title | Date | Kind |
|---|---|---|
| Year 10 History Field Trip — Bait Al Zubair Museum | 2026-05-15 | trip |
| School Sports Day | 2026-06-05 | event |
| Parent–Teacher Meeting Term 3 | 2026-06-12 | event |
| End of Year Assembly | 2026-07-03 | event |
| MUN Workshop — Sustainable Development Goals | 2026-07-08 | workshop |
| Summer School Registration Deadline | 2026-07-15 | event |

---

## 18. Teacher Page — Live Assessments Query (2026-06-29)

The hardcoded `ASSESSMENTS` constant in `apps/teacher/app/page.tsx` was replaced with a real DB query.

**New file:** `packages/lib/src/queries/assessments.ts`
- `getAssessmentsForTeacher(teacherId, sectionIds, limit)` — queries `assessments` with embedded `sections`, `subjects`, `assessment_results`; returns `TeacherAssessmentRaw[]` with `submitted_count` and `avg_score`.

**`apps/teacher/app/page.tsx` changes:**
- Removed hardcoded `ASSESSMENTS` array
- Added call to `getAssessmentsForTeacher(teacherId, sectionIds)`
- Built `sectionCountMap` from existing `students` array to compute `pct_submitted` percentage
- JSX table now maps over live `assessments` data

---

## 19. Real Login Screen (2026-06-29)

Replaced the single-password demo gate on the main login screen with a proper Supabase-backed login page. No sign-up (accounts are created by admin invitation, not self-service).

### New login UI (`apps/portal/app/login/page.tsx`)

Two sign-in paths in a single card:
1. **Email + password** — standard form with `Sign in` button
2. **Magic link** — email field with `Send magic link` button. After sending, the form is replaced by a green "Check your inbox" confirmation panel.

Error states: `credentials` (wrong email/password), `norole` (user not in any role table), `missing` (empty fields), `magic` (OTP send failed), `callback` (expired/invalid link).

`Demo Picker →` link preserved at the bottom.

### Server actions (`apps/portal/app/login/actions.ts`)

- **`loginWithPassword(formData)`** — calls `supabase.auth.signInWithPassword()`, then `getRoleForUser()` to determine the role, then `setSessionRole()` to write iron-session, then redirects to `/{role}`.
- **`sendMagicLink(formData)`** — calls `supabase.auth.signInWithOtp({ email, emailRedirectTo: origin + '/auth/callback' })`. The `origin` is read from the `origin` request header (works on Vercel and localhost).

### Magic link callback (`apps/portal/app/auth/callback/route.ts`)

New GET route handler. Exchanges the `?code=` param for a Supabase session via `exchangeCodeForSession()`, looks up the user's role, sets iron-session, redirects to `/{role}`. Falls back to `/login?error=callback` on failure.

### Auth package additions (`packages/auth/src/index.ts`)

- `SessionData.authMode` extended to `"demo" | "supabase"`
- **`setSessionRole(role)`** — writes iron-session directly without needing a password. Used by both real login paths (password and magic link) so they can set the role cookie after Supabase auth.

### Role resolver (`packages/lib/src/queries/auth.ts`)

- **`getRoleForUser(userId)`** — runs four parallel `maybeSingle()` queries against `school_admins`, `teachers`, `students`, `parents` filtered by `user_id`; returns the first matching role or `null` if the user is not in the system.

### Logout update (`packages/auth/src/actions.ts`)

`logout()` now also deletes all Supabase `sb-*` session cookies before destroying the iron-session cookie, so both auth layers are cleared on sign-out.

---

## Data Visible Per Role (as of 2026-06-29)

| Role | Real DB data shown |
|---|---|
| **Admin** (Dr. Nadia) | Attendance trend (400 marks), 21 students, 3 risk flags, 4 assessments with stats, timetable, Sandra in faculty |
| **Teacher** (Sandra Swart) | 20 students across 10A/9A, 4 real assessments with live submission rates + avg scores |
| **Student** (Omar Al-Rashidi) | 5 homework items (due Jul 1–3), rubric scores Feb–Jun (upward arc), 3 goals + check-ins, 10A timetable, 3 archived reports |
| **Parent** (Amina Al-Rashidi) | 2 invoices with line items, 6 calendar events (past + upcoming), 3 archived reports |

---

## 20. Per-App Sweep Corrections (Migrations 013–017, applied 2026-06-28/29)

Each migration was a full line-by-line sweep of one spec PDF against the live DB. Only genuine gaps were fixed — tables that were already aligned are listed in each file's header comment and left untouched.

**Schema files:** `schema/013_admin_sweep_corrections.sql` through `schema/017_table_comments.sql` — all exist as `.sql` files on disk (unlike 011/012 which were applied only via MCP).

---

### 013 — Admin sweep (`013_admin_sweep_corrections.sql`)

Two gaps found vs `handover_phase1_admin.pdf`:

- **`school_admins.status text CHECK ('active'|'pending'|'inactive')`** — `is_active boolean` can't represent the pending-invite state the spec explicitly requires. Added `status`, seeded `inactive` from `is_active = false`. Both columns kept for now.
- **`report_archive.student_id` + `parent_id`** (FK → `students` / `parents`, nullable) — spec §8: "archived with the same student_id / parent_id so 'what did this family receive, and when' is answerable." The generic `scope_ref_id` is kept for school/section-scoped reports.

---

### 014 — Parent sweep (`014_parent_sweep_corrections.sql`)

Four gaps found vs `handover_phase1_parent.pdf`. No `_omr` columns after this migration.

- **`slip_status` enum replaced** — old: `pending/approved/rejected/cancelled`. New: `not_started/draft/signed/declined` (spec §P4 terminology). Existing rows migrated (approved→signed, rejected/cancelled→declined).
- **`permission_slips` signature columns added** — `signed_by_parent_id` (FK → `parents`, may differ from `parent_id` if another parent signs), `signed_name` (typed legal signature), `signed_at` (timestamptz — distinct from `responded_at` which covers declines too).
- **`activities.cost_omr` → `cost_aed`** — spec data uses AED amounts (35, 40).
- **`invoice_status` enum replaced** — old: `draft/sent/paid/overdue/cancelled/refunded`. New: `draft/unpaid/paid/overdue/partial/cancelled`. `sent` → `unpaid` (spec term); `partial` added (school fee installments); `refunded` dropped (Manhaj is display-only over school billing; refunds live in the school's own system).
- **`invoices.what_for text`** added — parent-facing label ("Term 3 · Installment 3 of 4").
- **`invoices.total_omr` → `amount_owed_aed`**.
- **`invoice_lines`**: dropped `quantity` + `unit_price_omr` (school fee lines are flat amounts, not retail qty×price); added `amount_aed numeric NOT NULL DEFAULT 0`.

---

### 015 — Student sweep (`015_student_sweep_corrections.sql`)

Three gaps found vs `handover_phase1_student.pdf`:

- **`applications.program` → `course`** — spec data table uses "course" throughout.
- **`university_app_status` enum replaced** — old: `planning/applied/offer_received/accepted/rejected/deferred/withdrawn`. New: `researching/in_progress/submitted/interview/admitted/rejected/withdrawn`. Adds `in_progress` and `interview` stages; removes `deferred` (not in spec pipeline); collapses `offer_received`+`accepted` → `admitted`. Existing rows migrated.
- **`application_grades` additions** — `value text` (unified display string: "43/45", "1480/1600", "8.0/9" — spec's primary display field); `student_id UUID → students` (avoids join through application for student-level grade queries); `application_id` made nullable (grades that apply to all applications, e.g. IB predicted total).
- **`teacher_references.ref_kind`**: enum → `text` — old enum (`ucas/common_app/direct/other`) described application *system*, not letter *nature*. Spec uses "academic (maths)", "personal". Free-form text accommodates this.

---

### 016 — Teacher sweep (`016_teacher_sweep_corrections.sql`)

Three gaps found vs `handover_phase1_teacher.pdf`:

- **`rubric_criteria.ai_suggested boolean NOT NULL DEFAULT false`** — spec data table shows 4 data-led axes (analytical, creative, written, homework) as AI-suggested and 2 pure-judgement axes (oral, participation) as not. Flag controls which axes the AI call auto-proposes vs leaves blank for teacher observation.
- **`rubric_scores.source text`** — audit trail per score: "AI-proposed, confirmed" / "AI-proposed, adjusted ↑" / "judgement" / "judgement + note". Feeds AI cost reconciliation against `ai_usage_ledger`.
- **`lesson_followups` additions** — `tag text` (priority/concept/ptc/handoff — routes follow-up to the right destination); `student_id UUID → students` (links to specific student, e.g. "Catch up Khalil"); `is_done boolean NOT NULL DEFAULT false` (fast toggle the spec queries); `target_teacher_id UUID → teachers` (for handoff-tagged follow-ups routing to a named receiving teacher).

---

### 017 — Table comments (`017_table_comments.sql`)

`COMMENT ON TABLE` applied to all 57 tables that lacked a description. No schema changes. Enables Supabase Studio hover docs and Claude DB context when browsing the schema. The migration header also confirmed: **no `_omr` columns remain anywhere in the schema** after migration 014.

---

## 21. Frontend-to-DB Query Layer (`packages/lib/src/queries/`)

Twelve TypeScript files form the unified data access layer for all four role apps. All use `serverClient()` (anon key + user JWT) — RLS applies automatically. No service-role key used in any app route.

### File index

**`auth.ts`**
- `getRoleForUser(userId)` — 4 parallel `maybeSingle()` against `school_admins`, `teachers`, `students`, `parents`; returns first match or `null`. Used by password login + magic link callback.
- `getCurrentAcademicYearId()` — `academic_years` where `is_current = true`.
- `getCurrentStudentId()` / `getCurrentTeacherId()` / `getCurrentParentId()` — reads `auth.getUser()` then looks up the public table by `user_id`.

**`activities.ts`**
- `getActivitiesForYear(academicYearId)` — all activities ordered by date. Type: `ActivityEvent`.
- `getUpcomingActivities(academicYearId, from, limit)` — future-only. Parent calendar page.

**`assessments.ts`**
- `getAssessmentsForTeacher(teacherId, sectionIds, limit)` — queries `assessments` with embedded `sections`, `subjects`, `assessment_results`. Returns `TeacherAssessmentRaw[]` with `submitted_count` (raw integer) and `avg_score` (% of `max_score`). Teacher page computes `pct_submitted` using the `students` array already in scope.

**`attendance.ts`**
- `getDailyAttendanceTrend(academicYearId, from, to)` → `DailyAttendanceStat[]` — aggregates by date, `present` includes `late`. Admin dashboard chart.
- `getSectionAttendanceStats(from, to)` → `SectionAttendanceStat[]` — section-level week %. Admin KPI cards.
- `getChronicAbsentees(academicYearId, threshold)` → `ChronicAbsenteeRow[]` — students with ≥ N absences. Admin at-risk widget.
- `getAttendanceForSection(sectionId, date, period)` — teacher attendance input.
- `getAttendanceSummaryForStudent(studentId, from, to)` — student attendance history.
- `getAbsencesRequiringCoverage(sectionId, date)` — timetable slots without a substitution. Sub-sheet builder.

**`growth.ts`**
- `getRubricScoresForStudent(studentId)` → `RubricAxisScore[]` — last 120 rows (6mo × axes), grouped by `axis_code`, `this_mo`/`last_mo` extracted. Student growth radar + sparklines.
- `getGoalsForStudent(studentId, academicYearId)` → `GoalRow[]` — goals with embedded `goal_checkins`; `latest_progress` + `last_checkin` computed from the newest checkin. Student growth goals list.
- `getAssessmentResultsForStudent(studentId)` — `assessment_results` with embedded `assessments → subjects`. Student grade history.

**`invoices.ts`**
- `getInvoicesForParent(parentId)` → `InvoiceWithLines[]` — invoices with embedded `invoice_lines` sorted by `display_order`. Parent invoices page.
- `getInvoicesForStudent(studentId)` → same shape, filtered by `student_id`.

**`lessons.ts`**
- `getHomeworkForSection(sectionId, from, to)` → `HomeworkRow[]` — lessons with non-null `homework_description` and due date in window.
- `getHomeworkForStudent(studentId, from, to)` — resolves `current_section_id` then delegates to above. Student homework page.
- `getRecentLessonsForTeacher(teacherId, limit)` — last N lessons with section + subject. Teacher lesson input page.
- `getLessonsForSection(sectionId, from, to)` — full lesson records for a date range. Admin section view.

**`reports.ts`**
- `getCommDrafts(limit)` → `CommDraftRow[]` — with student + template join. Admin reports list.
- `getCommDraftPipelineCounts()` — `Record<string, number>` counts by status. Admin reports KPI banner.
- `getReportArchive(filters)` → `ReportArchiveRow[]` — filters by `student_id` or `parent_id`; excludes `deleted_at IS NOT NULL`. Student + parent "Past Reports" pages.
- `getCommTemplates()` — all templates ordered by `display_order`. Admin template picker.
- `getAuditLogRecent(limit)` — last N `audit_log` rows. Admin reports audit tab.

**`sections.ts`**
- `getSectionsForTeacher(teacherId, academicYearId)` — distinct sections via `timetable_slots`. Teacher page section filter.
- `getSectionWithStudents(sectionId)` — section + `student_enrollments → students`. Admin section drill-down.
- `getMappedSections(academicYearId)` — all sections with mapping status.

**`students.ts`**
- `getStudentsForAdmin(academicYearId)` → `AdminStudentRow[]` — non-withdrawn students with section + `risk_flags` filtered to current AY.
- `getStudentsForSections(sectionIds)` → `TeacherSectionStudentRow[]` — students in given sections with risk_flags.
- `getApplicantsForYear(academicYearId)` — admissions pipeline. Admin admissions page.
- `getBehaviourNotes(studentIds, limit)` — behaviour notes with teacher join.
- `getStudentsWithRiskFlags(academicYearId)` — uses `risk_flags!inner` join to exclude students without open flags.

**`teachers.ts`**
- `getTeachersWithLoad(academicYearId)` → `TeacherWithLoad[]` — via `teacher_contracts` with load counts. Admin faculty page.
- `getAllTeachers()` — flat list for dropdowns and substitution pickers.
- `getPendingAbsences()` — `staff_absences` with `status = 'pending'` + teacher join. Admin absence queue.
- `getApprovedAbsencesNeedingCoverage(date)` — approved absences without a `substitutions` row. Coverage gap widget.
- `getTeacherWithSections(teacherId, academicYearId)` — `teacher_section_subject` with sections + subjects. Teacher load matrix.

**`timetable.ts`**
- `getTimetableForSection(sectionId, academicYearId)` → `PeriodSlot[]` — joins all `bell_periods` (including breaks/lunch) with `timetable_slots`; slots indexed by `bell_period_id` for O(1) lookup. Student schedule page.
- `getStudentTimetable(studentId, academicYearId)` — resolves `current_section_id` then delegates to above.
- `getTeacherTimetable(teacherId, academicYearId)` → `PeriodSlot[]` — teacher's slots across all sections; `teacher` field contains section code+grade (e.g. "Grade 10 10A") rather than teacher name.
- `getSchoolTimetable(academicYearId)` — all slots with all joins. Admin timetable grid.

---

### Query consumers by app page

| Query file | App pages that import it |
|---|---|
| `auth` | `portal/login/actions`, `portal/auth/callback`, all role apps (`getCurrentXId`) |
| `reports` | `admin/reports`, `student/past-reports` (page + client + 3 components), `parent/past-reports` (page + client + 3 components) |
| `lessons` | `student/homework` (page + 4 components), `teacher/input` |
| `timetable` | `student/schedule` (page + 3 components) |
| `students` | `admin/page`, `admin/students` (page + client), `admin/faculty` (page + client), `teacher/page` |
| `growth` | `student/growth` (page + 4 components) |
| `teachers` | `admin/faculty` (page + client), `admin/page` |
| `attendance` | `admin/attendance` (page + client), `admin/page` |
| `invoices` | `parent/invoices` (page + client) |
| `assessments` | `teacher/page` |
| `activities` | `parent/calendar` |
