/**
 * test_find_tools_local.ts
 *
 * CLI test for find_tools_local.
 * Usage: ts-node test_find_tools_local.ts "<prompt>"
 *
 * Runs the local matching logic and prints results to stdout.
 * Exit code 0 = tools found, exit code 2 = no tools found.
 */

import * as path from "path";
import { findToolsLocal } from "../src/find_tools_local";

const TESTS: Array<{ prompt: string; expectAny: boolean }> = [
  {
    prompt: "How do I set up a linter for my TypeScript project?",
    expectAny: true,
  },
  {
    prompt: "Can you help me review this pull request and refactor it?",
    expectAny: true,
  },
  {
    prompt: "Generate documentation for my API endpoints",
    expectAny: true,
  },
  {
    prompt: "What is the capital of France?",
    expectAny: false,
  },
];

function runTests(promptArg?: string): void {
  const dbPath = path.resolve(__dirname, "../../rectools/tools.json");

  if (promptArg) {
    // Single-prompt mode (used from CLI)
    console.log(`\nPrompt: "${promptArg}"`);
    const results = findToolsLocal(promptArg, dbPath);
    if (results.length === 0) {
      console.log("No matching tools found.");
      process.exit(2);
    } else {
      console.log(`Found ${results.length} tool(s):\n`);
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    }
    return;
  }

  // Suite mode
  let passed = 0;
  let failed = 0;

  for (const tc of TESTS) {
    const results = findToolsLocal(tc.prompt, dbPath);
    const gotAny = results.length > 0;
    const ok = gotAny === tc.expectAny;

    const status = ok ? "PASS" : "FAIL";
    const expectLabel = tc.expectAny ? "expected match" : "expected no match";
    const gotLabel = gotAny
      ? `got ${results.length} tool(s): ${results.map((r) => r.title).join(", ")}`
      : "got no tools";

    console.log(`[${status}] "${tc.prompt}"`);
    console.log(`       ${expectLabel} — ${gotLabel}`);

    if (ok) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

const promptArg = process.argv.slice(2).join(" ") || undefined;
runTests(promptArg);
