#!/usr/bin/env python3
"""Run the timetable builder on the real request and save the plan.

Usage:  .venv/bin/python solver/timetable/run_build.py [time_limit_s]
Reads:  solver/timetable_out/request.json   (from adapter.py)
Writes: solver/timetable_out/plan.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from solver.timetable.core import build  # noqa: E402

OUT_DIR = ROOT / "solver" / "timetable_out"


def main():
    request = json.loads((OUT_DIR / "request.json").read_text())
    if len(sys.argv) > 1:
        request.setdefault("policy", {})["time_limit_s"] = int(sys.argv[1])
    resp = build(request)
    (OUT_DIR / "plan.json").write_text(json.dumps(resp, indent=1))
    q = resp["quality"]
    print(f"status: {resp['status']}")
    print(f"slots placed: {len(resp['slots'])}")
    print(f"spread violations: {q['spread_violations']}  "
          f"balance violations: {q['balance_violations']}")
    for line in resp["gap_report"]:
        print(f"gap: {line}")


if __name__ == "__main__":
    main()
