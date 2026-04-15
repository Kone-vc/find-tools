#!/usr/bin/env python3
"""
Validates keytools/tools.json: schema, unique URLs, and per-tool keyword
round-trip (same logic as find_tools_local). Prints one line per tool — like a linter.

Usage:
  python test/test_tools_json.py
  python test/test_tools_json.py --quiet   # only failures + summary
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from find_tools_local import match_prompt_against_keywords

DB_PATH = Path(__file__).parent.parent.parent / "keytools" / "tools.json"
_HTTPS = re.compile(r"^https://", re.I)


def _quiet(argv: list[str]) -> bool:
    return "--quiet" in argv


def _tool_slug(url: str) -> str:
    try:
        p = urlparse(url).path.strip("/").split("/")
        return p[-1] if p else url
    except Exception:
        return url


def _short_title(title: str, max_len: int = 72) -> str:
    s = title.strip()
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def _is_https(s: str) -> bool:
    return bool(_HTTPS.match(s.strip()))


def validate_tools_json(raw: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(raw, dict) or "tools" not in raw:
        return ["root must be an object with a tools array"]
    tools = raw["tools"]
    if not isinstance(tools, list) or len(tools) == 0:
        return ["tools must be a non-empty array"]

    seen_urls: set[str] = set()

    for i, t in enumerate(tools):
        p = f"tools[{i}]"
        if not isinstance(t, dict):
            errors.append(f"{p}: must be an object")
            continue

        for key in ("url", "title", "description", "image", "rules"):
            if key not in t:
                errors.append(f'{p}: missing "{key}"')

        if any(e.startswith(f"{p}:") and "missing" in e for e in errors):
            continue

        url = t["url"]
        title = t["title"]
        description = t["description"]
        image = t["image"]
        rules = t["rules"]

        if not isinstance(url, str) or not url.strip():
            errors.append(f"{p}.url: non-empty string required")
        elif not _is_https(url):
            errors.append(f"{p}.url: must be an https URL")
        elif url in seen_urls:
            errors.append(f"{p}.url: duplicate URL")
        else:
            seen_urls.add(url)

        if not isinstance(title, str) or not title.strip():
            errors.append(f"{p}.title: non-empty string required")
        if not isinstance(description, str) or not description.strip():
            errors.append(f"{p}.description: non-empty string required")

        if not isinstance(image, dict):
            errors.append(f"{p}.image: object required")
        else:
            for sz in ("large", "small"):
                u = image.get(sz)
                if u is None:
                    continue
                if not isinstance(u, str) or not u.strip():
                    errors.append(
                        f"{p}.image.{sz}: null or non-empty https URL string required"
                    )
                elif not _is_https(u):
                    errors.append(f"{p}.image.{sz}: must be an https URL")

        if not isinstance(rules, dict):
            errors.append(f"{p}.rules: object required")
        else:
            kws = rules.get("keywords")
            if not isinstance(kws, list) or len(kws) == 0:
                errors.append(f"{p}.rules.keywords: non-empty array required")
            else:
                for j, kw in enumerate(kws):
                    if not isinstance(kw, str) or not kw.strip():
                        errors.append(
                            f"{p}.rules.keywords[{j}]: non-empty string required"
                        )

    return errors


def run(argv: list[str]) -> int:
    quiet = _quiet(argv)

    try:
        raw_text = DB_PATH.read_text(encoding="utf-8")
    except OSError as e:
        print(f"[FAIL] cannot read {DB_PATH}: {e}", file=sys.stderr)
        return 1

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        print(f"[FAIL] tools.json is not valid JSON: {e}", file=sys.stderr)
        return 1

    if not quiet:
        print(f"\n>>> {DB_PATH}")
        print(">>> Schema")

    schema_errors = validate_tools_json(data)
    if schema_errors:
        print("[FAIL] Schema validation:", file=sys.stderr)
        for line in schema_errors:
            print(f"       {line}", file=sys.stderr)
        return 1

    tools = data["tools"]
    if not quiet:
        print(f"[PASS] schema — {len(tools)} entries\n")
        print(">>> Per-tool (keywords → synthetic prompt → match)")

    passed = 0
    failed = 0

    for i, tool in enumerate(tools):
        kws = tool["rules"]["keywords"]
        prompt = " ".join(kws)
        slug = _tool_slug(tool["url"])
        label = f'[{i}] {slug}  {_short_title(tool["title"])}'

        if match_prompt_against_keywords(prompt, kws):
            passed += 1
            if not quiet:
                print(f"[PASS] {label}")
        else:
            failed += 1
            print(f"[FAIL] {label}", file=sys.stderr)
            print("       keywords do not match synthetic prompt", file=sys.stderr)

    status = "[PASS]" if failed == 0 else "[FAIL]"
    print(
        f"\n{status} tools.json — {passed}/{len(tools)} per-tool checks OK, schema OK"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:]))
