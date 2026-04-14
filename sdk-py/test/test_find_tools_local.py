#!/usr/bin/env python3
"""
test_find_tools_local.py

CLI test for find_tools_local.
Usage:
  python test_find_tools_local.py              # run full test suite
  python test_find_tools_local.py "<prompt>"   # single prompt

Exit codes: 0 = all passed, 1 = failures, 2 = no tools found (single mode)
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from find_tools_local import find_tools_local

DB_PATH = Path(__file__).parent.parent.parent / "keytools" / "tools.json"

# ─── Test cases ───────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class TestCase:
    prompt: str
    expect_any: bool


TESTS: list[TestCase] = [
    TestCase("How do I set up a linter for my TypeScript project?", expect_any=True),
    TestCase("Can you help me review this pull request and refactor it?", expect_any=True),
    TestCase("Generate documentation for my API endpoints", expect_any=True),
    TestCase("What is the capital of France?", expect_any=False),
]

# ─── Runner ───────────────────────────────────────────────────────────────────

def run_suite() -> int:
    passed = 0
    failed = 0

    for tc in TESTS:
        results = find_tools_local(tc.prompt, DB_PATH)
        got_any = len(results) > 0
        ok = got_any == tc.expect_any

        status = "PASS" if ok else "FAIL"
        expect_label = "expected match" if tc.expect_any else "expected no match"
        got_label = (
            f"got {len(results)} tool(s): {', '.join(r['title'] for r in results)}"
            if got_any else "got no tools"
        )

        print(f"[{status}] \"{tc.prompt}\"")
        print(f"       {expect_label} — {got_label}")

        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


def run_single(prompt: str) -> int:
    results = find_tools_local(prompt, DB_PATH)
    print(f'\nPrompt: "{prompt}"')
    match results:
        case []:
            print("No matching tools found.")
            return 2
        case tools:
            print(f"Found {len(tools)} tool(s):\n")
            print(json.dumps(tools, indent=2))
            return 0


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    match argv:
        case []:
            return run_suite()
        case [*words]:
            return run_single(" ".join(words))


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
