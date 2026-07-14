# Manhaji Phase-1 Visual Inventory — Live Site Sweep

- **Site:** https://manhaji-bay.vercel.app (logged in via `/demo` one-click picker)
- **Date:** 2026-07-10
- **Method:** Read-only Playwright sweep. No forms submitted, no DB writes.
- **Screenshots:** `docs/pm/reviews/assets/phase1-visual/<persona>-<pageslug>.jpeg` (25 files)

Status flags: `BUILT-REAL` (real DB data) · `BUILT-MOCK` (renders, data hardcoded/demo) · `BROKEN` (error/404/dead control) · `EMPTY` (renders, no data) · `PARTIAL` (mix).

> **Cross-cutting finding — dead dashboard KPI/jump links.** On the **admin dashboard** and **student dashboard**, the large KPI/"jump into a tab" cards link to *top-level* routes (`/faculty`, `/attendance`, `/schedule`, `/reports`, `/homework`, `/past-reports`, `/growth`) instead of the namespaced `/admin/*` and `/student/*` routes. These 404 on prefetch (confirmed in console). The **nav bars** link correctly. Same bug appears in **admin Input Data** cards (link to `/section-mapping`, `/schedule`, `/faculty`). This is a consistent routing bug worth one fix.

---

## ADMIN (persona: Demo Admin)

Nav: Dashboard · Faculty · Sections · Students · Admissions(→/admin/attendance) · Schedule · Reports · Input Data.

### /admin — Dashboard · `admin-dashboard.jpeg`
Heading "Good morning, Principal."
1. **Manhaj briefing** — AI summary (82 sections to map, capacity, today/week/month). BUILT-MOCK (narrative, but section count matches real 82).
2. **KPI cards** (Faculty / Students / Attendance / Schedule / Reports) — PARTIAL: numbers present (105 teachers, 23 students) but Attendance/Reports show "—"/0. **Cards link to dead top-level routes → BROKEN links.**

### /admin/faculty — Faculty · `admin-faculty.jpeg`
Tabs: Principal / Student Advisor / Teacher lens.
1. **Manhaj briefing** — BUILT-MOCK.
2. **Summary tiles** (Total teachers 69 · Over capacity 0 · Vacancies 0 · Avg load 0%) — PARTIAL (count real, load = 0%).
3. **Department filters** — render but data collapses to "1 department / Other". PARTIAL.
4. **Department breakdown** — PARTIAL (all under "Other", 0 p/wk).
5. **Faculty roster table** — BUILT-REAL: "69 teachers loaded from database" with real names/subjects; but Department col all "—", Periods/wk all 0 (load-mapping not wired).
6. **Contracts dashboard** — BUILT-MOCK (hardcoded names).
7. **Hiring pipeline** — BUILT-MOCK (47/12/8/3/2).
8. **Performance composite** — BUILT-MOCK.
9. **Ask Manhaj** input — control present, not exercised.

### /admin/students — At-Risk · Retention Dashboard · `admin-students.jpeg`
1. **Header + Export list** button.
2. **Risk tiles** (2 flagged of 23 · 1 high · 1 medium · 0 low) — BUILT-REAL/PARTIAL (small real cohort).
3. **Filter chips** (All/High/Medium/Low/Financial/Academic/Engagement) + search.
4. **High-risk card** (Khalid Al-Marzouqi) + **Medium-risk card** (Rania Khalifa) — BUILT-REAL-ish, Message parent / Open profile buttons.
> Note: this page is **only the at-risk view**. Re-enrolment/leavers/applicants live on `/admin/attendance` (see below), not here.

### /admin/schedule — Today's schedule · `admin-schedule.jpeg`
Tabs: Today / This week / Master timetable / Cover history.
1. **Coverage briefing** (1 teacher absent, 4/4 covered) — BUILT-MOCK.
2. **Day KPIs** (47 classes / 1 absent / 4-4 cover / 0 gaps) — BUILT-MOCK.
3. **Today's substitutions** per-period breakdown — BUILT-MOCK (scripted Tariq/Fatima narrative).
4. **Ranked candidates** ("why Ms Fatima", scores) — BUILT-MOCK.
5. **Handoff sheet actions** (View / Message / Mark returned) — buttons present.
> This is a **substitute-coverage** view, not an auto-scheduling/timetable generator.

