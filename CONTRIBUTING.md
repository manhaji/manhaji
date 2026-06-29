# Contributing to Manhaj

Welcome to the team. This guide explains how we work together on the code **without breaking the live product.** It's written to be readable by anyone, technical or not.

## The golden rule

**Never push directly to `main`.** `main` is the trusted, live version of the code. All changes go through a **Pull Request (PR)** that must pass automated checks before it can merge.

## The everyday workflow

1. Get the latest code:
   ```bash
   git checkout main
   git pull
   ```
2. Create your own branch (a private sandbox copy):
   ```bash
   git checkout -b yourname/short-description
   ```
3. Make your changes. Run the app locally and confirm it works.
4. Run the same checks the robots will run, before you push:
   ```bash
   npm install
   npx turbo lint   # code style
   npx turbo test   # tests
   npx turbo build --filter=@manhaj/portal  # confirms the app compiles
   ```
5. Commit and push your branch:
   ```bash
   git push -u origin yourname/short-description
   ```
6. Open a **Pull Request** on GitHub, targeting `main`.
7. The automated checks (CI) run on their own. Wait for them to go green.
8. Once green, merge the PR and delete the branch.

## Branch naming

`yourname/what-it-does` — for example: `sara/import-roster`, `sara/fix-attendance-bug`.

## What the automated checks do

Every PR automatically runs three checks (see `.github/workflows/ci.yml`):
- **Lint** — code style consistency
- **Test** — the test suite (`npm test`)
- **Build** — confirms the app actually compiles

If any check fails, the PR is blocked. Read the failure, fix it, push again — the checks re-run automatically.

## Data safety — critical

- **NEVER commit a school's data**: student or parent records, raw spreadsheets, or `.env` files.
- Raw source files belong in `data/source/` (already git-ignored).
- Real records live only in **Supabase**, never in this repository.
- When in doubt, ask before committing anything that contains real names or contact details.

## Where to start (first day)

Read these, in order:
1. `README.md` — the folder map
2. `docs/golive_architecture_review.md` — the three-tier build plan
3. `docs/data_storage_policy.md` — what goes in git vs. the database
4. `schema/001_init.sql` and `schema/003_spine.sql` — the data model
5. `etl/parse_workbook.py` — how a school's spreadsheet becomes clean data

Also read the **Architecture & Onboarding Brief** PDF for the big-picture overview.

## Getting help

Ask the founder. If you're stuck, push your branch and open a **draft** PR so your work-in-progress is visible and we can look together.
