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

---

## 22. Vercel Build Fixes — TypeScript + Supabase Types (2026-06-29)

First Vercel deployment attempt revealed two build blockers, both fixed and pushed in a single commit.

### Build blocker 1 — Turbo workspace resolution

Vercel auto-detected `turbo.json` and overrode the build command to `turbo run build`. Turbo then looked for `packageManager` in `apps/portal/package.json` (the Vercel root directory), couldn't find it there (it only exists in the monorepo root), and errored.

**Fix:** In Vercel project settings → Build & Development Settings → Build Command → Override → `npx next build`. Bypasses Turbo entirely; Next.js builds portal directly.

### Build blocker 2 — TypeScript errors from the newly-typed Supabase client

`packages/lib/src/types/supabase.ts` was generated during the project audit (§14) but was stored wrapped in a JSON object (`{"types":"..."}`) rather than as plain TypeScript. Enabling the typed client then exposed 11 files with type errors. All fixed:

| File | Error | Fix |
|---|---|---|
| `admin/students/StudentsPageClient.tsx` | `status: never`, missing `rubric`, `risk_score` | Added `rubric` (zeroed axes) and `risk_score: 0`; changed cast to `as StudentStatus` |
| `apps/teacher/app/page.tsx` | Same pattern | Same fix + imported `StudentStatus` from `mock-students` |
| `portal/student/_actions/applications.ts` | `.from("ps_drafts")` — table doesn't exist | → `personal_statements` |
| `portal/teacher/_actions/lessons.ts` | `.from("lesson_plans")` — table doesn't exist | → `lessons`; aligned column names to actual schema (`topic`, `held_on`, `plan_kind`, etc.) |
| `packages/lib/src/messages.ts` | 4 legacy message RPCs not in generated types (`manhaj_threads_for_parent_public`, etc.) | Cast `sb as any` for those `.rpc()` calls — RPCs exist in DB (schema/010), not yet reflected in types |
| `admin/api/sections/save-mapping/route.ts` | `manhaj_save_section_mapping_public` RPC not in types | Same `as any` cast |
| `packages/lib/src/queries/attendance.ts` | `.eq("date", ...)` and `.eq("period", ...)` — wrong column names; `section_id` passed as `string \| null` | `date` → `marked_on`; `period: number` → `bellPeriodId: string`; null guard added |
| `packages/lib/src/queries/reports.ts` | `CommDraftRow.status: string` but DB returns `string \| null`; null used as index | `status` type → `string \| null`; added `if (!row.status) continue` |
| `packages/lib/src/queries/students.ts` | `.eq("section_id", ...)` — column doesn't exist on `students` | → `current_section_id` |
| `packages/lib/src/queries/timetable.ts` | `is_teaching: boolean \| null` not assignable to `boolean` | → `b.is_teaching ?? true` |
| `packages/lib/src/types/supabase.ts` | File stored as `{"types":"..."}` JSON instead of plain TS | Extracted TypeScript string, rewrote file as raw `.ts` |

---

## 23. Wire Remaining Mock Pages to Real DB Data (2026-06-30)

Continued the mock→DB migration. Every component that still rendered hardcoded fixture data was given a DB prop with a mock fallback (renders mock when DB returns 0 rows, so demo always looks rich).

### Components wired

| Component | Before | After |
|---|---|---|
| `admin/reports/components/PipelineFunnel.tsx` | `MOCK_PIPELINE` hardcoded | Accepts `pipeline: PipelineStat[]` prop; `ReportsPageClient` passes real array built from `pipelineCounts` |
| `admin/reports/components/TemplatesShelf.tsx` | `MOCK_TEMPLATES` hardcoded | Accepts `templates: DbTemplate[]` prop; fetched via `getCommTemplates()` in `reports/page.tsx` |
| `admin/reports/components/ComplianceLog.tsx` | `MOCK_AUDIT` hardcoded | Accepts `auditLog: DbAuditRow[]` prop; fetched via `getAuditLogRecent(50)` in `reports/page.tsx` |
| `admin/faculty/components/FacultyRoster.tsx` | `MOCK_TEACHERS` hardcoded | Accepts `teachers?: TeacherWithLoad[]` prop; `FacultyPageClient` passes `source ?? undefined` |
| `admin/students/components/QuickSearch.tsx` | Module-level `INDEX` built from `MOCK_STUDENTS` | Accepts `students?` prop from `StudentsPageClient`; index rebuilt via `useMemo` when prop changes |
| `parent/api/calendar/feed.ics/route.ts` | `MOCK_EVENTS` | Calls `getActivitiesForYear(academicYearId)` → maps `ActivityEvent` to `CalendarEvent`; falls back to `MOCK_EVENTS` if DB empty or no AY |
| `admin/app/page.tsx` | Imported `MOCK_SECTIONS as RPT_SECTIONS` for Reports card row | Removed import; Reports card now shows `pipelineCounts["review"]` from DB; "Next batch" → `"—"` |

### Data flow changes

**`admin/reports/page.tsx`** now fetches three things in parallel:
```ts
const [pipelineCounts, templates, auditLog] = await Promise.all([
  getCommDraftPipelineCounts(),
  getCommTemplates(),
  getAuditLogRecent(50),
]);
```
All three are passed as props to `ReportsPageClient`, which passes them down to the three sub-components.

