# Substitution-friendliness — school Ver 19 vs Manhaj rebuild vs Manhaj coverage-optimized

For every lesson actually taught, is at least one RELEVANT substitute teacher free at that exact time if the assigned teacher is absent? "Relevant" means: tier 1, someone who teaches the same subject elsewhere in this timetable; tier 2 (weaker), someone from the same subject department. Free means no lesson anywhere in the school (any grade band) whose real clock time overlaps that slot — cross-band period labels can share the exact same clock window, and this check treats that as a real clash.

The coverage-optimized column is the v2 rebuild after coverage_resolve_v4.py's escalated repair (pairwise swaps of unlocked lessons plus coverage_resolve.py's original single-lesson moves, now including previously-locked combined cross-section lessons moved/swapped as one atomic unit; all hard rules intact, never net-decreasing tier-1 coverage). The Verdict compares the school against it.

| Measure | School Ver 19 | Manhaj rebuild | Manhaj coverage-optimized | Verdict |
|---|---|---|---|---|
| Staffed teaching lessons scored | 1846 | 1846 | 1846 |  |
| Permanently uncovered (vacancy — no teacher assigned) | 15 | 15 | 15 | same |
| Lessons with a same-subject substitute free (%) | 83.21 | 83.21 | 87.05 | Manhaj better |
| Lessons with a same-subject OR same-department substitute free (%) | 94.64 | 94.64 | 97.18 | Manhaj better |
| Average same-subject cover depth (free qualified subs per slot) | 2.965 | 2.96 | 2.99 | Manhaj better |
| Worst-case same-subject cover depth (minimum over all slots) | 0 | 0 | 0 | same |
| Fragile lessons (zero eligible free sub on >= 1 slot) | 310 | 310 | 239 | Manhaj better |
| Fixable by moving just that one lesson (headroom) | 215 | 215 | 127 | Manhaj better |

Subjects missing from the department map: 96 scored lessons (school) / 96 (rebuild) teach a subject with no entry in subject_departments.json — those lessons can only ever get a tier-1 (same-subject) cover, never a tier-2 department fallback, until the map is extended.

## Reading the numbers

- "Fragile" lessons are the real risk list: if that teacher calls in sick, there is nobody qualified and free to cover at least one of that lesson's slots. A multi-slot (double) lesson only counts as covered if EVERY slot clears the bar — a substitute for period 1 of a double who is busy in period 2 does not fully cover it.
- "Fixable by moving just that one lesson" is a lower-bound headroom estimate: holding every other lesson fixed, would ANY other (day, slot) placement in that lesson's own band give it a free same-subject substitute at every slot, without stealing the assigned teacher's own availability? It does not explore moving any OTHER lesson, so a full coverage-aware re-solve could do better still.
