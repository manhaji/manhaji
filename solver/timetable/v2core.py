"""Timetable rebuild engine v2 — pure function, OR-Tools CP-SAT.

rebuild(request: dict) -> dict per solver/timetable/v2models.py. No DB, no
HTTP. Rebuilds a school's timetable from its own canonical lessons under the
REAL constraints (encoding the v2 guard rails from
docs/timetable_builder_v2_requirements.md):

- Demand = the canonical lessons themselves (same teacher/section/subject/
  length); the solver chooses NEW (day, slot-run) placements.
- HARD: teacher clash-free (teacher strings are atomic resources; composites
  like "IBZ / H" are one resource; unstaffed lessons have no teacher
  constraint); per-band bell grids (teaching slots only, never breaks);
  section overlap legality via explicit parallel groups (only mined subject
  pairs may co-occur, a subject never overlaps itself, no blanket parallelism
  cap); mined per-(section,subject) max-per-day caps (counted in SLOTS per
  day, matching how mined_rules per_week counts slots); multi-slot lessons on
  contiguous teaching slots with no break row inside the run; locked lessons
  (non_teaching, break-slot source data, combined cross-section) stay at
  their source placement but still consume teacher/section occupancy; every
  non-locked lesson placed exactly once at its source length.
- SOFT (weighted objective): spread same (section,subject) across distinct
  days; teacher daily balance soft-capped at ceil(weekly/len(days))+1.

CP-SAT mechanics reused from v1 (solver/timetable/core.py, hard-won):
two-stage warm start, status_of/resolve_status, explicit incumbent detection
via len(solver.ResponseProto().solution) > 0, linearization_level=0,
random_seed=42, num_search_workers=1 (determinism over speed). Additionally
stage 1 is hinted with the school's own source placement, which is known to
be hard-feasible for the mined rules (they were mined from it).
"""
import math
import re
from collections import defaultdict
from datetime import datetime, timezone

from ortools.sat.python import cp_model

from solver.timetable.core import resolve_status, status_of
from solver.timetable.v2models import (
    PlacedLesson,
    Quality,
    RebuildRequest,
    RebuildResponse,
    RebuildSource,
)

SOLVER_VERSION = "2.0.0"

_GRADE_RE = re.compile(r"^Grade\s*(\d+)", re.IGNORECASE)


def band_of(section: str) -> str:
    """Map a section name to its bell band. KG* -> KG; Grade 1-6 (incl. AL
    sections, with or without a space: 'Grade 2AL', 'Grade 5 AL') -> GR1_6;
    Grade 7-12 (incl. suffixes like '11B-AS', '12C-A2') -> GR7_12."""
    s = section.strip()
    if s.upper().startswith("KG"):
        return "KG"
    m = _GRADE_RE.match(s)
    if m:
        grade = int(m.group(1))
        if 1 <= grade <= 6:
            return "GR1_6"
        if 7 <= grade <= 12:
            return "GR7_12"
    raise ValueError(f"cannot map section {section!r} to a bell band")


def detect_locks(lessons, band_teaching):
    """Return a parallel list of lock reasons (None = movable).

    Precedence: non_teaching > break/off-grid source slot > combined
    cross-section. Combined = identical (teacher, day, tuple(slots), subject)
    appearing in >= 2 distinct sections — one physical lesson recorded once
    per participating section; it stays at its source placement.
    """
    combo_sections = defaultdict(set)
    for l in lessons:
        if l.teacher:
            combo_sections[(l.teacher, l.day, tuple(l.slots), l.subject)].add(
                l.section)
    combined = {k for k, v in combo_sections.items() if len(v) >= 2}

    reasons = []
    for l in lessons:
        if l.non_teaching:
            reasons.append("non_teaching")
        elif any(s not in band_teaching[band_of(l.section)] for s in l.slots):
            reasons.append("break_slot_source_data")
        elif l.teacher and (l.teacher, l.day, tuple(l.slots),
                            l.subject) in combined:
            reasons.append("combined_cross_section")
        else:
            reasons.append(None)
    return reasons


def _band_runs(bell_rows, length):
    """Legal slot-runs of `length` contiguous teaching slots: consecutive
    rows of the band's bell table, all teaching (a break row anywhere inside
    the window kills the run)."""
    runs = []
    for i in range(len(bell_rows) - length + 1):
        window = bell_rows[i:i + length]
        if all(r.teaching for r in window):
            runs.append(tuple(r.slot for r in window))
    return runs


def _make_solver(budget_s) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.random_seed = 42
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = budget_s
    solver.parameters.linearization_level = 0  # ~30x on v1's model; keep
    return solver