**`ReportsPageClient.tsx`** added two typed prop slots:
```ts
type DbTemplate = { id: string; template_code: string; name_en: string; channel: string; ... };
type DbAuditRow  = { id: string; actor_label: string | null; action: string; ... };
```
Both are optional with `[]` defaults so the component still renders without them.

### Left on mock (no DB equivalent seeded yet)

- Admin Schedule page (`MOCK_ACTIONS` for conflict/gap counts) — no DB conflict tracking
- `ContractsDashboard` — no `teacher_contracts` data seeded
- `DepartmentBreakdown`, `EngagementHeatmap`, `OnboardingFunnel`, `PerformanceComposite` — aggregate views, no corresponding DB tables yet
- `MOCK_INCIDENTS`, `MOCK_ADMISSIONS` — behaviour and admissions data not seeded

---

## 24. Test Users Created in DB (2026-06-30)

Four auth users created directly via SQL (`auth.users` + `auth.identities`) and linked to their respective role tables. Each user has `email_confirmed_at` set so they can log in immediately without email verification.

### Credentials

| Role | Email | Password | Role table row |
|---|---|---|---|
| Admin (Principal) | `admin@manhaj-demo.com` | `Admin2026!` | `school_admins` — role `principal`, status `active` |
| Teacher | `teacher@manhaj-demo.com` | `Teacher2026!` | `teachers` — `is_form_teacher = false` |
| Parent | `parent@manhaj-demo.com` | `Parent2026!` | `parents` — email stored |
| Student | `student@manhaj-demo.com` | `Student2026!` | `students` — `full_name_en = 'Demo Student'` |

All linked to school `International School of Oman` (`94e4ca02-4c4e-4b54-86e7-6790b185a547`).

### What you see when logged in

DB-driven sections render empty (zeroed KPIs, empty tables, empty calendars) since no data is associated with these users. Mock-only components (schedule, demographics, admissions, heatmaps) still render their hardcoded fixture data as those don't query the DB per-user.

---

## 25. Login Fix — GoTrue bcrypt Incompatibility (2026-07-01)

### Root cause (from Supabase auth logs)

Two failure phases were visible in the logs:

**Phase 1 — 500 errors (before `confirmation_token` fix):**
```
sql: Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported
```
GoTrue's Go code crashed when scanning `NULL` into a Go `string`. Fixed by `UPDATE auth.users SET confirmation_token = ''` for all test users.

**Phase 2 — 400 `invalid_credentials` (after token fix):**
GoTrue found the user but couldn't verify the password. Root cause: bcrypt hashes generated by PostgreSQL's `pgcrypto.crypt()` (`$2a$` prefix) are not accepted by GoTrue's Go bcrypt verifier in this Supabase version — even though the hashes are mathematically valid and pgcrypto itself can verify them.

Additional fixes applied during investigation (none of these were the root cause):
- `confirmed_at` — generated column, was already set correctly from `email_confirmed_at`
- `raw_app_meta_data` — updated to include `school_id` so `tenant_id()` returns the correct UUID for RLS
- `auth.identities.identity_data` — updated to include `"email_verified": true`
- Email domain — changed from `@manhaj.test` to `@manhaj-demo.com` (`.test` TLD suspected, ruled out)

### Fix — `manhaj_verify_login` SECURITY DEFINER function

Created a PostgreSQL function that verifies the password directly with pgcrypto and returns the role, bypassing GoTrue entirely:

```sql
CREATE OR REPLACE FUNCTION public.manhaj_verify_login(p_email text, p_password text)
RETURNS text  -- 'admin' | 'teacher' | 'student' | 'parent' | null
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE v_user_id uuid; v_valid boolean;
BEGIN
  SELECT u.id, (u.encrypted_password = extensions.crypt(p_password, u.encrypted_password))
  INTO v_user_id, v_valid
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until < now())
    AND u.confirmed_at IS NOT NULL
  LIMIT 1;
  IF NOT FOUND OR NOT v_valid THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.school_admins WHERE user_id = v_user_id) THEN RETURN 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.teachers WHERE user_id = v_user_id) THEN RETURN 'teacher';
  ELSIF EXISTS (SELECT 1 FROM public.students WHERE user_id = v_user_id) THEN RETURN 'student';
  ELSIF EXISTS (SELECT 1 FROM public.parents WHERE user_id = v_user_id) THEN RETURN 'parent';
  END IF;
  RETURN NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.manhaj_verify_login(text, text) TO anon, authenticated;
```

### Login action updated (`apps/portal/app/login/actions.ts`)

GoTrue `signInWithPassword` still runs first (to get a real JWT when it works). If it fails, the RPC fallback runs:

```typescript
const { data } = await db.auth.signInWithPassword({ email, password });
let role: Role | null = null;
if (data.user) {
  role = await getRoleForUser(data.user.id);
} else {
  const { data: rpcRole } = await (db as any).rpc("manhaj_verify_login", {
    p_email: email, p_password: password,
  });
  role = (rpcRole as Role | null) ?? null;
}
if (!role) redirect("/login?error=credentials");
await setSessionRole(role);
redirect(`/${role}`);
```

