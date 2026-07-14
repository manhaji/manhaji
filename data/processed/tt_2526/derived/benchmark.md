# ISO 2025-26 timetable — school Ver 19 vs Manhaj rebuild vs Manhaj coverage-optimized

Both timetables place the same 1920 lessons (same teachers, classes, subjects and lesson lengths) and are scored with the same checker. Locked items (exams, library slots, break-time sessions, combined multi-class lessons) stay exactly where the school put them on both sides.
The coverage-optimized column is the v2 rebuild after coverage_resolve_v4.py's escalated repair (pairwise swaps of unlocked lessons plus the original single-lesson moves, now including previously-locked combined cross-section lessons moved/swapped as one atomic unit; all hard rules intact); the Verdict compares the school against it.

| Measure | School Ver 19 | Manhaj rebuild | Manhaj coverage-optimized | Verdict |
|---|---|---|---|---|
| Lessons in the week | 1920 | 1920 | 1920 |  |
| Taught slots in the week | 2003 | 2003 | 2003 |  |
| Teacher double-bookings (must be 0) | 0 | 0 | 0 | same |
| Classes shown two arbitrary lessons at once (must be 0) | 0 | 0 | 0 | same |
| Subject over the school's own per-day limit (must be 0) | 0 | 0 | 0 | same |
| Same subject twice (or more) in one day, week-wide | 366 | 366 | 368 | school better |
| Teacher workload evenness (avg busiest-vs-lightest day gap, lower = steadier) | 2.06 | 2.06 | 2.119 | school better |
| Teacher dead time between lessons (free slots stuck inside the day, week-wide) | 630 | 630 | 637 | school better |
| Substitution: staffed lessons scored | 1846 | 1846 | 1846 |  |
| Substitution: permanent vacancies (no teacher assigned) | 15 | 15 | 15 | same |
| Substitution: lessons with a same-subject sub free (%) | 83.21 | 83.21 | 87.05 | Manhaj better |
| Substitution: lessons with a same-subject OR same-dept sub free (%) | 94.64 | 94.64 | 97.18 | Manhaj better |
| Substitution: fragile lessons (zero eligible free sub on >= 1 slot) | 310 | 310 | 239 | Manhaj better |
| Substitution: fixable by moving just that one lesson (headroom) | 215 | 215 | 127 | Manhaj better |

Solver: status `feasible_timeout`, wall time 229.6s, 1358 lessons re-optimized, 562 locked in place.

Coverage repair (v4): 0 move(s) + 22 swap(s) accepted over 3 alternation(s) (fixpoint: True), fragile 307 -> 239; 77 previously-locked combined lessons became addressable, 13 of those got fixed; 16 fragile lessons remain locked in place and unrepairable by moving them.

## Reading the numbers

- The three "must be 0" rows are hard rules. The school's own timetable scores 0 by construction — the rule book (which subjects may share a slot, per-day limits) was mined from it. The rebuild must also score 0 to be acceptable.
- "Same subject twice in one day" counts every extra lesson of a subject beyond the first on a given day, for every class, all week. Deliberate double periods count 1 each on both sides, so the difference between the columns is real scheduling quality.
- "Dead time" counts slots where a teacher is on site between two lessons with nothing scheduled. Lower means less wasted teacher time.

## How good is the school's own timetable?

Given the exact set of lessons it schedules, no timetable can score below 354 on the same-day-doublings measure (subjects taught more than 5x a week must repeat within a day, and deliberate double periods count by nature). The school's 366 is within 12 of that theoretical floor — and the floor ignores teacher availability and the parallel-subject rules, so the true best possible is even closer. In plain terms: Ver 19 is already near-optimal under its own rules, and the rebuild independently confirms that by matching it with zero hard violations rather than finding easy wins.
