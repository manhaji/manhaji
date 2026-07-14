"""Timetable builder core — pure function, OR-Tools CP-SAT.

build(request: dict) -> dict per solver/timetable/models.py. No DB, no HTTP.

Model in one paragraph: one boolean per (demand, grid-cell) pair, where a
demand is "teacher T teaches subject J to section S, W times a week" and a
cell is (day, period). Hard rules: a teacher sits in at most one cell at a
time; every demand is placed exactly W times — unless the teacher is
physically over-committed (total demand > cells in the week), in which case
we place as many as possible and report the shortfall; a section runs at
most ceil(section_load / cells) lessons in parallel (the elective-groups
reality discovered in the audit). Soft rules: spread repeated subjects
across days; balance teacher daily loads.

Determinism: sorted inputs, fixed seed, one worker. Two-stage warm start:
a hard-rules-only model is solved first and its solution fed to the full
model as a CP-SAT hint, so a time-budget expiry still returns a valid
timetable. Both stages use seed 42 and num_search_workers=1 — a deliberate
determinism-over-speed decision.
"""
import math
from collections import defaultdict
from datetime import datetime, timezone

from ortools.sat.python import cp_model

from solver.timetable.models import (
    BuildRequest,
    BuildResponse,
    BuildSource,
    PlacedSlot,
    Quality,
)

SOLVER_VERSION = "0.1.0"
PLACEMENT_WEIGHT = 1000  # priority of placing an over-committed teacher's lessons


def status_of(result) -> str:
    """Map a CpSolver result to the contract status.

    Note: when the model has no objective (no over-committed teachers),
    CP-SAT reports OPTIMAL for any feasible assignment — "solved" then
    means "valid", not "best possible".
    """
    if result == cp_model.OPTIMAL:
        return "solved"
    if result == cp_model.FEASIBLE:
        return "feasible_timeout"
    if result == cp_model.INFEASIBLE:
        return "infeasible"
    if result == cp_model.MODEL_INVALID:
        raise ValueError("CP-SAT model invalid — internal bug in model construction")
    return "unknown_timeout"


def resolve_status(result, has_incumbent: bool) -> str:
    """unknown_timeout is only honest when the solver truly has nothing.

    If the budget expired but an incumbent assignment exists, that is a
    feasible_timeout: return the best-found timetable, not an empty plan.
    """
    base = status_of(result)
    if base == "unknown_timeout" and has_incumbent:
        return "feasible_timeout"
    return base