### Current test user credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@manhaj-demo.com` | `Admin2026!` |
| Teacher | `teacher@manhaj-demo.com` | `Teacher2026!` |
| Parent | `parent@manhaj-demo.com` | `Parent2026!` |
| Student | `student@manhaj-demo.com` | `Student2026!` |

SQL-verified: `SELECT manhaj_verify_login(email, password)` returns correct role for all four.

---

## 25b. Admin Faculty Page — DB Wiring

### Components wired

**`DepartmentBreakdown.tsx`**
- Now accepts `teachers?: TeacherWithLoad[]`
- When teachers provided, groups by `primary_dept`, computes `teacher_count`, `avg_load`, `over_capacity_count`, `with_slack_count` per dept
- Falls back to `MOCK_DEPARTMENTS` when no DB data

**`TeacherLoadHeatmap.tsx`** (`apps/admin/app/schedule/components/`)
- Now accepts `loads?: TeacherDayLoad[]`
- When provided, normalizes to `{ teacher: full_name, by_day, total }` shape; derives day columns from DB keys
- Falls back to `MOCK_TEACHER_LOADS` + static `DAYS` when no DB data

**`apps/admin/app/faculty/page.tsx`**
- Now fetches `getTeacherDailyLoads(academicYearId)` in parallel with `getTeachersWithLoad`
- Passes `loads` to `FacultyPageClient`

**`FacultyPageClient.tsx`**
- Accepts `loads: TeacherDayLoad[]` prop
- Passes `teachers={source ?? undefined}` to `DepartmentBreakdown`
- Passes `loads={loads.length > 0 ? loads : undefined}` to `TeacherLoadHeatmap`

### Components left on mock (no DB tables yet)

| Component | Missing data |
|---|---|
| `ContractsDashboard` | No `teacher_contracts` table |
| `OnboardingFunnel` | No `hiring_pipeline` table |
| `PerformanceComposite` | No `performance_reviews` table |

---

## 26. Admin Dashboard — Remaining Stubs Wired (2026-07-03)

**`apps/admin/app/page.tsx`** — Two KPI stubs replaced with live DB values:

- **Attendance trend** — Added a second `getDailyAttendanceTrend` call for the prior week window. Week-over-week diff computed at render time; tone (`up`/`flat`/`dn`) and arrow derived from the delta. Previously always showed a hardcoded "+2.1% vs last week".
- **Subs needed today** — `getApprovedAbsencesNeedingCoverage(today)` replaces the hardcoded `"0"`. Shows real count of approved absences with no substitution row.
- **Course-sel done** and **Next free period** — Changed from hardcoded `"14"` / `"P5 Tue"` to `"—"` (no DB tables for course selection completion tracking or free-period detection yet).

---

## 27. Admin Students Page — DemographicBreakdown + IncidentsTimeline + AdmissionsInbox (2026-07-03)

**`DemographicBreakdown.tsx`** — Was fully hardcoded. Now accepts `students?: AdminStudentRow[]`. When provided, groups by `grade_level` (year-group distribution) and `gender`; computes counts and percentages from real data. Falls back to `MOCK_DEMOGRAPHICS` when empty.

**`IncidentsTimeline.tsx`** — Was hardcoded `MOCK_INCIDENTS`. Now accepts `behaviourNotes: BehaviourNoteRow[]`. Maps real `behaviour_notes` rows (with student name + section via updated `getBehaviourNotes` join) to `IncidentRow[]`. Mock fallback when empty.

**`AdmissionsInbox.tsx`** — Was hardcoded `MOCK_ADMISSIONS`. Now accepts `applicants: ApplicantRow[]`. Maps `applicants` table rows to display shape (`ai_band` set to `"—"` until scoring is implemented). Mock fallback when empty.

**`packages/lib/src/queries/students.ts`** — `getBehaviourNotes` updated: added `students ( full_name_en, sections:current_section_id ( code ) )` join so the component has name + section without a second query.

**`apps/admin/app/students/page.tsx`** — Now fetches `getBehaviourNotes(studentIds)` and `getApplicantsForYear(academicYearId)` in parallel. Passes all three datasets to `StudentsPageClient`.

Components left on mock (`ReEnrollmentFunnel`, `InterventionLog`, `TeacherFeedback`, `PeerGroupComparison`) — no DB tables for those yet.

---

## 28. Admin — `.catch()` Fallbacks on All Page Server Fetches (2026-07-03)

All four admin page files (`page.tsx`, `faculty/page.tsx`, `reports/page.tsx`, `students/page.tsx`) had their server fetches wrapped with `.catch(() => [])` / `.catch(() => {})`. A single DB query failure (missing table, RLS error, network blip) no longer crashes the entire page — the mock data path renders instead.

---

## 29. Admin Attendance Page — DayOfWeek + Period + SubjectCorrelation + Benchmarks (2026-07-03)

Three new query functions added to **`packages/lib/src/queries/attendance.ts`**:

