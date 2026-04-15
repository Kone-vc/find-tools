#!/usr/bin/env python3
"""
find_tools_remote.py

Finds tool recommendations via the remote kone.vc API.

Two methods are supported:
  --http   POST https://go.kone.vc/search/git/<github_repo_id>   (default)
  --mcp    JSON-RPC 2.0 call to https://go.kone.vc/mcp

Requires Python 3.10+
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Final

# ─── Constants ────────────────────────────────────────────────────────────────

API_BASE: Final[str] = "https://go.kone.vc"
MCP_SERVER_URL: Final[str] = "https://go.kone.vc/mcpgit"
USER_AGENT: Final[str] = "find-tools/1.0"
DEFAULT_REPO_ID: Final[str] = "default"

# ─── Enums ────────────────────────────────────────────────────────────────────

class RemoteMethod(StrEnum):
    HTTP = "http"
    MCP = "mcp"


# ─── Data models ──────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class ToolImage:
    small: str
    large: str

    def to_dict(self) -> dict[str, str]:
        return {"small": self.small, "large": self.large}


@dataclass(frozen=True, slots=True)
class MatchedTool:
    title: str
    description: str
    url: str
    image: ToolImage

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MatchedTool:
        img = data["image"]
        if isinstance(img, str):
            image = ToolImage(small=img, large=img)
        else:
            image = ToolImage(small=img["small"], large=img["large"])
        return cls(
            title=data["title"],
            description=data["description"],
            url=data["url"],
            image=image,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "description": self.description,
            "url": self.url,
            "image": self.image.to_dict(),
        }


# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def _post_json(url: str, payload: dict[str, Any]) -> Any:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(body)
            detail = (
                (err.get("error") or {}).get("message")
                if isinstance(err.get("error"), dict)
                else None
            ) or err.get("message") or body
        except json.JSONDecodeError:
            detail = body or e.reason
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e


def _parse_tools(raw: list[Any]) -> list[MatchedTool]:
    out: list[MatchedTool] = []
    for item in raw:
        if isinstance(item, dict):
            out.append(MatchedTool.from_dict(item))
    return out


# ─── Method 1: HTTP API ───────────────────────────────────────────────────────

def find_tools_remote_http(
    prompt: str,
    repo_id: str = DEFAULT_REPO_ID,
) -> list[MatchedTool]:
    url = f"{API_BASE}/search/git/{urllib.parse.quote(repo_id, safe='')}"
    response = _post_json(url, {"prompt": prompt})
    return _parse_tools(response.get("tools", []))


# ─── Method 2: MCP Tool Call ─────────────────────────────────────────────────

def find_tools_remote_mcp(prompt: str) -> list[MatchedTool]:
    mcp_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "find_tools",
            "arguments": {"prompt": prompt},
        },
    }

    repo_id: str = DEFAULT_REPO_ID
    mcp_url = f"{MCP_SERVER_URL}/{urllib.parse.quote(repo_id, safe='')}"
    response = _post_json(mcp_url, mcp_request)

    match response:
        case {"error": {"code": code, "message": message}}:
            raise RuntimeError(f"MCP error {code}: {message}")
        case {"result": {"content": [*content]}}:
            for item in content:
                match item:
                    case {"type": "text", "text": text} if text:
                        try:
                            parsed = json.loads(text)
                            return _parse_tools(parsed.get("tools", []))
                        except json.JSONDecodeError:
                            continue
        case _:
            pass

    return []


# ─── Dispatcher ───────────────────────────────────────────────────────────────

def find_tools_remote(
    prompt: str,
    method: RemoteMethod = RemoteMethod.HTTP,
    repo_id: str = DEFAULT_REPO_ID,
) -> list[MatchedTool]:
    match method:
        case RemoteMethod.HTTP:
            return find_tools_remote_http(prompt, repo_id)
        case RemoteMethod.MCP:
            return find_tools_remote_mcp(prompt)


# ─── CLI arg parsing ──────────────────────────────────────────────────────────

@dataclass
class CliArgs:
    method: RemoteMethod
    repo_id: str
    prompt: str


def _parse_args(argv: list[str]) -> CliArgs | None:
    method = RemoteMethod.HTTP
    repo_id = DEFAULT_REPO_ID
    prompt_parts: list[str] = []

    for arg in argv:
        match arg:
            case "--http":
                method = RemoteMethod.HTTP
            case "--mcp":
                method = RemoteMethod.MCP
            case _ if arg.startswith("--repo="):
                repo_id = arg.split("=", 1)[1]
            case _:
                prompt_parts.append(arg)

    prompt = " ".join(prompt_parts)
    if not prompt:
        return None

    return CliArgs(method=method, repo_id=repo_id, prompt=prompt)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    args = _parse_args(argv)

    if args is None:
        print(
            "Usage: python find_tools_remote.py [--http|--mcp] [--repo=<id>] <prompt>",
            file=sys.stderr,
        )
        return 1

    match args.method:
        case RemoteMethod.MCP:
            print("[method: MCP]", file=sys.stderr)
        case RemoteMethod.HTTP:
            print(f"[method: HTTP API, repo: {args.repo_id}]", file=sys.stderr)

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
            print(json.dumps([t.to_dict() for t in tools], indent=2))
            return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