def _build_model(req, movable, locked, legal_pairs, caps, include_soft):
    """Construct the CP-SAT model.

    movable: list of (lesson, band) — decision lessons.
    locked:  list of (lesson, reason) — fixed occupancy constants.
    Returns (model, x, spread_vars, balance_vars) where
    x[(i, day, run)] are the placement booleans.
    """
    days = list(req.days)
    model = cp_model.CpModel()

    runs_cache = {}  # (band, length) -> list of slot-run tuples

    def runs_for(band, length):
        key = (band, length)
        if key not in runs_cache:
            runs_cache[key] = _band_runs(req.bells[band], length)
        return runs_cache[key]

    # ---- decision variables: one boolean per (lesson, day, slot-run) ------
    x = {}
    for i, (l, band) in enumerate(movable):
        runs = runs_for(band, len(l.slots))
        if not runs:
            raise _Infeasible(
                f"no contiguous {len(l.slots)}-slot run exists in band {band} "
                f"for {l.section} / {l.subject}")
        vars_i = []
        for d in days:
            for run in runs:
                v = model.NewBoolVar(f"x_{i}_{d}_{'_'.join(run)}")
                x[(i, d, run)] = v
                vars_i.append(v)
        model.AddExactlyOne(vars_i)  # rule 7: placed exactly once

    # ---- occupancy indexes -------------------------------------------------
    # decision occupancy: (key..., day, slot) -> [vars]; locked: -> count
    teacher_occ = defaultdict(list)
    teacher_locked = defaultdict(int)
    sec_subj_occ = defaultdict(list)      # (section, subject, day, slot)
    sec_subj_locked = defaultdict(int)
    day_terms = defaultdict(list)         # (section, subject, day) -> [(var, L)]
    day_locked = defaultdict(int)         # (section, subject, day) -> slots
    t_day_terms = defaultdict(list)       # (teacher, day) -> [(var, L)]
    t_day_locked = defaultdict(int)
    teacher_weekly = defaultdict(int)     # teacher -> total weekly slots

    for i, (l, band) in enumerate(movable):
        L = len(l.slots)
        if l.teacher:
            teacher_weekly[l.teacher] += L
        for d in days:
            for run in runs_for(band, L):
                v = x[(i, d, run)]
                for s in run:
                    if l.teacher:
                        teacher_occ[(l.teacher, d, s)].append(v)
                    sec_subj_occ[(l.section, l.subject, d, s)].append(v)
                day_terms[(l.section, l.subject, d)].append((v, L))
                if l.teacher:
                    t_day_terms[(l.teacher, d)].append((v, L))

    # Locked lessons: constants. For TEACHER occupancy, a combined lesson
    # (same teacher/day/slots/subject in >=2 sections) is ONE physical lesson
    # — count it once, not once per section record.
    seen_physical = set()
    for l, reason in locked:
        L = len(l.slots)
        is_new_physical = True
        if l.teacher:
            phys = (l.teacher, l.day, tuple(l.slots), l.subject)
            is_new_physical = phys not in seen_physical
            seen_physical.add(phys)
            if is_new_physical:
                teacher_weekly[l.teacher] += L
                for s in l.slots:
                    teacher_locked[(l.teacher, l.day, s)] += 1
                t_day_locked[(l.teacher, l.day)] += L
        for s in l.slots:
            sec_subj_locked[(l.section, l.subject, l.day, s)] += 1
        day_locked[(l.section, l.subject, l.day)] += L

    # ---- rule 1: teacher clash-free ---------------------------------------
    for key in sorted(teacher_occ):
        cap = max(0, 1 - teacher_locked.get(key, 0))
        model.Add(sum(teacher_occ[key]) <= cap)

    # ---- rule 3: section overlap legality ---------------------------------
    # (a) a subject never overlaps itself
    for key in sorted(sec_subj_occ):
        cap = max(0, 1 - sec_subj_locked.get(key, 0))
        model.Add(sum(sec_subj_occ[key]) <= cap)
    # (b) two different subjects of one section co-occur only if their pair
    #     is legal per parallel_groups
    sec_subjects = defaultdict(set)
    for l, _ in movable:
        sec_subjects[l.section].add(l.subject)
    for l, _ in locked:
        sec_subjects[l.section].add(l.subject)
    all_cells = [(d, s) for d in days
                 for s in sorted({sl for band in req.bells
                                  for sl in (r.slot for r in req.bells[band])})]
    for section in sorted(sec_subjects):
        subjects = sorted(sec_subjects[section])
        pairs = [(a, b) for ai, a in enumerate(subjects)
                 for b in subjects[ai + 1:]
                 if frozenset((a, b)) not in legal_pairs.get(section, set())]
        for a, b in pairs:
            for d, s in all_cells:
                va = sec_subj_occ.get((section, a, d, s), [])
                vb = sec_subj_occ.get((section, b, d, s), [])
                const = (sec_subj_locked.get((section, a, d, s), 0)
                         + sec_subj_locked.get((section, b, d, s), 0))
                if (va and (vb or const)) or (vb and (va or const)) \
                        or (va and vb):
                    model.Add(sum(va) + sum(vb) <= max(0, 1 - const))

    # ---- rule 4: mined per-day caps (slots per day) ------------------------
    for (section, subject, d) in sorted(day_terms):
        cap = caps[(section, subject)]
        terms = day_terms[(section, subject, d)]
        const = day_locked.get((section, subject, d), 0)
        model.Add(sum(v * L for v, L in terms) <= max(0, cap - const))

    if not include_soft:
        return model, x, [], []

    # ---- soft: spread (penalize >1 slot/day within the hard cap) -----------
    spread_vars = []
    group_weekly = defaultdict(int)
    for l, _ in movable:
        group_weekly[(l.section, l.subject)] += len(l.slots)
    for l, _ in locked:
        group_weekly[(l.section, l.subject)] += len(l.slots)
    for (section, subject) in sorted(group_weekly):
        if group_weekly[(section, subject)] <= 1:
            continue  # can never double
        cap = caps.get((section, subject),
                       group_weekly[(section, subject)])
        for d in days:
            terms = day_terms.get((section, subject, d), [])
            const = day_locked.get((section, subject, d), 0)
            if not terms and const <= 1:
                continue
            dbl = model.NewIntVar(0, max(cap, const),
                                  f"dbl_{section}_{subject}_{d}")
            model.Add(dbl >= sum(v * L for v, L in terms) + const - 1)
            spread_vars.append(dbl)

    # ---- soft: teacher daily balance ---------------------------------------
    balance_vars = []
    max_day_slots = max(len([r for r in rows if r.teaching])
                        for rows in req.bells.values())
    for t in sorted(teacher_weekly):
        soft_cap = math.ceil(teacher_weekly[t] / max(1, len(days))) + 1
        for d in days:
            terms = t_day_terms.get((t, d), [])
            const = t_day_locked.get((t, d), 0)
            if not terms and const <= soft_cap:
                continue
            over = model.NewIntVar(0, max_day_slots, f"over_{t}_{d}")
            model.Add(over >= sum(v * L for v, L in terms) + const - soft_cap)
            balance_vars.append(over)

    model.Minimize(req.policy.spread_weight * sum(spread_vars)
                   + req.policy.balance_weight * sum(balance_vars))
    return model, x, spread_vars, balance_vars