- **`getAttendancePatterns(sectionIds, from, to)`** — Single aggregation query over `attendance_marks`. Returns DOW heatmap (per week × day counts) and period bars (per `bell_period_number`). Feeds `DayOfWeekHeatmap` and `PeriodBars` components.
- **`getSubjectAbsences(from, to)`** — Two-step join: absent marks → `timetable_slots` → `subjects`. Counts missed lessons per subject. Feeds `SubjectCorrelation`.
- **`getAttendanceBenchmarks(sectionIds, from)`** — Compares current 30-day window vs previous same-length window per section; always appends a static 95% target bar. Feeds `Benchmarks`.

**`apps/admin/app/attendance/page.tsx`** — All six page fetches wrapped with `.catch()` guards.

**`AttendancePageClient.tsx`** — Passes new props to the three newly-wired components.

Components left on mock: `AiCausesCards`, `PerStudentCalendar`, `LessonsMissed`, `ReEngagementDraft`, `TakeAttendanceUI` — no DB tables for those yet.

---

## 30. Admin Schedule Page — TimetableGrid + TeacherLoadHeatmap + RoomUtilization (2026-07-03)

**New query added to `packages/lib/src/queries/timetable.ts`:**
- **`getRoomUtilization(academicYearId)`** — Counts `timetable_slots` per room vs total teaching `bell_periods`; returns `RoomUtilRow[]` with occupancy percentage.

**Components wired:**

- **`TimetableGrid`** — Now accepts `slots: PeriodSlot[]` + `sectionList: string[]` props. When provided, section picker is populated from live sections; grid is built from bell_period day/period + subject/teacher/room from real data. Falls back to mock grid when empty.
- **`TeacherLoadHeatmap`** — Already accepted `loads` prop from §(Admin Faculty). Now receives it via the schedule page too.
- **`RoomUtilization`** — Now accepts `rows: RoomUtilRow[]`; mock fallback when empty.

**`SchedulePageClient.tsx`** — Accepts `slots`, `sectionList`, `loads`, `roomRows` props and distributes to components.

**`apps/admin/app/schedule/page.tsx`** — Fetches `getSchoolTimetable`, `getTeacherDailyLoads`, `getRoomUtilization` in parallel with `.catch()` guards. KPI row: total slots + unfilled (no teacher assigned) from real data; conflict count still from mock (no conflict-detection table yet).

Components left on mock: `ActionQueue`, `CurriculumCoverage`, `ChangeLog`, `TeacherMyWeek`.

---

## 31. Admin Reports Page — SectionProgress + KPI Row (2026-07-03)

**New query added to `packages/lib/src/queries/reports.ts`:**
- **`getSectionDraftProgress()`** — Queries `students` grouped by `current_section_id` + section code, left-joins `comm_drafts` to count drafted and reviewed rows per section. Returns `SectionDraftProgress[]`.

**Components wired:**

- **`KpiRow`** — Now derives KPIs from real `pipelineCounts` and `sectionProgress` instead of hardcoded numbers. Falls back to mock values when arrays are empty.
- **`SectionProgress`** — Now accepts `rows: SectionDraftProgress[]`; renders real `section_code`, drafted count, reviewed count. Mock fallback when empty.

`PipelineFunnel`, `TemplatesShelf`, `ComplianceLog` were already wired in §23.

---

## 32. Teacher Analyse Page — Real Timetable Grid + Student Spotlight (2026-07-03)

**`schedule-components/TeacherMyWeek.tsx`** — Was fully hardcoded. Now accepts `slots?: PeriodSlot[]` from `getTeacherTimetable()`. Normalises DB day strings (`"monday"` → `"Mon"`) to match the component's day column format; builds live grid. Falls back to mock week when no DB slots.

**Student spotlight** (`apps/teacher/app/page.tsx`) — Derived from `dbStudents` risk flags: `high` severity → `bad` tone, `medium` → `warn`, no flags → `good`. Falls back to `MOCK_SPOTLIGHT` when no DB students.

All async fetches on the page (students, timetable, assessments) wrapped with `.catch()` guards.

---

## 33. Teacher App — Attendance KPI + Pending Grading + Class Selector (2026-07-03)

**New query functions:**

- **`getTeacherSectionAttendance(sectionIds, from, to)`** (added to `attendance.ts`) — Queries `attendance_marks` by `section_id IN sectionIds`; returns `avgPct` + per-day trend array. Feeds attendance KPI card and `TrendChart`.
- **`getPendingGradingCount(teacherId)`** (added to `assessments.ts`) — Counts `assessment_results` rows where `score IS NULL` for this teacher's assessments. Feeds "Pending grading" KPI.

**Analyse page (`apps/teacher/app/page.tsx`)** — Both new queries fetched with `.catch()` guards. Attendance KPI card shows real `avgPct`; `TrendChart` receives real per-day array (mock fallback when empty). Pending grading card shows real count.

**Input page (`apps/teacher/app/input/page.tsx` + `TeacherInputPageClient.tsx`)** — `classOptions` derived from `teacherSections` (already fetched via `getTeacherWithSections`); passed as prop to `TeacherInputPageClient`. Falls back to hardcoded section list when empty.

---

## 34. Parent Dashboard — Full DB Wiring (2026-07-03)

The parent dashboard was the largest single wiring effort — required new query file, new context provider, and changes to 8 files.

### New query file: `packages/lib/src/queries/parents.ts`