### /admin/attendance — **ADMISSIONS** (mislabelled route) · `admin-attendance.jpeg`
Heading "Admissions" (re-enrolment + leavers + applicant pipeline).
1. **Admissions briefing** — BUILT-MOCK (some garbled demo copy).
2. **Tiles** (23 enrolled / 20 re-enrol / 47 undecided / 18 leaving) — BUILT-MOCK.
3. **Re-enrolment — undecided families** list — BUILT-MOCK.
4. **Confirmed leaving — and why** — BUILT-MOCK.
5. **New applicant pipeline** (stage counts, "real data") — BUILT-REAL-ish.
6. **Needs you this week** action cards — BUILT-MOCK.
7. **All applicants table** (8 rows, stage/source/owner, filters, Export CSV, +Add) — BUILT-REAL-ish.
> **No dedicated student-attendance analytics page exists** — the `/admin/attendance` route serves Admissions.

### /admin/reports — Regulator Reporting · `admin-reports.jpeg`
1. **Regulator tabs** (Oman MoE / KHDA / ADEK / SPEA).
2. **Briefing** (3 due in 30 days) — BUILT-MOCK.
3. **Upcoming submissions** (3, Review/Generate/Submit buttons) — BUILT-MOCK.
4. **Generate a report** (6 report types, PDF/CSV/XLSX) — BUILT-MOCK.
5. **Recent submissions** table — BUILT-MOCK.
6. **Compliance snapshot** — BUILT-MOCK.
> Covers the **regulator-reports** half of A8. **No parent-comms pipeline** here (that lives partly in Input Data "Bulk parent comms", disabled).

### /admin/input — Input data · `admin-input.jpeg`
5 workflow cards:
1. **Section mapping** → links to `/section-mapping` (BROKEN link; correct page is `/admin/section-mapping`).
2. **Roster import** (CSV/Excel dropzone) — **Upload file button DISABLED** → BROKEN/PARTIAL.
3. **Schedule edits** → `/schedule` (BROKEN link).
4. **Faculty edits** → `/faculty` (BROKEN link).
5. **Bulk parent comms** (17 templates) — **Send batch button DISABLED** → BROKEN/PARTIAL.

### /admin/section-mapping — Section mapping · `admin-section-mapping.jpeg`
1. **Intro + filter** (All / Confirmed only) + "Re-suggest all from codes" + "0 / 82 confirmed".
2. **Mapping table** — BUILT-REAL: **82 real section codes** loaded from DB (1-2 AL, 10A, 11 AS…), each row editable (grade/label/stream/capacity/notes + Confirm row). Genuine CRUD workflow.

---

## TEACHER (persona: Ms Swart)

Nav: Dashboard · One-Tap Attendance · Rubric Scoring · Class Hub · Substitute · Input.

### /teacher — Dashboard · `teacher-dashboard.jpeg`
1. **Greeting + today line.**
2. **KPI tiles** (22 periods / 2 sections / 94% att / 0 pending).
3. **My week** weekly timetable grid — BUILT-MOCK.
4. **Attendance chart** (last 17 days).
5. **Recent assessments** table — **EMPTY body**.
6. **Student spotlight** (3 flagged).
7. **My students roster** (9 across 2 sections, real-looking names/grades) — BUILT-REAL-ish, section filter.
8. **Student insights** (top / needs attention / submission trend).
9. **Ask Manhaj** diff input.

### /teacher/attendance — One-Tap Attendance · `teacher-attendance.jpeg`
BUILT-MOCK, functional UI. Present/Absent/Late counts, All-present/Clear/From-yesterday, per-student toggles + reason chips, "9 more all present", **Submit** (not clicked). T1.

### /teacher/rubric — Rubric Scoring · `teacher-rubric.jpeg`
BUILT-MOCK, very complete. 12-student sidebar (scored/in-progress/not-started), month cycle toggle, **6 axes** (4 AI-proposed with evidence + 2 judgment-only), Save draft / Confirm & next. T2.

