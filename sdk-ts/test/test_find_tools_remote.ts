/**
 * test_find_tools_remote.ts
 *
 * CLI test for find_tools_remote.
 * Usage:
 *   ts-node test_find_tools_remote.ts --http [--repo=<id>] "<prompt>"
 *   ts-node test_find_tools_remote.ts --mcp "<prompt>"
 *
 * Exit code 0 = tools found, exit code 2 = no tools found, exit code 1 = error.
 */

import {
  findToolsRemoteHttp,
  findToolsRemoteMcp,
} from "../src/find_tools_remote";

interface MatchedTool {
  title: string;
  description: string;
  url: string;
  image: { small: string; large: string };
}

async function runRemoteTest(
  prompt: string,
  method: "http" | "mcp",
  repoId: string
): Promise<void> {
  console.log(`\nPrompt : "${prompt}"`);
  console.log(`Method : ${method}${method === "http" ? ` (repo: ${repoId})` : ""}`);
  console.log("─".repeat(60));

  let results: MatchedTool[];
  try {
    if (method === "mcp") {
      results = await findToolsRemoteMcp(prompt);
    } else {
      results = await findToolsRemoteHttp(prompt, repoId);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Request failed: ${message}`);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log("No matching tools found.");
    process.exit(2);
  }

  console.log(`Found ${results.length} tool(s):\n`);
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// ─── Parse CLI arguments ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

let method: "http" | "mcp" = "http";
let repoId = "default";
const promptParts: string[] = [];

for (const arg of args) {
  if (arg === "--http") {
    method = "http";
  } else if (arg === "--mcp") {
    method = "mcp";
  } else if (arg.startsWith("--repo=")) {
    repoId = arg.split("=")[1];
  } else {
    promptParts.push(arg);
  }
}

const prompt = promptParts.join(" ");

if (!prompt) {
  console.error(
    "Usage: ts-node test_find_tools_remote.ts [--http|--mcp] [--repo=<id>] <prompt>"
  );
  process.exit(1);
}

runRemoteTest(prompt, method, repoId);
