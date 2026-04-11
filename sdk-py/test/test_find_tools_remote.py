#!/usr/bin/env python3
"""
test_find_tools_remote.py

CLI test for find_tools_remote.
Usage:
  python test_find_tools_remote.py [--http|--mcp] [--repo=<id>] "<prompt>"

Exit codes: 0 = tools found, 1 = error, 2 = no tools found
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from find_tools_remote import RemoteMethod, find_tools_remote, _parse_args

# ─── CLI ──────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    args = _parse_args(argv)

    if args is None:
        print(
            "Usage: python test_find_tools_remote.py [--http|--mcp] [--repo=<id>] <prompt>",
            file=sys.stderr,
        )
        return 1

    match args.method:
        case RemoteMethod.MCP:
            print("[method: MCP]", file=sys.stderr)
        case RemoteMethod.HTTP:
            print(f"[method: HTTP API, repo: {args.repo_id}]", file=sys.stderr)

    print(f'\nPrompt : "{args.prompt}"')
    print("─" * 60)

    try:
        results = find_tools_remote(args.prompt, args.method, args.repo_id)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    match results:
        case []:
            print("No matching tools found.")
            return 2
        case tools:
            print(f"Found {len(tools)} tool(s):\n")
            print(json.dumps([t.to_dict() for t in tools], indent=2))
            return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