### /teacher/classhub — Weekly Class Summary · `teacher-classhub.jpeg`
BUILT-MOCK, very complete. This-week-at-a-glance, follow-ups (checkboxes), next-class checklist, **parent-summary generator** (tone toggle, live preview, routing: digest / class page / email / Arabic). Maps T3 + parent-digest authoring.

### /teacher/substitute — Substitute handoff · `teacher-substitute.jpeg`
BUILT-MOCK. Per-period lesson-plan handoff (plans, prep checklists, student flags), emergency contacts, end-of-day list, Save PDF / I've read this. T6.

### /teacher/input — Input data · `teacher-input.jpeg`
BUILT-MOCK/PARTIAL. Select class (real roster) → class summary → disciplinary notes → **AI homework generator** (count/difficulty, Generate questions). Controls present.
> **No dedicated teacher goal-setting page** in teacher nav (goal-setting appears only student-side).

---

## PARENT (persona: Mr Al-Habsi)

Nav: Dashboard · Permission Slip · Invoices · Sibling Comparison · Calendar. Child switcher (Layla / Omar / Yasmin).
> `/parent/courses` exists and is reachable (linked from dashboard + sibling comparison) but is **not in the parent nav bar**.

### /parent — Weekly Digest · `parent-dashboard.jpeg`
BUILT-MOCK, rich. Child switcher, AI digest (reviewed-by-teacher), KPI tiles, timeline (what happened / coming up), teacher recognition, "Things you need to do" (Sign / View invoice), reply actions. P1.

### /parent/permission-slip — Field-trip consent · `parent-permission-slip.jpeg`
BUILT-MOCK, functional form. Trip details, attend Y/N, health, emergency contact (pre-filled), Decline / Save draft / **Sign and submit** (not clicked). P4.

### /parent/invoices — Invoice detail · `parent-invoices.jpeg`
BUILT-MOCK. Amount due, line items, payment-history table (receipts), pay panel → **redirects to external "ISO Parent Portal"** (no in-app payment; Manhaj "never sees card details"). P5.

### /parent/sibling-comparison — Your children · `parent-sibling-comparison.jpeg`
BUILT-MOCK, complete. 3 child cards, side-by-side comparison table, family action list. P6.

### /parent/calendar — Calendar · `parent-calendar.jpeg`
BUILT-MOCK/PARTIAL. Month grid with events, type filters, **ICS + Google Calendar sync links** (real webcal/Google endpoints). Filter counts inconsistent ("Upcoming next 14 days: none" while May shows events). 1 console error.

### /parent/courses — Course selection wizard · `parent-courses.jpeg`
BUILT-MOCK/PARTIAL. Multi-step (Student → Compulsory → Electives → Review), EN/AR toggle, draft-restore. Not nav-linked. Maps the "course selection" flow.

---

## STUDENT (persona: Layla Al-Habsi)

Nav: Dashboard · My Goals · Study Planner · Application Tracker · My Growth.

### /student — Dashboard · `student-dashboard.jpeg`
BUILT-MOCK. Monthly briefing (teacher-approved), today snapshot, KPI tiles, **"Jump into a tab" cards → dead top-level links** (`/schedule`, `/homework`, `/past-reports`, `/growth` — 404 confirmed).

### /student/goals — My Goals · `student-goals.jpeg`
BUILT-MOCK, complete. Active goals w/ progress, streaks, AI-suggested goals, private reflection box. S1.

### /student/study-planner — Plan your week · `student-study-planner.jpeg`
BUILT-MOCK, complete. To-do list, weekly grid, AI study suggestions, suggested-afternoon schedule. S2.

### /student/application-tracker — University applications · `student-application-tracker.jpeg`
BUILT-MOCK, very complete. Stage counts, 7 universities, placement insights, anonymous cohort comparison, master docs, test scores, counsellor booking. S3.

### /student/growth — My Growth · `student-growth.jpeg`
BUILT-MOCK, very complete. 6-axis radar (this vs last), axis sparklines, strengths/growth, goals, IGCSE subject grades, university placement signal, improvement plan, percentiles, month-over-month delta.

---

## Intended-screen coverage table