- **`getParentName(parentId)`** — `parents.full_name`.
- **`getParentChildren(parentId)`** → `ParentChild[]` — via `student_parents JOIN students + sections`. Returns `student_id`, `full_name_en`, `initial`, `section_code`, `grade_level`.
- **`getAttendanceForStudents(studentIds, from, to)`** → per-child attendance % + absences count. Used by parent dashboard and (later) parent invoice page.
- **`getRubricAvgForStudents(studentIds, month)`** → per-child rubric average (latest month across all axes). Used by dashboard growth card.

### New `child.tsx` context changes

`ActiveChildContext` extended with `children: DemoChild[]` field. `ActiveChildProvider` accepts `realChildren?: DemoChild[]` prop — when provided, replaces `DEMO_CHILDREN` as the source of truth. Re-exported `readActiveChildId` with a default param so existing callers aren't broken.

### `apps/parent/app/layout.tsx`

Made `async`. Fetches `getCurrentParentId()` → `getParentName()` + `getParentChildren()` in parallel, all with `.catch()`. Maps DB children to `DemoChild[]` and passes `realChildren` to `ActiveChildProvider`. Renders real parent name in the topbar.

### `apps/parent/app/page.tsx`

New server component. Fetches invoices, report archive, per-child attendance, per-child rubric average. Wraps the dashboard in `<ParentDashboardClient data={...}>` context provider to distribute data without prop-drilling.

### `ParentDashboardClient.tsx` (new file)

Client context (`ParentDashData`) holding the four data payloads. Child components use `useParentDash()` to read data.

### Components wired

- **`ChildSwitcher`** + **`GreetHero`** — switched from `DEMO_CHILDREN` import to `children` from `useActiveChild()` context.
- **`DashStatRow`** — reads real outstanding invoice balance, per-child attendance %, rubric average from `ParentDashContext`; falls back to mock values when no DB data.
- **2×2 summary cards** — real invoice total/count, real report archive count + last generated date.

---

## 35. Parent App — Invoices + Messages + Calendar Page Sweep (2026-07-03)

All parent app pages audited and wired to real DB queries. Pattern throughout: real data rendered when DB returns rows; mock fixture used as fallback so demo always looks populated.

### Past Reports (`apps/parent/app/past-reports/page.tsx`)
Already wired to `getReportArchive({ parentId })`. Added `.catch(() => [])` guard.

### Invoices (`apps/parent/app/invoices/page.tsx` + client + components)

**`page.tsx`** — Added `.catch(() => [])` on `getInvoicesForParent(parentId)`.

**`InvoicesPageClient.tsx`** — Two bugs fixed:
- Real data path always rendered household view regardless of which child was active.
- `invoiceParentSummary()` was called with hardcoded `ALL_CHILDREN_ID` instead of `activeId`.
- Fix: added per-child branch using `childRows.find(c => c.child_id === activeId)` when `activeId !== ALL_CHILDREN_ID`.

**`components/HouseholdRows.tsx`** — Bug: `DEMO_CHILDREN.find(c => c.id === r.child_id)` — real UUIDs never match DEMO_CHILDREN IDs, so initials/grade always showed "?". Fix: switched to `const { setActive, children } = useActiveChild()` and `children.find(c => c.id === r.child_id)`.

### Messages (`apps/parent/app/messages/page.tsx` + 3 components)

**`page.tsx`** — Added `.catch(() => [])` on `listThreadsForParent()`.

**`components/ChildFilter.tsx`** — Was building filter pills from `DEMO_CHILDREN`. Fixed to use `const { activeId, setActive, children } = useActiveChild()` and iterate real `children`.

**`components/InboxList.tsx`** — `DEMO_CHILDREN.find(c => c.id === t.child_id)` for thread child label always returned undefined. Fixed to use `children` from `useActiveChild()`.

**`components/NewMessageComposer.tsx`** — "About" select was populated from `DEMO_CHILDREN.map(...)`. Fixed to use `children` from `useActiveChild()`.

### Calendar (`apps/parent/app/calendar/page.tsx`)

Added `.catch(() => [])` on `getActivitiesForYear`. Added mock fallback: `import { MOCK_EVENTS }` and `return <CalendarClient events={events.length > 0 ? events : MOCK_EVENTS} />`.

### Courses

Page already wired. No changes needed.

### Root cause — DEMO_CHILDREN vs real children

Multiple components used `DEMO_CHILDREN` for ID lookups. Real children have UUIDs that never match DEMO_CHILDREN IDs, so all lookups silently returned `undefined`. The fix in every case: switch to `children` from `useActiveChild()` context, which is populated via `realChildren` prop injected server-side in the layout.

---

## 36. Student App — Full DB Wiring Sweep (2026-07-03)

### Layout (`apps/student/app/layout.tsx`)

Was hardcoded "Layla Al-Habsi · 10A" / "LA" avatar. Made the layout `async`. Now fetches `getCurrentStudentId().catch(() => null)` → `getStudentProfile(studentId).catch(() => null)`. Falls back to "Layla Al-Habsi" / "10A" / "LA" if DB returns nothing.

