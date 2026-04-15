#!/usr/bin/env python3
"""
test_find_tools_local.py

CLI test for find_tools_local.
Usage:
  python test_find_tools_local.py              # run full test suite
  python test_find_tools_local.py "<prompt>"   # single prompt
  python test_find_tools_local.py --time "<prompt>"
  python test_find_tools_local.py --bench --time "a" "b"

Suite: real user-style prompts; keyword matching from tools.json. Asserts the
expected tool (url) is among the results.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from find_tools_local import find_tools_local

DB_PATH = Path(__file__).parent.parent.parent / "keytools" / "tools.json"

USER_SCENARIOS: tuple[dict[str, str], ...] = (
    {
        "id": "airflow-ide-lint",
        "user_prompt": (
            "How do I set up a linter for my Airflow DAGs in a proper IDE?"
        ),
        "expect_url": "https://zero.click/89c531a4-da37-4345-ba22-682858ce66cc",
    },
    {
        "id": "pr-review-ci",
        "user_prompt": (
            "Can you help review this pull request and catch bugs before "
            "we merge to production?"
        ),
        "expect_url": "https://zero.click/ba7894cf-7f03-4b35-bca7-bcbdc06ea886",
    },
    {
        "id": "api-docs-nl",
        "user_prompt": (
            "Search our API documentation with natural language instead "
            "of exact keywords"
        ),
        "expect_url": "https://zero.click/5acf312c-e7fa-4d95-9fa0-1b80f2e35a69",
    },
)

NEGATIVE_PROMPT = "What is the capital of France?"


def run_suite() -> int:
    raw = json.loads(DB_PATH.read_text(encoding="utf-8"))
    by_url = {t["url"]: t for t in raw["tools"]}

    passed = 0
    failed = 0

    for sc in USER_SCENARIOS:
        uid = sc["id"]
        prompt = sc["user_prompt"]
        expect_url = sc["expect_url"]

        catalog = by_url.get(expect_url)
        if catalog is None:
            print(f"[FAIL] [{uid}] missing url in tools.json: {expect_url}")
            failed += 1
            continue

        results = find_tools_local(prompt, DB_PATH)
        hit = any(r["url"] == expect_url for r in results)

        status = "PASS" if hit else "FAIL"
        title = catalog["title"]
        short = title if len(title) <= 60 else title[:59] + "…"

        print(f'[{status}] [{uid}] user prompt → expect in results (keyword match)')
        print(f'       "{prompt}"')
        print(f'       → "{short}" ({expect_url})')

        if hit:
            passed += 1
            print(f"       matched: yes ({len(results)} tool(s) total)")
        else:
            failed += 1
            got = ", ".join(r["title"] for r in results) if results else "no tools"
            print(f"       matched: no — got: {got}")

    results_neg = find_tools_local(NEGATIVE_PROMPT, DB_PATH)
    ok = len(results_neg) == 0
    status = "PASS" if ok else "FAIL"
    print(f'[{status}] "{NEGATIVE_PROMPT}"')
    exp = "expected no match — "
    if ok:
        print(f"       {exp}got no tools")
        passed += 1
    else:
        print(
            f"       {exp}got {len(results_neg)} tool(s): "
            + ", ".join(r["title"] for r in results_neg)
        )
        failed += 1

    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


def run_single(prompt: str, *, with_time: bool) -> int:
    t0 = time.perf_counter() if with_time else 0.0
    results = find_tools_local(prompt, DB_PATH)
    ms = (time.perf_counter() - t0) * 1000 if with_time else 0.0

    print(f'\nPrompt: "{prompt}"')
    if with_time:
        print(f"Time: {ms:.2f} ms")
    match results:
        case []:
            print("No matching tools found.")
            return 2
        case tools:
            print(f"Found {len(tools)} tool(s):\n")
            print(json.dumps(tools, indent=2))
            return 0


def run_bench(prompts: list[str], *, full_json: bool) -> int:
    for p in prompts:
        t0 = time.perf_counter()
        results = find_tools_local(p, DB_PATH)
        ms = (time.perf_counter() - t0) * 1000
        print("\n---")
        print(f'Prompt: "{p}"')
        print(f"Time: {ms:.2f} ms | Hits: {len(results)}")
        if not results:
            continue
        if full_json:
            print(json.dumps(results, indent=2))
        else:
            print(
                json.dumps(
                    [{"title": r["title"], "url": r["url"]} for r in results],
                    indent=2,
                )
            )
    return 0


def _main(argv: list[str]) -> int:
    with_time = "--time" in argv
    argv = [a for a in argv if a != "--time"]
    if argv and argv[0] == "--bench":
        prompts = argv[1:]
        if not prompts:
            print(
                'Usage: ... --bench [--time] "prompt1" "prompt2" ...',
                file=sys.stderr,
            )
            return 1
        return run_bench(prompts, full_json=with_time)
    if not argv:
        return run_suite()
    return run_single(" ".join(argv), with_time=with_time)


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
