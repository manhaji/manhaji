"""Test-collection guards.

The Phase A extraction tests parse the two ISO source PDFs, which are
deliberately git-ignored (confidential school data). In a checkout without
them (e.g. the published engine repo), skip those modules instead of erroring
— everything downstream runs from the committed data/processed artifacts.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

_SOURCE_PDFS = [
    ROOT / "data/source/Classes TT _ ACAD 25-26 _ Ver 19.pdf",
    ROOT / "data/source/Teachers TT _ ACAD 25-26 _ Ver 19.pdf",
]

collect_ignore = []
if not all(p.exists() for p in _SOURCE_PDFS):
    collect_ignore = ["test_tt_extraction.py", "test_tt_reconciliation.py"]
