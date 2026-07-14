#!/usr/bin/env python3
"""Precompute cover plans for the principal dashboard's "what if a teacher is
absent" simulator — one /solve request per (real teacher, day they teach),
run through solver/core.solve(), so the dashboard can render results
instantly from a static embedded JSON blob instead of solving on click.

Reuses the free/busy + eligibility conventions of
solver/timetable/substitution_score.py (wall-clock index, cross-band
bridging) and the request-assembly shape of solver/adapter_2526.py
(cross-band wall-clock busy bridging), but built purely from the committed
derived artifacts — no DB.

Scope rules (per the founder's spec):
- EVERY real teacher: skip 'Exam Officer', 'Melissa - New teacher', any
  composite co-teaching string containing '/', and None (unstaffed).
- Each day Sun..Thu where that teacher has >= 1 staffed teaching lesson in
  canonical_lessons.json.
- periods='all' (the whole day out); slots_to_cover = exactly that
  teacher's lessons that day.
- Candidate pool = every OTHER real teacher, with:
    - busy: cross-band wall-clock-bridged busy bell ids for that day
      (see build_busy_bell_ids)
    - subject_ids: subjects they teach anywhere in this timetable
    - department: via subject_departments.json, majority vote over their
      taught subjects (ties broken by sorted-name determinism, matching
      Python's max(..., key=...) stable-first-max behavior over a
      deterministically sorted candidate list)
    - max_periods_per_day: 6 (flat, per spec)
    - cover_done_recently: 0 (flat, per spec — no substitution history in
      this artifact-only exercise)
- policy: solver defaults (solver.models.Policy()).

Determinism: teachers and days iterated in sorted order; lessons/slots
sorted; solve() itself sorts its own inputs and uses a fixed CP-SAT seed.

CLI:
    cd /Users/eliasmouawad/dev/manhaj && PYTHONPATH=. \
        .venv/bin/python solver/timetable/precompute_covers.py
Writes: data/processed/tt_2526/derived/cover_plans.json
"""
import json
import time
from collections import defaultdict
from pathlib import Path

from solver.core import solve
from solver.timetable.v2core import band_of

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]

REAL_TEACHERS_EXCLUDE = {"Exam Officer", "Melissa - New teacher"}

MAX_PERIODS_PER_DAY = 6


def is_real_teacher(name) -> bool:
    """A 'real' teacher for cover-plan purposes: not None, not one of the
    two named placeholders, and not a composite co-teaching string (contains
    '/', e.g. 'IBZ / H')."""
    if not name:
        return False
    if name in REAL_TEACHERS_EXCLUDE:
        return False
    if "/" in name:
        return False
    return True


def _get(l, key, default=None):
    return l.get(key, default) if isinstance(l, dict) else getattr(l, key, default)


