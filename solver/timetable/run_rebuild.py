#!/usr/bin/env python3
"""Run the full-scale v2 rebuild of ISO's 25-26 timetable.

Loads the Phase-B derived inputs, calls v2core.rebuild() with the real
constraint catalog, and writes the placement + solve metadata to
data/processed/tt_2526/derived/rebuild_v2.json (input to benchmark.py and
render_benchmark_dashboard.py).

Usage:
    cd /Users/eliasmouawad/dev/manhaj-phase-c && PYTHONPATH=. \
        /Users/eliasmouawad/dev/manhaj/.venv/bin/python \
        solver/timetable/run_rebuild.py [time_limit_s]
"""
import json
import sys
import time
from pathlib import Path

from solver.timetable.v2core import rebuild

ROOT = Path(__file__).resolve().parent.parent.parent
DERIVED = ROOT / "data" / "processed" / "tt_2526" / "derived"


def main():
    time_limit_s = int(sys.argv[1]) if len(sys.argv) > 1 else 240
    req = {
        "canonical_lessons": json.loads(
            (DERIVED / "canonical_lessons.json").read_text()),
        "bells": json.loads((DERIVED / "bells.json").read_text()),
        "parallel_groups": json.loads(
            (DERIVED / "parallel_groups.json").read_text()),
        "mined_rules": json.loads((DERIVED / "mined_rules.json").read_text()),
        "policy": {"time_limit_s": time_limit_s},
        "days": ["Sun", "Mon", "Tue", "Wed", "Thu"],
    }
    t0 = time.monotonic()
    resp = rebuild(req)
    wall = round(time.monotonic() - t0, 1)

    n_locked = sum(1 for l in resp["lessons"] if l["locked"])
    resp["solve_meta"] = {
        "status": resp["status"],
        "wall_time_s": wall,
        "time_limit_s": time_limit_s,
        "movable": len(resp["lessons"]) - n_locked,
        "locked": n_locked,
    }
    out = DERIVED / "rebuild_v2.json"
    out.write_text(json.dumps(resp, indent=1))
    print(f"status={resp['status']} wall={wall}s "
          f"lessons={len(resp['lessons'])} (locked={n_locked}) "
          f"spread_penalty={resp['quality']['spread_penalty']} "
          f"balance_penalty={resp['quality']['balance_penalty']} "
          f"objective={resp['quality']['objective']}")
    for g in resp["gap_report"]:
        print(f"gap: {g}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
