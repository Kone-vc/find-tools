/**
 * Validates keytools/tools.json: schema, unique URLs, and per-tool keyword
 * round-trip (same logic as findToolsLocal). Prints one line per tool — like a linter.
 *
 * Usage:
 *   npx ts-node test/test_tools_json.ts
 *   npx ts-node test/test_tools_json.ts --quiet   # only failures + summary
 */

import * as fs from "fs";
import * as path from "path";
import { matchPromptAgainstKeywords } from "../src/find_tools_local";

const DB_PATH = path.resolve(__dirname, "../../keytools/tools.json");
const QUIET = process.argv.includes("--quiet");

interface RawTool {
  url: string;
  title: string;
  description: string;
  image: { large: string | null; small: string | null };
  rules: { keywords: string[] };
  texts?: unknown;
}

function toolSlug(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ?? url;
  } catch {
    return url;
  }
}

function shortTitle(title: string, max = 72): string {
  const s = title.trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function isHttps(s: string): boolean {
  return /^https:\/\//i.test(s.trim());
}

function validateToolsJson(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || !("tools" in raw)) {
    return ["root must be an object with a tools array"];
  }
  const tools = (raw as { tools: unknown }).tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    return ["tools must be a non-empty array"];
  }

  const seenUrls = new Set<string>();

  tools.forEach((t, i) => {
    const p = `tools[${i}]`;
    if (!t || typeof t !== "object") {
      errors.push(`${p}: must be an object`);
      return;
    }
    const o = t as Record<string, unknown>;

    for (const key of ["url", "title", "description", "image", "rules"] as const) {
      if (!(key in o)) {
        errors.push(`${p}: missing "${key}"`);
      }
    }
    if (errors.some((e) => e.startsWith(p + ":") && e.includes("missing"))) {
      return;
    }

    const url = o.url;
    const title = o.title;
    const description = o.description;
    const image = o.image;
    const rules = o.rules;

    if (typeof url !== "string" || !url.trim()) {
      errors.push(`${p}.url: non-empty string required`);
    } else if (!isHttps(url)) {
      errors.push(`${p}.url: must be an https URL`);
    } else if (seenUrls.has(url)) {
      errors.push(`${p}.url: duplicate URL`);
    } else {
      seenUrls.add(url);
    }

    if (typeof title !== "string" || !title.trim()) {
      errors.push(`${p}.title: non-empty string required`);
    }
    if (typeof description !== "string" || !description.trim()) {
      errors.push(`${p}.description: non-empty string required`);
    }

    if (!image || typeof image !== "object") {
      errors.push(`${p}.image: object required`);
    } else {
      const im = image as Record<string, unknown>;
      for (const sz of ["large", "small"] as const) {
        const u = im[sz];
        if (u === null) continue;
        if (typeof u !== "string" || !u.trim()) {
          errors.push(
            `${p}.image.${sz}: null or non-empty https URL string required`
          );
        } else if (!isHttps(u)) {
          errors.push(`${p}.image.${sz}: must be an https URL`);
        }
      }
    }

    if (!rules || typeof rules !== "object") {
      errors.push(`${p}.rules: object required`);
    } else {
      const kws = (rules as { keywords?: unknown }).keywords;
      if (!Array.isArray(kws) || kws.length === 0) {
        errors.push(`${p}.rules.keywords: non-empty array required`);
      } else {
        kws.forEach((kw, j) => {
          if (typeof kw !== "string" || !kw.trim()) {
            errors.push(`${p}.rules.keywords[${j}]: non-empty string required`);
          }
        });
      }
    }

    const texts = o.texts;
    if (texts !== undefined) {
      if (!texts || typeof texts !== "object") {
        errors.push(`${p}.texts: must be an object when present`);
      } else {
        const ru = (texts as { ru?: unknown }).ru;
        if (ru !== undefined) {
          if (!ru || typeof ru !== "object") {
            errors.push(`${p}.texts.ru: must be an object when present`);
          } else {
            const r = ru as Record<string, unknown>;
            for (const fld of ["title", "description"] as const) {
              if (typeof r[fld] !== "string" || !(r[fld] as string).trim()) {
                errors.push(`${p}.texts.ru.${fld}: non-empty string required`);
              }
            }
          }
        }
      }
    }
  });

  return errors;
}

function run(): void {
  const rawText = fs.readFileSync(DB_PATH, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error("[FAIL] tools.json is not valid JSON:", e);
    process.exit(1);
  }

  if (!QUIET) {
    console.log(`\n>>> ${DB_PATH}`);
    console.log(">>> Schema");
  }

  const schemaErrors = validateToolsJson(data);
  if (schemaErrors.length > 0) {
    console.error("[FAIL] Schema validation:");
    for (const line of schemaErrors) {
      console.error(`       ${line}`);
    }
    process.exit(1);
  }

  const tools = (data as { tools: RawTool[] }).tools;
  if (!QUIET) {
    console.log(`[PASS] schema — ${tools.length} entries\n`);
    console.log(">>> Per-tool (keywords → synthetic prompt → match)");
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const kws = tool.rules.keywords;
    const prompt = kws.join(" ");
    const slug = toolSlug(tool.url);
    const label = `[${i}] ${slug}  ${shortTitle(tool.title)}`;

    if (matchPromptAgainstKeywords(prompt, kws)) {
      passed++;
      if (!QUIET) {
        console.log(`[PASS] ${label}`);
      }
    } else {
      failed++;
      console.error(`[FAIL] ${label}`);
      console.error(`       keywords do not match synthetic prompt`);
    }
  }

  console.log(
    `\n${failed === 0 ? "[PASS]" : "[FAIL]"} tools.json — ${passed}/${tools.length} per-tool checks OK, schema OK`
  );

  process.exit(failed > 0 ? 1 : 0);
}

run();
