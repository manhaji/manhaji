---
description: Run deep, source-cited research on a topic and file the report under docs/research/.
argument-hint: "\"<topic or question>\"  (e.g. \"university outcomes data for Oman IGCSE schools\")"
---

Run a deep-research pass on: **$ARGUMENTS**

1. Pick a short kebab-case `<topic-slug>` for this topic (reuse the existing
   folder if `docs/research/<slug>/` already exists — this is a refresh).
2. Delegate to the **researcher** agent in **DEEP RESEARCH (Mode A)**. Give it
   the topic, the Manhaj context (school-ops SaaS, Oman beachhead = International
   School of Oman, this feeds Product/Engineering/Sales), and today's date.
3. The agent writes `docs/research/<slug>/report.md` + `sources.md` and updates
   `docs/research/INDEX.md`.
4. When it returns, show me: the headline findings (5–8 bullets), anything that
   needs a decision from me, and the file path. Then ask if I want it exported
   to PDF for Google Drive `05 Research` (use the pdf skill) and whether to set
   up a weekly `/research-watch <slug>` on its sources.

Keep it honest: cite primary sources, flag low-confidence items, and tell me
plainly what could not be verified online.