def _build_model(req, demands, cells, k_section, overcommitted,
                 include_soft: bool):
    """Construct the CP-SAT model: hard constraints + placement objective
    always; spread/balance penalty variables and the combined objective only
    when include_soft. Returns (model, x, spread_dbl_vars, balance_over_vars,
    placement_terms)."""
    days = list(req.grid.days)
    periods = req.grid.periods_per_day
    n_cells = len(cells)

    teacher_total = defaultdict(int)
    for d in demands:
        teacher_total[d.teacher_id] += d.weekly_periods

    model = cp_model.CpModel()
    x = {}
    for i in range(len(demands)):
        for c in range(n_cells):
            x[(i, c)] = model.NewBoolVar(f"x_{i}_{c}")

    # Placement counts: exact quota, or best-effort for over-committed teachers.
    placement_terms = []
    for i, d in enumerate(demands):
        total = sum(x[(i, c)] for c in range(n_cells))
        if d.teacher_id in overcommitted:
            model.Add(total <= d.weekly_periods)
            placement_terms.append(total)
        else:
            model.Add(total == d.weekly_periods)

    # A teacher sits in at most one cell at a time.
    by_teacher = defaultdict(list)
    for i, d in enumerate(demands):
        by_teacher[d.teacher_id].append(i)
    for t, idxs in sorted(by_teacher.items()):
        for c in range(n_cells):
            model.Add(sum(x[(i, c)] for i in idxs) <= 1)

    # A section runs at most k parallel lessons (elective-group relaxation).
    by_section = defaultdict(list)
    for i, d in enumerate(demands):
        by_section[d.section_id].append(i)
    for s, idxs in sorted(by_section.items()):
        for c in range(n_cells):
            model.Add(sum(x[(i, c)] for i in idxs) <= k_section[s])

    if not include_soft:
        # Stage-1 warm-start model: hard rules + placement objective only.
        if placement_terms:
            model.Maximize(PLACEMENT_WEIGHT * sum(placement_terms))
        return model, x, [], [], placement_terms

    # ---- soft rules ------------------------------------------------------
    penalty_terms = []

    # Spread: a (section, subject) group prefers distinct days. cnt[day] - 1
    # doublings are penalised; a hard per-day cap protects against absurd
    # stacking while staying feasible for heavy groups (cap >= ceil(w/days)).
    by_group = defaultdict(list)
    group_w = defaultdict(int)
    for i, d in enumerate(demands):
        g = (d.section_id, d.subject_id)
        by_group[g].append(i)
        group_w[g] += d.weekly_periods
    spread_dbl_vars = []
    for g, idxs in sorted(by_group.items()):
        cap_g = max(req.policy.max_same_subject_per_day,
                    math.ceil(group_w[g] / max(1, len(days))))
        for day in days:
            day_cells = [c for c, (dy, _) in enumerate(cells) if dy == day]
            cnt = sum(x[(i, c)] for i in idxs for c in day_cells)
            model.Add(cnt <= cap_g)
            dbl = model.NewIntVar(0, cap_g, f"dbl_{g[0]}_{g[1]}_{day}")
            model.Add(dbl >= cnt - 1)
            spread_dbl_vars.append(dbl)
            penalty_terms.append(req.policy.spread_weight * dbl)

    # Balance: teacher daily load soft-capped at ceil(weekly/days)+1.
    balance_over_vars = []
    for t, idxs in sorted(by_teacher.items()):
        soft_cap = math.ceil(teacher_total[t] / max(1, len(days))) + 1
        for day in days:
            day_cells = [c for c, (dy, _) in enumerate(cells) if dy == day]
            load = sum(x[(i, c)] for i in idxs for c in day_cells)
            over = model.NewIntVar(0, periods, f"over_{t}_{day}")
            model.Add(over >= load - soft_cap)
            balance_over_vars.append(over)
            penalty_terms.append(req.policy.balance_weight * over)

    objective = PLACEMENT_WEIGHT * sum(placement_terms) - sum(penalty_terms) \
        if placement_terms else -sum(penalty_terms)
    model.Maximize(objective)
    return model, x, spread_dbl_vars, balance_over_vars, placement_terms


def _make_solver(budget_s) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.random_seed = 42
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = budget_s
    # Linearization hurts this assignment-shaped model badly: with the default
    # level the 400-demand fixture finds nothing in 8s; with 0 the hard-only
    # model solves in ~0.2s and the full model in ~2s. Deterministic parameter.
    solver.parameters.linearization_level = 0
    return solver


