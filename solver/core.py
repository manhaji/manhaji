"""Substitution solver core — pure function, OR-Tools CP-SAT.

solve(request: dict) -> dict per the contract in
docs/substitution_solver_handoff.md. No FastAPI, no HTTP, no DB access.

Model in one paragraph: one boolean variable per (slot, eligible candidate)
pair. Hard rules: at most one substitute per slot; a substitute takes at most
one slot per (date, period) and is never someone who is busy or absent then;
nobody exceeds the fairness cap for the window. Soft rules (objective):
same-subject cover beats same-department cover; pushing someone over their
daily period cap or eating their only free period costs points; the maximum
cover load across teachers is penalised so work spreads out. Leaving a slot
unfilled is always allowed — it just earns nothing — so the model never goes
infeasible; unfilled slots are reported as a first-class outcome.

Determinism: inputs are sorted, CP-SAT gets a fixed seed and one worker.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from ortools.sat.python import cp_model

from solver.models import (
    Alternative,
    Assignment,
    FairnessSpread,
    SolveRequest,
    SolveResponse,
    Source,
    Summary,
    Unfilled,
)

SOLVER_VERSION = "0.1.0"
LEVELING_WEIGHT = 5  # spread-the-load pressure; small vs match weights (100/40)


def _absent_at(absences, teacher_id: str, date: str, period: str) -> bool:
    for a in absences:
        if a.teacher_id != teacher_id or date not in a.dates:
            continue
        if a.periods == "all" or period in a.periods:
            return True
    return False


def solve(request: dict) -> dict:
    req = SolveRequest.model_validate(request)
    policy = req.policy

    slots = sorted(req.slots_to_cover, key=lambda s: (s.date, s.bell_period_id, s.slot_id))
    teachers = sorted(req.teachers, key=lambda t: t.teacher_id)
    by_id = {t.teacher_id: t for t in teachers}

    # Departments of absent teachers per (date, period) — the fallback
    # reference point for same-department matching when a slot doesn't name
    # its owner.
    def owner_depts(slot) -> Set[str]:
        if slot.teacher_id and slot.teacher_id in by_id:
            dept = by_id[slot.teacher_id].department
            return {dept} if dept else set()
        depts = set()
        for a in req.absences:
            if slot.date in a.dates and (a.periods == "all" or slot.bell_period_id in a.periods):
                t = by_id.get(a.teacher_id)
                if t and t.department:
                    depts.add(t.department)
        return depts

    busy_index: Dict[Tuple[str, str, str], bool] = {}
    for t in teachers:
        for b in t.busy:
            busy_index[(t.teacher_id, b.date, b.bell_period_id)] = True

    # ------------------------------------------------------------------
    # Eligibility: FREE at that period AND (same subject | same department)
    # ------------------------------------------------------------------
    eligible: Dict[int, List[Tuple[str, str, int]]] = {}  # slot idx -> [(tid, match_type, benefit)]
    for i, s in enumerate(slots):
        cands = []
        ref_depts = owner_depts(s)
        for t in teachers:
            if s.teacher_id and t.teacher_id == s.teacher_id:
                continue  # the lesson's own (absent) teacher
            if _absent_at(req.absences, t.teacher_id, s.date, s.bell_period_id):
                continue
            if busy_index.get((t.teacher_id, s.date, s.bell_period_id)):
                continue
            if s.subject_id in t.subject_ids:
                cands.append((t.teacher_id, "same_subject", policy.prefer_same_subject_weight))
            elif t.department and t.department in ref_depts:
                cands.append((t.teacher_id, "same_department", policy.prefer_same_department_weight))
        eligible[i] = cands

    # ------------------------------------------------------------------
    # CP-SAT model
    # ------------------------------------------------------------------
    model = cp_model.CpModel()
    x: Dict[Tuple[int, str], cp_model.IntVar] = {}
    for i, cands in eligible.items():
        for tid, _, _ in cands:
            x[(i, tid)] = model.NewBoolVar(f"x_{i}_{tid}")

    # ≤ 1 substitute per slot (unfilled allowed)
    for i, cands in eligible.items():
        if cands:
            model.Add(sum(x[(i, tid)] for tid, _, _ in cands) <= 1)

    # Never double-book: one slot per candidate per (date, period)
    per_period: Dict[Tuple[str, str, str], List] = {}
    for i, s in enumerate(slots):
        for tid, _, _ in eligible[i]:
            per_period.setdefault((tid, s.date, s.bell_period_id), []).append(x[(i, tid)])
    for vars_ in per_period.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # Fairness cap over the whole window (hard)
    per_teacher: Dict[str, List] = {}
    for (i, tid), var in x.items():
        per_teacher.setdefault(tid, []).append(var)
    for tid, vars_ in per_teacher.items():
        model.Add(sum(vars_) <= policy.fairness_cap_per_teacher)

    # Objective
    terms = []
    for i, cands in eligible.items():
        s = slots[i]
        for tid, _, benefit in cands:
            t = by_id[tid]
            gain = benefit
            # eating someone's only free period costs points
            if t.free_periods_today.get(s.date) == 1:
                gain -= policy.consume_only_prep_penalty
            terms.append(gain * x[(i, tid)])

    # Daily-cap overflow penalty (soft): busy_that_day + new covers - cap
    per_teacher_day: Dict[Tuple[str, str], List] = {}
    for i, s in enumerate(slots):
        for tid, _, _ in eligible[i]:
            per_teacher_day.setdefault((tid, s.date), []).append(x[(i, tid)])
    for (tid, date), vars_ in per_teacher_day.items():
        t = by_id[tid]
        if t.max_periods_per_day is None:
            continue
        busy_today = sum(1 for b in t.busy if b.date == date)
        # Upper bound must cover the worst case where the teacher is ALREADY
        # over cap from their existing busy load alone (busy_today can
        # exceed max_periods_per_day on its own, independent of any new
        # covers) -- otherwise this constraint is unsatisfiable and wrongly
        # makes the whole model infeasible instead of just penalising it.
        max_over = max(0, busy_today - t.max_periods_per_day) + len(vars_)
        over = model.NewIntVar(0, max_over, f"over_{tid}_{date}")
        model.Add(over >= busy_today + sum(vars_) - t.max_periods_per_day)
        terms.append(-policy.over_daily_cap_penalty * over)

    # Level the load: penalise the max total covers (recent + new) per teacher
    if per_teacher:
        horizon = max(
            by_id[tid].cover_done_recently + len(vars_)
            for tid, vars_ in per_teacher.items()
        )
        max_load = model.NewIntVar(0, max(horizon, 0), "max_load")
        for tid, vars_ in per_teacher.items():
            model.Add(max_load >= by_id[tid].cover_done_recently + sum(vars_))
        terms.append(-LEVELING_WEIGHT * max_load)

    if terms:
        model.Maximize(sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.random_seed = 42
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = 30
    result = solver.Solve(model)
    feasible = result in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    # ------------------------------------------------------------------
    # Build the response
    # ------------------------------------------------------------------
    assignments: List[Assignment] = []
    unfilled: List[Unfilled] = []
    covers_per_teacher: Dict[str, int] = {}

    for i, s in enumerate(slots):
        cands = eligible[i]
        chosen: Optional[Tuple[str, str, int]] = None
        if feasible:
            for tid, mt, benefit in cands:
                if solver.Value(x[(i, tid)]):
                    chosen = (tid, mt, benefit)
                    break
        if chosen is None:
            if not cands:
                reason = ("no substitute is both free this period and qualified "
                          "(same subject or same department)")
            else:
                reason = ("eligible substitutes were needed elsewhere "
                          "(same-period clash or fairness cap reached)")
            unfilled.append(Unfilled(slot_id=s.slot_id, date=s.date, reason=reason))
            continue

        tid, mt, benefit = chosen
        covers_per_teacher[tid] = covers_per_teacher.get(tid, 0) + 1
        alts = sorted(
            [c for c in cands if c[0] != tid],
            key=lambda c: (-c[2], by_id[c[0]].cover_done_recently, c[0]),
        )[:3]
        why = ("teaches this subject" if mt == "same_subject"
               else "same department as the absent teacher")
        assignments.append(Assignment(
            slot_id=s.slot_id,
            date=s.date,
            substitute_teacher_id=tid,
            match_type=mt,
            score=benefit,
            reasoning=f"{tid} is free this period and {why}.",
            alternatives=[Alternative(substitute_teacher_id=a[0], match_type=a[1], score=a[2])
                          for a in alts],
        ))

    total = len(slots)
    filled = len(assignments)
    if total == 0 or filled == total:
        status = "solved"
    elif filled == 0:
        status = "infeasible"
    else:
        status = "partial"

    fill_rate = 1.0 if total == 0 else filled / total
    dept_share = (sum(1 for a in assignments if a.match_type == "same_department") / filled
                  if filled else 0.0)
    confidence = round(max(0.0, min(1.0, fill_rate - 0.1 * dept_share)), 2)

    notes = (f"{filled} of {total} lessons covered"
             + (f"; {len(unfilled)} need admin attention" if unfilled else "")
             + ".")

    resp = SolveResponse(
        status=status,
        assignments=assignments,
        unfilled=unfilled,
        summary=Summary(
            slots_total=total,
            filled=filled,
            unfilled=len(unfilled),
            fairness_spread=FairnessSpread(
                max_covers_one_teacher=max(covers_per_teacher.values(), default=0),
            ),
        ),
        confidence=confidence,
        notes_for_admin=notes,
        source=Source(
            solver_version=SOLVER_VERSION,
            generated_at=datetime.now(timezone.utc).isoformat(),
        ),
    )
    return resp.model_dump()
