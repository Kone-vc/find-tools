/**
 * test_find_tools_local.ts
 *
 * CLI test for find_tools_local.
 * Run from sdk-ts (after `npm install`):
 *   npx ts-node test/test_find_tools_local.ts
 *   npx ts-node test/test_find_tools_local.ts "<prompt>"
 *   npx ts-node test/test_find_tools_local.ts --time "<prompt>"
 *   npx ts-node test/test_find_tools_local.ts --bench --time "prompt a" "prompt b"
 *
 * Suite mode: real user-style prompts; same matching as production (keywords from
 * tools.json). Asserts the expected tool (by url) appears in the results.
 */

import { performance } from "node:perf_hooks";
import * as fs from "fs";
import * as path from "path";
import { findToolsLocal } from "../src/find_tools_local";

const DB_PATH = path.resolve(__dirname, "../../keytools/tools.json");

interface RawTool {
  url: string;
  title: string;
  rules: { keywords: string[] };
}

interface Db {
  tools: RawTool[];
}

/** User-style prompt → expected tool (assert by url after keyword matching). */
const USER_SCENARIOS: readonly {
  id: string;
  userPrompt: string;
  expectUrl: string;
}[] = [
  {
    id: "airflow-ide-lint",
    userPrompt:
      "How do I set up a linter for my Airflow DAGs in a proper IDE?",
    expectUrl:
      "https://zero.click/89c531a4-da37-4345-ba22-682858ce66cc",
  },
  {
    id: "pr-review-ci",
    userPrompt:
      "Can you help review this pull request and catch bugs before we merge to production?",
    expectUrl:
      "https://zero.click/ba7894cf-7f03-4b35-bca7-bcbdc06ea886",
  },
  {
    id: "api-docs-nl",
    userPrompt:
      "Search our API documentation with natural language instead of exact keywords",
    expectUrl:
      "https://zero.click/5acf312c-e7fa-4d95-9fa0-1b80f2e35a69",
  },
];

const NEGATIVE_PROMPT = "What is the capital of France?";

function loadDb(): Db {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as Db;
}

function runSingle(promptArg: string, withTime: boolean): void {
  const t0 = withTime ? performance.now() : 0;
  const results = findToolsLocal(promptArg, DB_PATH);
  const ms = withTime ? performance.now() - t0 : 0;

  console.log(`\nPrompt: "${promptArg}"`);
  if (withTime) {
    console.log(`Time: ${ms.toFixed(2)} ms`);
  }
  if (results.length === 0) {
    console.log("No matching tools found.");
    process.exit(2);
  } else {
    console.log(`Found ${results.length} tool(s):\n`);
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }
}

function runBench(prompts: string[], fullJson: boolean): void {
  for (const p of prompts) {
    const t0 = performance.now();
    const results = findToolsLocal(p, DB_PATH);
    const ms = performance.now() - t0;
    console.log("\n---");
    console.log(`Prompt: "${p}"`);
    console.log(`Time: ${ms.toFixed(2)} ms | Hits: ${results.length}`);
    if (results.length === 0) continue;
    if (fullJson) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(
        JSON.stringify(
          results.map((r) => ({ title: r.title, url: r.url })),
          null,
          2
        )
      );
    }
  }
  process.exit(0);
}

function runSuite(): void {
  const db = loadDb();
  const byUrl = new Map(db.tools.map((t) => [t.url, t]));
  let passed = 0;
  let failed = 0;

  for (const sc of USER_SCENARIOS) {
    const catalog = byUrl.get(sc.expectUrl);
    if (!catalog) {
      console.log(`[FAIL] [${sc.id}] missing url in tools.json: ${sc.expectUrl}`);
      failed++;
      continue;
    }

    const results = findToolsLocal(sc.userPrompt, DB_PATH);
    const hit = results.some((r) => r.url === sc.expectUrl);

    const status = hit ? "PASS" : "FAIL";
    const title =
      catalog.title.length > 60
        ? `${catalog.title.slice(0, 59)}…`
        : catalog.title;

    console.log(`[${status}] [${sc.id}] user prompt → expect in results (keyword match)`);
    console.log(`       "${sc.userPrompt}"`);
    console.log(`       → "${title}" (${sc.expectUrl})`);

    if (hit) {
      passed++;
      console.log(`       matched: yes (${results.length} tool(s) total)`);
    } else {
      failed++;
      const got = results.length
        ? results.map((r) => r.title).join(", ")
        : "no tools";
      console.log(`       matched: no — got: ${got}`);
    }
  }

  {
    const results = findToolsLocal(NEGATIVE_PROMPT, DB_PATH);
    const ok = results.length === 0;
    const status = ok ? "PASS" : "FAIL";
    console.log(`[${status}] "${NEGATIVE_PROMPT}"`);
    console.log(
      `       expected no match — ${ok ? "got no tools" : `got ${results.length} tool(s): ${results.map((r) => r.title).join(", ")}`}`
    );
    if (ok) passed++;
    else failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

const raw = process.argv.slice(2);
const withTime = raw.includes("--time");
const args = raw.filter((a) => a !== "--time");
const benchAt = args.indexOf("--bench");

if (benchAt >= 0) {
  const prompts = args.slice(benchAt + 1);
  if (prompts.length === 0) {
    console.error("Usage: ... --bench [--time] \"prompt1\" \"prompt2\" ...");
    process.exit(1);
  }
  runBench(prompts, withTime);
} else if (args.length === 0) {
  runSuite();
} else {
  runSingle(args.join(" "), withTime);
}
