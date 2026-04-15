import * as fs from "fs";
import * as path from "path";

interface ToolImage {
  small: string | null;
  large: string | null;
}

interface Tool {
  title: string;
  description: string;
  url: string;
  image: ToolImage;
  rules: {
    keywords: string[];
  };
}

interface ToolsDatabase {
  tools: Tool[];
}

interface MatchedTool {
  title: string;
  description: string;
  url: string;
  image: ToolImage;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function buildPromptPhrases(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const tokens = tokenize(prompt);

  // Include individual tokens and bigrams/trigrams for multi-word keyword matching
  const phrases: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  for (let i = 0; i < tokens.length - 2; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  // Also include the full lowercased prompt for whole-word substring matching
  phrases.push(lower);
  return phrases;
}

/** True if keyword appears in text as whole word(s), not inside another word (e.g. "api" vs "capital"). */
function promptContainsKeywordWords(text: string, keyword: string): boolean {
  const parts = keyword.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(
    `(?:^|[^a-z0-9])${escaped.join("\\s+")}(?:[^a-z0-9]|$)`,
    "i"
  );
  return re.test(text);
}

/** Same matching rules as {@link findToolsLocal}; useful for tests and batch checks. */
export function matchPromptAgainstKeywords(
  prompt: string,
  keywords: string[]
): boolean {
  const phrases = buildPromptPhrases(prompt);
  const full = phrases[phrases.length - 1];
  return keywords.some((kw) => {
    const keyword = kw.toLowerCase();
    return phrases.includes(keyword) || promptContainsKeywordWords(full, keyword);
  });
}

export function findToolsLocal(
  prompt: string,
  dbPath?: string
): MatchedTool[] {
  const resolvedPath =
    dbPath ?? path.resolve(__dirname, "../../keytools/tools.json");
  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const db: ToolsDatabase = JSON.parse(raw);

  const matched: MatchedTool[] = [];

  for (const tool of db.tools) {
    if (matchPromptAgainstKeywords(prompt, tool.rules.keywords)) {
      matched.push({
        title: tool.title,
        description: tool.description,
        url: tool.url,
        image: tool.image,
      });
    }
  }

  return matched;
}

// CLI entrypoint
if (require.main === module) {
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) {
    console.error("Usage: npx ts-node src/find_tools_local.ts <prompt>");
    process.exit(1);
  }

  const results = findToolsLocal(prompt);
  if (results.length === 0) {
    console.log("No matching tools found.");
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}