| Screen | Intended | Status | Route(s) | Notes |
|---|---|---|---|---|
| **A1** Auth / Manage-Admins | Yes | **PARTIAL** | `/demo`, `/login` | One-click demo login works; no admin-management/manage-admins UI seen. |
| **A2** Dashboard | Yes | **BUILT-MOCK** | `/admin` | KPI cards link to dead top-level routes. |
| **A3** Input-Data CRUD | Yes | **PARTIAL** | `/admin/input`, `/admin/section-mapping` | Section-mapping = BUILT-REAL CRUD (82 codes). Input cards: 2 disabled buttons + broken links. |
| **A4** Faculty / HR (incl. sick-leave approval) | Yes | **PARTIAL** | `/admin/faculty` | Roster real (69 from DB); load/dept unwired; contracts/hiring mock. **No sick-leave approval queue** found. |
| **A5** Students (at-risk / re-enrol / leavers / applicants) | Yes | **BUILT (split)** | `/admin/students` (at-risk) + `/admin/attendance` (re-enrol/leavers/applicants) | Split across two routes; applicant + at-risk data look real-ish; rest mock. |
| **A6** Attendance | Yes | **MISSING (admin)** | — | No admin student-attendance analytics page. `/admin/attendance` = Admissions. Attendance capture exists teacher-side (T1). |
| **A7** Schedule + auto-scheduling | Yes | **PARTIAL** | `/admin/schedule` | Substitute-coverage view (mock). Master-timetable tab present; **no auto-scheduling generator** demonstrated. |
| **A8** Reports (parent-comms + regulator) | Yes | **PARTIAL** | `/admin/reports` (regulator) + `/admin/input` (bulk comms, disabled) | Regulator half built (mock). Parent-comms pipeline only a disabled card. |
| **T1** One-tap attendance | Yes | **BUILT-MOCK** | `/teacher/attendance` | Full functional UI. |
| **T2** Rubric scoring | Yes | **BUILT-MOCK** | `/teacher/rubric` | 6 axes, AI-proposed + judgment; very complete. |
| **T3** Class summary / lesson plan | Yes | **BUILT-MOCK** | `/teacher/classhub` | Incl. parent-summary generator. |
| **T6** Substitute handoff | Yes | **BUILT-MOCK** | `/teacher/substitute` | Full handoff sheet. |
| **Teacher goal-setting** | Yes | **MISSING** | — | No teacher-side goal page; goals are student-side only. |
| **P1** Weekly digest | Yes | **BUILT-MOCK** | `/parent` | |
| **P4** Permission slip | Yes | **BUILT-MOCK** | `/parent/permission-slip` | |
| **P5** Invoice / payment | Yes | **BUILT-MOCK** | `/parent/invoices` | Payment offloaded to external portal (no in-app pay). |
| **P6** Sibling comparison | Yes | **BUILT-MOCK** | `/parent/sibling-comparison` | |
| **S1** My Goals | Yes | **BUILT-MOCK** | `/student/goals` | |
| **S2** Study Planner / My Week | Yes | **BUILT-MOCK** | `/student/study-planner` | |
| **S3** University / Application Tracker | Yes | **BUILT-MOCK** | `/student/application-tracker` | |

### Extra pages beyond the intended list
- `/parent/calendar` (calendar + ICS/Google sync) — bonus.
- `/parent/courses` (course-selection wizard) — bonus, not nav-linked.
- `/student/growth` (rich rubric/percentile/placement analytics) — bonus.
- `/admin/faculty` lens tabs (Principal/Advisor/Teacher) — bonus.

### Biggest gaps
1. **Admin Attendance (A6) missing** — the `/admin/attendance` route is Admissions; there's no student-attendance analytics screen for admins.
2. **Auto-scheduling (A7) not built** — only substitute-coverage; no timetable generator.
3. **Parent-comms pipeline (A8) is a disabled stub** — "Bulk parent comms" Send button disabled.
4. **Sick-leave approval queue (A4) absent** — faculty page has contracts/hiring but no leave-approval workflow.
5. **Teacher goal-setting missing.**
6. **Manage-Admins (A1) absent** — only demo login.
7. **Routing bug** — admin & student dashboard cards + admin Input cards link to unprefixed routes that 404. Consistent, fixable.
8. **Data-wiring gaps** — faculty load/department all 0/"—" despite real roster; most non-roster data is demo/mock.
