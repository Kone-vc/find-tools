# rectools — Open-Source Tool Recommendation SDK for AI Agents

**rectools** is a lightweight, open-source SDK that lets AI agents surface relevant tool recommendations — with optional affiliate links — when users ask questions that could be solved by an external tool.

Works in two modes:
- **Local** — keyword matching against a bundled `tools.json` (zero network calls)
- **Remote** — matched server-side via the [kone.vc](https://kone.vc) API or as an MCP tool

Available in **TypeScript** (`sdk-ts/`) and **Python** (`sdk-py/`) — pick the one that fits your stack.

---

## How It Works

1. A user sends a prompt to your AI agent.
2. The agent calls `findToolsLocal` or `findToolsRemote` with the raw prompt.
3. Matched tools are returned as `{ title, description, url, image }`.
4. The agent injects recommendations inline in its response or appends a separate "Recommended tools" block.

### Reference (FRS)

| Component | Behavior |
|-----------|----------|
| **find_tools_local** | Process the user's prompt; match against `rules[]` in `tools.json`. |
| **find_tools_remote** | `POST https://go.kone.vc/search/git/<github_repo_id>` — body `{ "prompt": "<user's prompt>" }`, response `{ "tools": [ { "title", "description", "url", "image" } ] }`. |
| **test_*** | CLI: pass a prompt; prints selected matches (JSON) to stdout. |

---

## Project Structure

```
mcp_dev/
├── rectools/               # shared data — one source of truth
│   ├── tools.json          # tool database with keyword matching rules
│   └── policy.md           # inclusion requirements and affiliate policy
├── sdk-ts/                 # TypeScript SDK
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── find_tools_local.ts
│   │   └── find_tools_remote.ts
│   └── test/
│       ├── test_find_tools_local.ts
│       └── test_find_tools_remote.ts
├── sdk-py/                 # Python SDK
│   ├── pyproject.toml
│   ├── src/
│   │   ├── find_tools_local.py
│   │   └── find_tools_remote.py
│   └── test/
│       ├── test_find_tools_local.py
│       └── test_find_tools_remote.py
└── README.md
```

---

## Install

Clone the repo:

```bash
git clone https://github.com/konevc/mcp_dev.git
cd mcp_dev
```

**TypeScript SDK**

```bash
cd sdk-ts
npm install
```

**Python SDK**

```bash
# Python 3.10+ required — no third-party packages needed
cd sdk-py
pip install -e .
```

---

## Run the Tests

### TypeScript

```bash
cd sdk-ts

# Local — run full test suite
npm run test:local

# Local — single prompt
ts-node test/test_find_tools_local.ts "How do I lint my TypeScript code?"

# Remote — HTTP API
npm run test:remote:http -- --repo=default "refactor my pull request"

# Remote — MCP
npm run test:remote:mcp -- "generate API documentation"
```

### Python

```bash
cd sdk-py

# Local — run full test suite
python test/test_find_tools_local.py

# Local — single prompt
python test/test_find_tools_local.py "How do I lint my TypeScript code?"

# Remote — HTTP API
python test/test_find_tools_remote.py --http --repo=default "refactor my pull request"

# Remote — MCP
python test/test_find_tools_remote.py --mcp "generate API documentation"
```

---

## Implement Inside an Agent (Inline Recommendations)

**TypeScript**

```ts
import { findToolsLocal } from "rectools/src/find_tools_local";

async function handleUserMessage(prompt: string): Promise<string> {
  const tools = findToolsLocal(prompt);
  let response = await callYourLLM(prompt);

  if (tools.length > 0) {
    const block = tools
      .map((t) => `- **[${t.title}](${t.url})** — ${t.description}`)
      .join("\n");
    response += `\n\n---\n**Recommended tools:**\n${block}`;
  }

  return response;
}
```

**Python**

```python
from rectools import find_tools_local

def handle_user_message(prompt: str) -> str:
    tools = find_tools_local(prompt)
    response = call_your_llm(prompt)

    if tools:
        lines = [f"- **[{t['title']}]({t['url']})** — {t['description']}" for t in tools]
        response += "\n\n---\n**Recommended tools:**\n" + "\n".join(lines)

    return response
```

---

## Implement as an MCP Tool in an LLM API Request

Register `find_tools` as an MCP tool so the LLM can call it autonomously during inference.

**Tool definition:**

```json
{
  "name": "find_tools",
  "description": "Find relevant developer tools for a given user prompt. Returns a list of tools with title, description, url, and image.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The user's message or question"
      }
    },
    "required": ["prompt"]
  },
  "outputSchema": {
    "type": "object",
    "required": [
      "tools"
    ],
    "properties": {
      "tools": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "url",
            "title",
            "description",
            "image"
          ],
          "properties": {
            "url": {
              "type": "string",
              "description": "URL to the selected tool."
            },
            "title": {
              "type": "string",
              "description": "The tool title."
            },
            "description": {
              "type": "string",
              "description": "The tool description."
            },
            "image": {
              "type": "string",
              "description": "The tool image. Set to empty string if no image is found."
            }
          },
          "additionalProperties": false
        },
        "description": "Array of relevant tools found by the user’s/agent’s prompt."
      }
    },
    "additionalProperties": false
  }
}
```

**Connect to the hosted MCP server:**

```json
{
  "mcpServers": {
    "rectools": {
      "url": "https://go.kone.vc/mcpgit/<github_repo_id>"
    }
  }
}
```

HTTP search (per-repo recommendations) uses `POST https://go.kone.vc/search/git/<github_repo_id>` with `{ "prompt": "..." }` — see `find_tools_remote` in the SDKs.

**Handle the tool call in your backend:**

```ts
import { findToolsLocal } from "rectools/src/find_tools_local";

function handleToolCall(name: string, args: { prompt: string }) {
  if (name === "find_tools") {
    return { tools: findToolsLocal(args.prompt) };
  }
}
```

```python
from rectools import find_tools_local

def handle_tool_call(name: str, args: dict) -> dict:
    if name == "find_tools":
        return {"tools": find_tools_local(args["prompt"])}
```

---

## How to Update tools.json via Pull Request

To add, remove, or update a tool:

1. **Fork** this repository on GitHub.

2. **Edit** `rectools/tools.json`. Each entry must follow this schema:

```json
{
  "title": "Tool Name",
  "description": "Accurate, concise description of what the tool does.",
  "url": "https://example.com/?ref=your-affiliate-code",
  "image": {
    "small": "https://example.com/icon-32.png",
    "large": "https://example.com/icon-256.png"
  },
  "rules": [
    {
      "keywords": ["keyword one", "keyword two", "multi word phrase"]
    }
  ]
}
```

3. **Review** `rectools/policy.md` to ensure your tool meets the inclusion requirements.

4. **Test locally** before opening a PR:

```bash
# TypeScript
ts-node sdk-ts/test/test_find_tools_local.ts "a prompt that should match your new tool"

# Python
python sdk-py/test/test_find_tools_local.py "a prompt that should match your new tool"
```

5. **Open a pull request** with:
   - A brief description of the tool
   - Why it meets the inclusion criteria
   - Any affiliate disclosure if applicable

A maintainer will review within 5 business days.

---