class _Infeasible(Exception):
    """Structural infeasibility detected during model build."""


def _source() -> RebuildSource:
    return RebuildSource(solver_version=SOLVER_VERSION,
                         generated_at=datetime.now(timezone.utc).isoformat())


def _response(status, lessons, spread, balance, objective, gap_report):
    return RebuildResponse(
        status=status, lessons=lessons,
        quality=Quality(spread_penalty=spread, balance_penalty=balance,
                        objective=objective),
        gap_report=gap_report, source=_source(),
    ).model_dump()


def rebuild(request: dict) -> dict:
    req = RebuildRequest.model_validate(request)
    days = list(req.days)
    gap_report = []

    band_teaching = {band: {r.slot for r in rows if r.teaching}
                     for band, rows in req.bells.items()}
    for l in req.canonical_lessons:
        band = band_of(l.section)  # raises loudly on unmappable sections
        if band not in req.bells:
            raise ValueError(f"section {l.section!r} maps to band {band!r} "
                             f"which is missing from request bells")

    # Deterministic ordering: model build iterates this sorted list.
    ordered = sorted(
        req.canonical_lessons,
        key=lambda l: (l.section, l.subject, l.teacher or "", l.day,
                       tuple(l.slots)))
    reasons = detect_locks(ordered, band_teaching)
    movable = [(l, band_of(l.section)) for l, r in zip(ordered, reasons)
               if r is None]
    locked = [(l, r) for l, r in zip(ordered, reasons) if r is not None]

    # Legal overlap pairs per section (frozenset semantics; a subject is
    # never legal with itself — same-subject stacking is barred separately).
    legal_pairs = {}
    for section, groups in req.parallel_groups.items():
        pairs = set()
        for g in groups:
            subs = sorted(set(g.subjects))
            for ai, a in enumerate(subs):
                for b in subs[ai + 1:]:
                    pairs.add(frozenset((a, b)))
        legal_pairs[section] = pairs

    # Per-(section,subject) hard day caps, in slots/day. Missing rule ->
    # generous fallback (that pair's weekly slot count) + gap_report note.
    rules = {(r.section, r.subject): r.max_per_day for r in req.mined_rules}
    weekly = defaultdict(int)
    for l in ordered:
        weekly[(l.section, l.subject)] += len(l.slots)
    caps = {}
    missing = []
    for key in sorted(weekly):
        if key in rules:
            caps[key] = rules[key]
        else:
            caps[key] = weekly[key]
            missing.append(key)
    if missing:
        gap_report.append(
            f"{len(missing)} (section,subject) pairs have no mined rule; "
            f"per-day cap fell back to their weekly slot count: "
            + ", ".join(f"{s}/{j}" for s, j in missing[:8])
            + ("..." if len(missing) > 8 else ""))

    try:
        # ---- stage 1: hard rules only, hinted with the school's own
        # placement (known-feasible for rules mined from it) ------------------
        stage1_budget = (min(15, max(2, req.policy.time_limit_s // 3))
                         if req.policy.time_limit_s > 0 else 0)
        model1, x1, _, _ = _build_model(req, movable, locked, legal_pairs,
                                        caps, include_soft=False)
        hint = None
        if stage1_budget > 0:
            for i, (l, band) in enumerate(movable):
                key = (i, l.day, tuple(l.slots))
                if key in x1:
                    model1.AddHint(x1[key], 1)
            solver1 = _make_solver(stage1_budget)
            solver1.Solve(model1)
            # Explicit incumbent check — Value() returns garbage without one.
            if len(solver1.ResponseProto().solution) > 0:
                hint = {k: solver1.Value(v) for k, v in x1.items()}

        # ---- stage 2: hard + soft, warm-started ------------------------------
        model, x, spread_vars, balance_vars = _build_model(
            req, movable, locked, legal_pairs, caps, include_soft=True)
        if hint:
            for k, val in hint.items():
                model.AddHint(x[k], val)
        solver = _make_solver(max(1, req.policy.time_limit_s - stage1_budget))
        result = solver.Solve(model)
    except _Infeasible as e:
        return _response("infeasible", [], 0, 0, 0,
                         [f"structurally infeasible: {e}"] + gap_report)

    if status_of(result) == "infeasible":  # raises loudly on MODEL_INVALID
        return _response(
            "infeasible", [], 0, 0, 0,
            ["solver returned infeasible — demand cannot be placed under the "
             "hard rules (band grids, parallel groups, per-day caps, locks)"]
            + gap_report)

    has_incumbent = len(solver.ResponseProto().solution) > 0
    if not has_incumbent:
        return _response(
            "unknown_timeout", [], 0, 0, 0,
            ["time budget exhausted before any timetable was found — NOT "
             "proven infeasible; retry with a larger time_limit_s"]
            + gap_report)

    # ---- extract ------------------------------------------------------------
    out_by_lesson = {}
    for i, (l, band) in enumerate(movable):
        chosen = None
        for d in days:
            for run in _band_runs(req.bells[band], len(l.slots)):
                if solver.Value(x[(i, d, run)]):
                    chosen = (d, list(run))
                    break
            if chosen:
                break
        assert chosen is not None, "exactly-one constraint guarantees a pick"
        out_by_lesson[id(l)] = PlacedLesson(
            section=l.section, day=chosen[0], slots=chosen[1],
            subject=l.subject, teacher=l.teacher, non_teaching=l.non_teaching,
            unstaffed=l.unstaffed, locked=False, lock_reason=None)
    for l, reason in locked:
        out_by_lesson[id(l)] = PlacedLesson(
            section=l.section, day=l.day, slots=list(l.slots),
            subject=l.subject, teacher=l.teacher, non_teaching=l.non_teaching,
            unstaffed=l.unstaffed, locked=True, lock_reason=reason)
    lessons_out = [out_by_lesson[id(l)] for l in ordered]

    spread = sum(solver.Value(v) for v in spread_vars)
    balance = sum(solver.Value(v) for v in balance_vars)
    if result in (cp_model.UNKNOWN, cp_model.FEASIBLE):
        gap_report.append("time budget hit — returning best-found timetable, "
                          "not proven optimal")
    return _response(resolve_status(result, True), lessons_out, spread,
                     balance, int(solver.ObjectiveValue()), gap_report)