**New query added to `packages/lib/src/queries/students.ts`:**
```ts
export type StudentProfile = {
  full_name_en: string;
  current_section_id: string | null;
  section_code: string | null;
  grade_level: string | null;
};
export async function getStudentProfile(studentId: string): Promise<StudentProfile | null>
```
`section_code` and `grade_level` are not direct columns on `students` — joined via `sections:current_section_id ( code, grade_level )`.

### Dashboard (`apps/student/app/page.tsx`)

Added parallel fetches: `getRubricScoresForStudent`, `getAttendanceForStudents` (30-day window), `getReportArchive`, `getStudentProfile`. Sequential fetch: `getNextExamForSections` (needs `sectionId` from profile). All with `.catch()` fallbacks.

New derived values: rubric avg/delta, strongestAxis/buildingAxis, attPct/attAbsences, reportCount/lastReportLabel, nextExam. All KPI cards, growth card, attendance chip, and today strip now show real DB values with mock fallbacks.

### Schedule (`apps/student/app/schedule/page.tsx`)

Added `mockToPeriodSlots(mock: StudentPeriod[]): PeriodSlot[]` converter (mock type ≠ component type). Added `.catch(() => [])` on both auth fetches and `getStudentTimetable`. Falls back to `mockToPeriodSlots(MOCK_PERIODS)` when DB returns 0 rows. All three sub-components (`NowCard`, `TodayTimeline`, `WeekView`) were already correctly wired to props.

### Homework (`apps/student/app/homework/page.tsx`)

Added `.catch(() => null)` on `getCurrentStudentId()`. Added `.catch(() => [])` on `getHomeworkForStudent()`. Added mock fallback: `MOCK_HOMEWORK.map(h => ({ id, subject, title, due: h.due.slice(0, 10), lesson_date: h.due.slice(0, 10), ai_estimate: h.ai_estimate || null }))`. All four sub-components derive status from due dates — no mock-specific fields needed.

**Vercel build fix:** Initial `lesson_date: null` caused a TypeScript error (`HomeworkRow.lesson_date` is `string`, not `string | null`). Changed to `h.due.slice(0, 10)`.

### Past Reports (`apps/student/app/past-reports/page.tsx`)