def _to_minutes(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def build_wallclock_index(bells):
    """(band, slot) -> (start_min, end_min) for every row of every band's
    bell table (teaching AND non-teaching rows)."""
    idx = {}
    for band, rows in bells.items():
        for r in rows:
            slot = _get(r, "slot")
            start = _to_minutes(_get(r, "start"))
            end = _to_minutes(_get(r, "end"))
            idx[(band, slot)] = (start, end)
    return idx


def build_busy_bell_ids(teacher, day, lessons, bells):
    """Every band-qualified slot id ("{band}:{slot}") `teacher` is
    unavailable for on `day`, cross-band wall-clock bridged: if they have a
    real lesson at (band A, slot X), any (band B, slot Y) whose wall-clock
    window overlaps (band A, slot X)'s window is ALSO marked busy, for every
    band B in `bells` (not just the bands the teacher personally teaches
    in) — mirrors solver/adapter_2526.py's documented cross-band bridge and
    substitution_score.py's overlap (not just equality) semantics.
    """
    wallclock = build_wallclock_index(bells)

    own_windows = []
    for l in lessons:
        if _get(l, "teacher") != teacher or _get(l, "day") != day:
            continue
        band = band_of(_get(l, "section"))
        for slot in _get(l, "slots"):
            window = wallclock.get((band, slot))
            if window is not None:
                own_windows.append(window)

    busy = set()
    for band, rows in bells.items():
        for r in rows:
            slot = _get(r, "slot")
            window = wallclock.get((band, slot))
            if window is None:
                continue
            if any(_overlaps(window[0], window[1], w[0], w[1]) for w in own_windows):
                busy.add(f"{band}:{slot}")
    return busy


def teacher_subjects(lessons):
    """teacher -> set of subjects taught anywhere in this timetable (staffed,
    real teachers only)."""
    out = defaultdict(set)
    for l in lessons:
        t = _get(l, "teacher")
        if not is_real_teacher(t):
            continue
        out[t].add(_get(l, "subject"))
    return dict(out)


def teacher_department(teacher, subjects_by_teacher, subject_depts):
    """Majority-vote department over a teacher's taught subjects, via
    subject_departments.json. None if no taught subject has a mapped
    department. Ties broken deterministically by sorted department name."""
    subs = subjects_by_teacher.get(teacher, set())
    depts = [subject_depts[s] for s in subs if s in subject_depts]
    if not depts:
        return None
    counts = defaultdict(int)
    for d in depts:
        counts[d] += 1
    best_count = max(counts.values())
    tied = sorted(d for d, c in counts.items() if c == best_count)
    return tied[0]


def _slot_id(section, day, slot, subject):
    return f"{section}|{day}|{slot}|{subject}"


def build_request_for_absence(teacher, day, lessons, bells, subject_depts,
                               all_teachers):
    """Assemble a solver.models.SolveRequest-shaped dict for `teacher` being
    absent all day `day`. `all_teachers` is the full real-teacher roster
    (candidate pool = all_teachers minus `teacher`)."""
    subjects_by_teacher = teacher_subjects(lessons)

    my_lessons = sorted(
        (l for l in lessons
         if _get(l, "teacher") == teacher and _get(l, "day") == day
         and not _get(l, "non_teaching")),
        key=lambda l: (_get(l, "section"), tuple(_get(l, "slots"))),
    )

    slots_to_cover = []
    for l in my_lessons:
        section = _get(l, "section")
        subject = _get(l, "subject")
        for slot in _get(l, "slots"):
            slots_to_cover.append({
                "slot_id": _slot_id(section, day, slot, subject),
                "date": day,
                "bell_period_id": f"{band_of(section)}:{slot}",
                "day_of_week": day,
                "section_id": section,
                "subject_id": subject,
                "room_id": None,
                "teacher_id": teacher,
            })

    candidate_names = sorted(t for t in all_teachers if t != teacher)
    teachers_payload = []
    for t in candidate_names:
        busy_ids = build_busy_bell_ids(t, day, lessons, bells)
        teachers_payload.append({
            "teacher_id": t,
            "subject_ids": sorted(subjects_by_teacher.get(t, set())),
            "department": teacher_department(t, subjects_by_teacher, subject_depts),
            "max_periods_per_day": MAX_PERIODS_PER_DAY,
            "busy": [{"date": day, "bell_period_id": bid} for bid in sorted(busy_ids)],
            "free_periods_today": {},
            "cover_done_recently": 0,
        })

    return {
        "scope": {
            "school_id": "iso-oman",
            "academic_year_id": "2025-2026",
            "date_from": day,
            "date_to": day,
        },
        "absences": [{
            "teacher_id": teacher,
            "dates": [day],
            "periods": "all",
            "reason": "principal-dashboard simulation",
        }],
        "slots_to_cover": slots_to_cover,
        "teachers": teachers_payload,
    }


# ---------------------------------------------------------------------------
# Human-readable cover-plan rendering (no ids in the output)
# ---------------------------------------------------------------------------

def _label(slot):
    return f"{slot['section_id']} · {slot['subject_id']} · {slot['bell_period_id'].split(':', 1)[1]}"


def _render_plan(request, response):
    slot_by_id = {s["slot_id"]: s for s in request["slots_to_cover"]}

    assignments = []
    for a in response["assignments"]:
        s = slot_by_id[a["slot_id"]]
        why = ("teaches the same subject" if a["match_type"] == "same_subject"
               else "same department")
        assignments.append({
            "period": s["bell_period_id"].split(":", 1)[1],
            "section": s["section_id"],
            "subject": s["subject_id"],
            "substitute": a["substitute_teacher_id"],
            "match_type": a["match_type"],
            "reason": why,
            "alternatives": [alt["substitute_teacher_id"] for alt in a["alternatives"]],
        })
    assignments.sort(key=lambda x: (x["period"], x["section"]))

    unfilled = []
    for u in response["unfilled"]:
        s = slot_by_id[u["slot_id"]]
        unfilled.append({
            "period": s["bell_period_id"].split(":", 1)[1],
            "section": s["section_id"],
            "subject": s["subject_id"],
            "reason": u["reason"],
        })
    unfilled.sort(key=lambda x: (x["period"], x["section"]))

    return {
        "assignments": assignments,
        "unfilled": unfilled,
        "summary": {
            "slots_total": response["summary"]["slots_total"],
            "filled": response["summary"]["filled"],
            "unfilled": response["summary"]["unfilled"],
            "status": response["status"],
            "notes": response["notes_for_admin"],
        },
    }


def main():
    t0 = time.time()
    canonical = json.loads((DERIVED / "canonical_lessons.json").read_text())
    bells = json.loads((DERIVED / "bells.json").read_text())
    subject_depts = json.loads((DERIVED / "subject_departments.json").read_text())

    all_teachers = sorted({
        _get(l, "teacher") for l in canonical if is_real_teacher(_get(l, "teacher"))
    })

    # week index: teacher -> day -> count of lessons that day (staffed
    # teaching lessons only)
    week_index = defaultdict(lambda: defaultdict(int))
    for l in canonical:
        t = _get(l, "teacher")
        if not is_real_teacher(t) or _get(l, "non_teaching"):
            continue
        week_index[t][_get(l, "day")] += 1

    cover_plans = {}
    runs = 0
    total_slots = 0
    total_filled = 0
    total_unfilled = 0

    for teacher in all_teachers:
        cover_plans[teacher] = {}
        for day in DAYS:
            if week_index[teacher].get(day, 0) == 0:
                continue
            request = build_request_for_absence(teacher, day, canonical, bells,
                                                 subject_depts, all_teachers)
            response = solve(request)
            runs += 1
            total_slots += response["summary"]["slots_total"]
            total_filled += response["summary"]["filled"]
            total_unfilled += response["summary"]["unfilled"]
            cover_plans[teacher][day] = _render_plan(request, response)

    wall_time = round(time.time() - t0, 2)
    covered_pct = round(100.0 * total_filled / total_slots, 2) if total_slots else 0.0

    out = {
        "cover_plans": cover_plans,
        "week_index": {t: dict(days) for t, days in week_index.items()},
        "meta": {
            "teachers": len(all_teachers),
            "runs": runs,
            "slots_total": total_slots,
            "slots_filled": total_filled,
            "slots_unfilled": total_unfilled,
            "covered_pct": covered_pct,
            "wall_time_s": wall_time,
        },
    }

    out_path = DERIVED / "cover_plans.json"
    out_path.write_text(json.dumps(out, indent=2))

    # Cross-check required by spec: Mohammed Saab Monday -> 5/5 same-subject.
    saab_mon = cover_plans.get("Mohammed Saab", {}).get("Mon")
    saab_ok = bool(
        saab_mon
        and saab_mon["summary"]["slots_total"] == 5
        and saab_mon["summary"]["filled"] == 5
        and all(a["match_type"] == "same_subject" for a in saab_mon["assignments"])
    )

    print(f"wrote {out_path} ({out_path.stat().st_size // 1024} KB)")
    print(f"teachers: {len(all_teachers)}  runs: {runs}  wall time: {wall_time}s")
    print(f"slots: {total_slots}  filled: {total_filled} ({covered_pct}%)  "
          f"unfilled: {total_unfilled}")
    print(f"CROSS-CHECK Mohammed Saab Monday 5/5 same-subject: "
          f"{'PASS' if saab_ok else 'FAIL'}")
    if not saab_ok:
        raise SystemExit("Saab Monday cross-check FAILED — see output above.")


if __name__ == "__main__":
    main()
