"""Phase A reconciliation: the Classes TT and Teachers TT PDFs describe ONE
schedule from two angles. Every teaching assignment extracted from the 41 class
pages must appear on the matching teacher's page, and vice versa.

Target: zero unexplained differences. Genuine source inconsistencies (they can
exist — the PDFs are human-maintained exports) are recorded in
fixtures/tt2526/reconciliation_exceptions.json with a reason, and counted
separately. An empty exceptions file is the ideal outcome.
"""
import json
from pathlib import Path

import pytest

from etl.ttparse import parse_classes, parse_teachers, reconcile

ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "tt2526"
CLASSES_PDF = ROOT / "data/source/Classes TT _ ACAD 25-26 _ Ver 19.pdf"
TEACHERS_PDF = ROOT / "data/source/Teachers TT _ ACAD 25-26 _ Ver 19.pdf"


@pytest.fixture(scope="module")
def result():
    classes = parse_classes(str(CLASSES_PDF))
    teachers = parse_teachers(str(TEACHERS_PDF))
    return reconcile(classes, teachers)


def load_exceptions():
    p = FIXTURES / "reconciliation_exceptions.json"
    if not p.exists():
        return []
    return json.loads(p.read_text())


def test_reconciliation_is_complete(result):
    """reconcile() returns {"matched": int, "diffs": [{"key", "detail", ...}]}.
    Every diff must be covered by a documented exception."""
    exceptions = {e["key"] for e in load_exceptions()}
    unexplained = [d for d in result["diffs"] if d["key"] not in exceptions]
    assert not unexplained, (
        f"{len(unexplained)} unexplained diffs between the two views "
        f"(first 10): {unexplained[:10]}")


def test_reconciliation_actually_matched_things(result):
    # A parser that extracts nothing reconciles vacuously — forbid that.
    assert result["matched"] > 2500, result["matched"]


def test_exceptions_all_have_reasons():
    for e in load_exceptions():
        assert e.get("key") and len(e.get("reason", "")) >= 20, e
