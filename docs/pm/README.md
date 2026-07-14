# Manhaji PM — how this works

This folder is the **sprint board** for Manhaji, driven by the `/pm` command and the
`product-manager` agent (with the `frontend-engineer`, `backend-engineer`,
`database-engineer` specialists). Design spec:
`docs/superpowers/specs/2026-07-10-pm-agent-design.md`.

## Files
- `backlog.md` — unscheduled work, newest ideas at the bottom.
- `board.json` — machine-readable current state (active sprint + tasks + status).
- `sprints/sprint-NN.md` — one file per sprint (goal, dates, task table, done-criteria).
- `reviews/YYYY-MM-DD-<topic>.md` — review reports (e.g. the Phase 1 review).

## Commands
- `/pm plan` — draft a sprint from goals/backlog (you approve before work starts).
- `/pm review [target]` — review recent work or the live site against the sprint.
- `/pm status` — where the active sprint stands.
- `/pm assign <task>` — a specialist builds it on a branch → PR (you approve + merge).

## The safety pipeline (never bypassed)
`branch → agent writes code → Pull Request → CI (lint+tests+build) → PM review → Elias
approves → merge to main`. Agents never touch `main` directly; live DB writes always need
Elias's approval. Branch protection (a hard GitHub lock) is deferred — it needs GitHub Pro
on the Emouawad1 account; until then the pipeline is enforced by CI + PM review.