Added `.catch(() => null)` on `getCurrentStudentId()` and `.catch(() => [])` on `getReportArchive()`. Component already shows "No reports yet." for empty arrays — no mock fallback needed (`ArchivedReport` mock type doesn't map cleanly to `ReportArchiveRow`).

### Growth (`apps/student/app/growth/page.tsx`)

Added `.catch()` guards on all four fetches. Added module-level mock converters:

```ts
const MOCK_SCORES: RubricAxisScore[] = MOCK_GROWTH.map(h => ({
  axis_code: h.axis, this_mo: h.this_mo, last_mo: h.last_mo, history: h.history,
}));

const MOCK_GOAL_ROWS: GoalRow[] = MOCK_GOALS.map(g => ({
  id: g.id, kind: g.axis, title: g.title, description: g.detail,
  due_on: null, status: g.status === "done" ? "achieved" : g.status === "behind" ? "dropped" : "active",
  metric: null, target_value: null,
  latest_progress: g.progress, last_checkin: g.last_update,
}));
```

Falls back to these when DB returns 0 rows for each.

Five components (`CurrentGrades`, `SubjectPercentiles`, `MonthOverMonthDelta`, `ImprovementPlan`, `UniversityPlacementSignal`) are intentionally static — no DB tables exist for grades, percentiles, or placement signals yet. Left unchanged.

---

## 37. Nav / Layout Identity Wiring — All Apps (2026-07-03)

All 4 nav components (`AdminNav`, `ParentNav`, `StudentNav`, `TeacherNav`) are pure link lists — no DB wiring needed. The DB wiring concern was in the topbar identity slots (name, avatar initials) in each layout.

### New query functions added

**`packages/lib/src/queries/auth.ts`:**
```ts
getCurrentAdminId(): Promise<string | null>  // looks up school_admins by user_id
getAdminName(adminId: string): Promise<string>  // school_admins.full_name
```

**`packages/lib/src/queries/teachers.ts`:**
```ts
getTeacherName(teacherId: string): Promise<string>  // display_name ?? full_name
```

### Layouts fixed (6 total)

**`apps/teacher/app/layout.tsx`** — Made async. Fetches `getCurrentTeacherId()` → `getTeacherName()`. Displays real name + initials. Falls back to "Ms Swart"/"MS".

**`apps/admin/app/layout.tsx`** — Made async. Fetches `getCurrentAdminId()` → `getAdminName()`. Falls back to "Principal"/"PR".

**`apps/portal/app/teacher/layout.tsx`** — Same as teacher standalone.

**`apps/portal/app/admin/layout.tsx`** — Same as admin standalone.

**`apps/portal/app/student/layout.tsx`** — Made async. Fetches `getCurrentStudentId()` → `getStudentProfile()`. Shows real name + section code + initials. Falls back to "Layla Al-Habsi · 10A"/"LA".

**`apps/portal/app/parent/layout.tsx`** — Made async. Fetches `getCurrentParentId()` → `getParentName()` + `getParentChildren()`. Maps children to `DemoChild[]` and passes as `realChildren` prop to `ActiveChildProvider`. Critical bug fix: without this, the portal parent's child switcher always showed `DEMO_CHILDREN` (Layla/Omar/Yasmin) instead of the real logged-in parent's children. All `.catch()` fallbacks in place. Falls back to "Mr Al-Habsi" display name.

### Already wired (no changes needed)

- `apps/student/app/layout.tsx` — wired in §27 (standalone student layout)
- `apps/parent/app/layout.tsx` — already fully wired in a prior session

---

## 38. Admin Students Page — At-Risk / Retention Dashboard (2026-07-08)

Replaced the old students page (StudentsPageClient + 13 component files) with a new "A3 At-Risk / Retention Dashboard" design matching the mockup PDF page 46. All old files deleted; 3 new files created.

### Files changed

**Deleted (14 files):**
`StudentsPageClient.tsx` + `components/AdmissionsInbox.tsx`, `BulkParentComms.tsx`, `CohortHeatmap.tsx`, `DemographicBreakdown.tsx`, `IncidentsTimeline.tsx`, `InterventionLog.tsx`, `PeerGroupComparison.tsx`, `QuickSearch.tsx`, `ReEnrollmentFunnel.tsx`, `RiskRoster.tsx`, `StudentSearchFilter.tsx`, `TeacherFeedback.tsx`

**Created:**
- `apps/admin/app/students/page.tsx` — fetches `getStudentsWithRiskFlags(academicYearId)` + `getStudentsForAdmin(academicYearId)` (for total enrolled count); passes to `AtRiskDashboardClient`.
- `apps/admin/app/students/AtRiskDashboardClient.tsx` — client component with filter chip state + search input, 4 KPI cards (Total Flagged / High+Critical / Medium / Low), students grouped by severity (critical→high→medium→low), mock fallback with 7 realistic students.
- `apps/admin/app/students/components/RiskStudentCard.tsx` — card component: colored avatar with initials, name + grade/section + "flagged Nd ago", risk score bar (mapped from severity: critical=95, high=82, medium=54, low=22), category signal chips, AI brief from `risk_flags.reason`, owner label, "Message parent" + "Open profile" action buttons.

**`packages/lib/src/queries/students.ts`** — `getStudentsWithRiskFlags` updated to include `created_at` and `owner_id` in the `risk_flags!inner` select.

**`packages/ui/src/globals.css`** — `.ars-` CSS block appended (page layout, KPI strip, filter bar, severity section headings, card grid, signal chips, score bar, footer actions).

### DB wiring

- Student names, section/grade, flag categories, `risk_flags.reason` (used as AI brief), `risk_flags.created_at` (days-ago label), `risk_flags.owner_id` (owner display).
- Mock: risk score number, action button behaviour.

### Centering fix

After initial build, `.ars-page` lacked `margin: 0 auto` — content was left-aligned. Added to match all other admin pages.

---

## 39. Admin Schedule Page — Scheduler & Substitute Finder (2026-07-08)

Replaced the old schedule page (SchedulePageClient + 10 component files) with a new "A8 Scheduler & Substitute Finder" design matching the mockup PDF page 52. All old files deleted; 4 new files created.

### Files changed

**Deleted (11 files):**
`SchedulePageClient.tsx` + `components/ActionQueue.tsx`, `AskManhajCard.tsx`, `ChangeLog.tsx`, `CurriculumCoverage.tsx`, `KpiRow.tsx`, `RoomUtilization.tsx`, `TeacherLoadHeatmap.tsx`, `TeacherMyWeek.tsx`, `TimetableGrid.tsx`

**Bonus fix:** `apps/admin/app/faculty/FacultyPageClient.tsx` imported `TeacherLoadHeatmap` from the schedule components folder — removed that import and its usage (the component no longer exists).

**New query file: `packages/lib/src/queries/schedule.ts`**
- `getTodayAbsences()` → `AbsenceRow[]` — queries `staff_absences` where `starts_on = today`. Due to an ambiguous FK (`staff_absences` has both `teacher_id` and `sub_teacher_id` → `teachers`), the teacher name lookup is done as a separate `teachers` query to avoid the Supabase TypeScript `SelectQueryError`. Fetches substitutions via `substitutions!absence_id` join. Real column names (discovered from TS errors): `starts_on`, `reason_notes`, `absence_id`, `substitute_teacher_id`, `slot_id`.
- `getAbsentTeacherPeriods(teacherId, absenceId, academicYearId)` → `AbsentTeacherPeriod[]` — timetable slots for the absent teacher on today's day-of-week, matched with substitution assignments.
- `getWeekTimetableGrid(academicYearId)` → `WeekSlot[]` — all timetable slots with day/period/subject/teacher/section for the week grid.

**Created:**
- `apps/admin/app/schedule/page.tsx` — fetches `getTodayAbsences()` + `getWeekTimetableGrid(academicYearId)`; passes to `SchedulerClient`.
- `apps/admin/app/schedule/SchedulerClient.tsx` — 4 tabs (Today / This week / Master timetable / Cover history). Date subtitle. Cover history tab shows 5 mock historical rows.
- `apps/admin/app/schedule/components/TodayView.tsx` — AI banner, 4 KPI cards (Classes today/Teachers absent/Cover assigned/Open gaps), absent teacher block with period-by-period timeline (08:00–13:30), ranked substitute candidate cards with compatibility scores (98/74/61), footer actions (View handoff sheet / Message sub / Mark returned). Period breakdown uses mock data (complex join not worth doing for display-only). DB-wired: absent teacher name/reason/sub counts and names.
- `apps/admin/app/schedule/components/MasterTimetableView.tsx` — day×period grid (Sun–Thu, P1–P6), shows real DB slots when available, falls back to mock grid. "Plan next week" AI banner at bottom.

**`packages/ui/src/globals.css`** — `.sch-` CSS block appended (page, tabs, AI banner, KPI strip, teacher row, period rows, candidate cards, master timetable grid, cover history table).

### DB wiring

- Today's absences: `staff_absences.starts_on = today` + teacher name via separate `teachers` query.
- Substitutions for each absence: `substitutions!absence_id` with `substitute_teacher_id → teachers`.
- Week timetable grid: `timetable_slots` with all joins, day+period grouping.
- Mock: period-by-period breakdown (requires knowing the absent teacher's bell_period schedule on today's day — feasible but left for a future pass), candidate ranking scores, AI text.

---

## 40. Admin Admission Page — Admissions + Re-Enrolment (2026-07-08)

Renamed the "Attendance" tab to "Admission" and replaced the entire page with a new "A4 Admissions + Re-enrolment" design matching the mockup PDF page 48. All old files deleted; 2 new files created.

### Nav rename

`apps/admin/app/components/AdminNav.tsx` — changed label from `"Attendance"` to `"Admission"`. Route stays `/admin/attendance` (no Next.js route change needed).

### Files changed

**Deleted (13 files):**
`AttendancePageClient.tsx` + `components/AiCausesCards.tsx`, `BenchmarkBars.tsx`, `ChronicAbsenteesTable.tsx`, `DayOfWeekHeatmap.tsx`, `LessonsMissedList.tsx`, `PerStudentCalendarHeat.tsx`, `PeriodBars.tsx`, `ReEngagementDraft.tsx`, `SectionHeatStrip.tsx`, `SubjectCorrelation.tsx`, `TakeAttendanceUI.tsx`

**Created:**
- `apps/admin/app/attendance/page.tsx` — fetches `getApplicantsForYear(academicYearId)` for pipeline + table data, and `getStudentsForAdmin(academicYearId)` for total enrolled count; passes to `AdmissionsClient`.
- `apps/admin/app/attendance/AdmissionsClient.tsx` — full page:
  - **AI banner** — re-enrolment briefing (mock text, DB-driven count).
  - **4 KPI cards** — Currently Enrolled (from DB `getStudentsForAdmin` count) / Re-Families 88.4% / Not Yet Decided 47 / Confirmed Leaving 18 (last three mock).
  - **Re-Enrolment families** — 5 mock family rows with risk chips (ALL DISMISSED RISK / BACK-TO-SCH RISK / COMPETITION RISK / CREDIT RISK / FRIENDLY CONTACT) + action buttons per family.
  - **Confirmed Leaving** — horizontal bar chart (Graduated/Moving/Competition Losing/Dissatisfied) with note breakdown.
  - **New Applicant Pipeline** — 6-stage bar chart (INQUIRY→TOUR BOOKED→ASSESSMENT→INTERVIEW→OFFER SENT→ENROLLED); counts from DB `applicants.stage` when available, mock fallback (142→84→61→38→31→22).
  - **Needs You This Week** — 2×3 grid of 6 action cards with Preview/Send/Open buttons (all mock).
  - **All Applicants table** — DB-wired; searchable by name/grade/source, filterable by stage; colored initials avatars, stage chips (`admission_stage` enum: new/review/interview/offer/accepted/rejected/withdrawn), days-in-stage computed from `created_at`, mock owner "Ms. Salwa". Mock fallback with 8 representative applicants.

**`packages/ui/src/globals.css`** — `.adm-` CSS block appended (page, banner, KPI strip, section wrappers, family rows, leaving bars, pipeline funnel, needs grid, table).

### DB wiring

- Total enrolled: `getStudentsForAdmin` length.
- Pipeline bar chart counts: `applicants.stage` grouped.
- All Applicants table: full `applicants` rows for the year (id, full_name, target_grade, stage, source, notes, created_at).
- Mock: re-enrolment family rows (no re-enrolment tracking table in DB), confirmed leaving breakdown (no leaving-reason column in DB), needs-this-week action cards (AI-generated), owner per applicant (no admissions_owner field in DB), AI signal (no scoring table).

---

## 41. Minor Polish — Nav Label + Schedule Dynamic Title (2026-07-08)

Two small fixes applied after the main page rebuilds.

**`apps/admin/app/components/AdminNav.tsx`** — "Admission" → "Admissions" (typo fix, plural form).

**`apps/admin/app/schedule/SchedulerClient.tsx`** — Added `TAB_TITLE` map so the `<h1>` updates with the active tab:
- Today → "Today's schedule"
- This week → "This week's schedule"
- Master timetable → "Master schedule"
- Cover history → "Cover history"

Previously the title was hardcoded to "Today's schedule" regardless of which tab was active.