def build(request: dict) -> dict:
    req = BuildRequest.model_validate(request)
    days = list(req.grid.days)
    periods = req.grid.periods_per_day
    cells = [(day, p) for day in days for p in range(1, periods + 1)]
    n_cells = len(cells)

    demands = sorted(req.demands,
                     key=lambda d: (d.teacher_id, d.section_id, d.subject_id))

    teacher_total = defaultdict(int)
    section_total = defaultdict(int)
    for d in demands:
        teacher_total[d.teacher_id] += d.weekly_periods
        section_total[d.section_id] += d.weekly_periods

    overcommitted = {t for t, tot in teacher_total.items() if tot > n_cells}
    # max(1, ...) is defensive; currently unreachable (weekly_periods>=1, n_cells>=1)
    k_section = {s: max(1, math.ceil(tot / n_cells))
                 for s, tot in section_total.items()}

    # Stage 1: hard rules only — fast to satisfy; its solution seeds stage 2
    # so a time-budget expiry there still leaves a valid incumbent to return.
    stage1_budget = (min(15, max(2, req.policy.time_limit_s // 3))
                     if req.policy.time_limit_s > 0 else 0)
    hint = None
    if stage1_budget > 0:
        model1, x1, _, _, _ = _build_model(
            req, demands, cells, k_section, overcommitted, include_soft=False)
        solver1 = _make_solver(stage1_budget)
        solver1.Solve(model1)
        if len(solver1.ResponseProto().solution) > 0:
            hint = {key: solver1.Value(var) for key, var in x1.items()}

    # Stage 2: full model (hard + soft), warm-started from stage 1 if it found
    # an assignment.
    model, x, spread_dbl_vars, balance_over_vars, placement_terms = _build_model(
        req, demands, cells, k_section, overcommitted, include_soft=True)
    if hint:
        for key, value in hint.items():
            model.AddHint(x[key], value)
    solver = _make_solver(max(0, req.policy.time_limit_s - stage1_budget))
    result = solver.Solve(model)

    if status_of(result) == "infeasible":  # also raises loudly on MODEL_INVALID
        return BuildResponse(
            status="infeasible", slots=[],
            quality=Quality(spread_violations=0, balance_violations=0, objective=0),
            gap_report=["solver returned infeasible — check demand vs grid capacity"],
            source=_source(),
        ).model_dump()

    # OPTIMAL / FEASIBLE / UNKNOWN: CP-SAT can hold a feasible incumbent even
    # at UNKNOWN (budget spent proving nothing) — salvage it rather than
    # discard a usable timetable. Detection must be explicit: Value() and
    # ObjectiveValue() do NOT raise without an incumbent, they return garbage.
    # ResponseProto().solution is empty exactly when there is no incumbent.
    has_incumbent = len(solver.ResponseProto().solution) > 0
    if not has_incumbent:
        return BuildResponse(
            status="unknown_timeout", slots=[],
            quality=Quality(spread_violations=0, balance_violations=0, objective=0),
            gap_report=["time budget exhausted before any timetable was found — "
                        "NOT proven infeasible; retry with a larger time_limit_s"],
            source=_source(),
        ).model_dump()

    # Incumbent exists: extract. Any exception here is a genuine bug and must
    # propagate loudly (same philosophy as the MODEL_INVALID raise).
    slots = []
    placed_per_demand = defaultdict(int)
    for i, d in enumerate(demands):
        for c, (day, p) in enumerate(cells):
            if solver.Value(x[(i, c)]):
                placed_per_demand[i] += 1
                slots.append(PlacedSlot(
                    section_id=d.section_id, subject_id=d.subject_id,
                    teacher_id=d.teacher_id, day=day, period_number=p,
                    bell_period_id=req.grid.bell_period_ids[day][p - 1]))
    quality = Quality(
        spread_violations=sum(solver.Value(v) for v in spread_dbl_vars),
        balance_violations=sum(solver.Value(v) for v in balance_over_vars),
        objective=int(solver.ObjectiveValue()),
    )

    gap_report = []
    if result in (cp_model.UNKNOWN, cp_model.FEASIBLE):
        gap_report.append(
            "time budget hit — returning best-found timetable, not proven optimal")
    for i, d in enumerate(demands):
        if d.teacher_id in overcommitted and placed_per_demand[i] < d.weekly_periods:
            gap_report.append(
                f"teacher {d.teacher_id}: demand exceeds the {n_cells}-cell week — "
                f"placed {placed_per_demand[i]}/{d.weekly_periods} of "
                f"{d.subject_id} for section {d.section_id}")

    return BuildResponse(
        status=resolve_status(result, True),
        slots=slots,
        quality=quality,
        gap_report=gap_report,
        source=_source(),
    ).model_dump()


def _source() -> BuildSource:
    return BuildSource(solver_version=SOLVER_VERSION,
                       generated_at=datetime.now(timezone.utc).isoformat())
