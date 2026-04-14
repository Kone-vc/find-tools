#!/usr/bin/env python3
"""
find_tools_local.py

Finds relevant tool recommendations from the local tools.json database
by matching keywords against a user prompt.

Requires Python 3.10+
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final

# ─── Constants ────────────────────────────────────────────────────────────────

DEFAULT_DB_PATH: Final[Path] = (
    Path(__file__).parent.parent.parent / "keytools" / "tools.json"
)

# ─── Data models ──────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class ToolImage:
    small: str
    large: str

    @classmethod
    def from_dict(cls, data: dict) -> ToolImage:
        return cls(small=data["small"], large=data["large"])

    def to_dict(self) -> dict[str, str]:
        return {"small": self.small, "large": self.large}


@dataclass(frozen=True, slots=True)
class Tool:
    title: str
    description: str
    url: str
    image: ToolImage
    keywords: tuple[str, ...]

    @classmethod
    def from_dict(cls, data: dict) -> Tool:
        return cls(
            title=data["title"],
            description=data["description"],
            url=data["url"],
            image=ToolImage.from_dict(data["image"]),
            keywords=tuple(kw.lower() for kw in data["rules"]["keywords"]),
        )

    def to_result_dict(self) -> dict:
        return {
            "title": self.title,
            "description": self.description,
            "url": self.url,
            "image": self.image.to_dict(),
        }


# ─── Tokenization ─────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    normalized = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return [word for word in normalized.split() if word]


def _build_phrases(prompt: str) -> frozenset[str]:
    tokens = _tokenize(prompt)
    phrases: list[str] = list(tokens)

    for i in range(len(tokens) - 1):
        phrases.append(f"{tokens[i]} {tokens[i + 1]}")

    for i in range(len(tokens) - 2):
        phrases.append(f"{tokens[i]} {tokens[i + 1]} {tokens[i + 2]}")

    return frozenset(phrases)


# ─── Database loader ──────────────────────────────────────────────────────────

def _load_tools(db_path: Path) -> list[Tool]:
    with db_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return [Tool.from_dict(entry) for entry in raw["tools"]]


# ─── Matching logic ───────────────────────────────────────────────────────────

def _tool_matches(tool: Tool, phrases: frozenset[str], prompt_lower: str) -> bool:
    return any(
        kw in phrases or kw in prompt_lower
        for kw in tool.keywords
    )


# ─── Public API ───────────────────────────────────────────────────────────────

def find_tools_local(
    prompt: str,
    db_path: Path | None = None,
) -> list[dict]:
    """Return tool recommendations matching *prompt* from the local database."""
    resolved = db_path or DEFAULT_DB_PATH
    tools = _load_tools(resolved)
    phrases = _build_phrases(prompt)
    prompt_lower = prompt.lower()

    return [
        tool.to_result_dict()
        for tool in tools
        if _tool_matches(tool, phrases, prompt_lower)
    ]


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    match argv:
        case []:
            print("Usage: python find_tools_local.py <prompt>", file=sys.stderr)
            return 1
        case [*words]:
            prompt = " ".join(words)

    results = find_tools_local(prompt)

    match results:
        case []:
            print("No matching tools found.")
            return 2
        case tools:
            print(json.dumps([t for t in tools], indent=2))
            return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
