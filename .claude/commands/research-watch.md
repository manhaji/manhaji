---
description: Weekly change-check on an existing research topic's official sources. Reports only what changed.
argument-hint: "<topic-slug>  (e.g. oman-regulatory-reporting)"
---

Monitor the research topic: **$ARGUMENTS**

1. Confirm `docs/research/$ARGUMENTS/` exists. If not, tell me — there's nothing
   to watch yet; I should run `/research` first to establish a baseline.
2. Delegate to the **researcher** agent in **MONITOR (Mode B)** for this topic.
   It reads `sources.md` + the latest `report.md`, re-fetches each official
   source (prioritise the most direct — the ministry / regulator itself), and
   compares against the baseline.
3. The agent writes `docs/research/$ARGUMENTS/watch/<today>.md` with a per-source
   delta and updates `report.md` + `sources.md` if something genuinely changed.
4. Report back to me:
   - **If nothing changed:** one line — "No changes across N sources this week."
   - **If something changed:** lead with what needs my attention, the change, the
     evidence URL, and what it means for Manhaj (e.g. the Reports module).

Most weeks the correct answer is "no change." Do not invent changes. Only
surface real, evidenced differences from the baseline.
