import * as fs from "fs";
import * as path from "path";

interface ToolImage {
  small: string;
  large: string;
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
  // Also include the full lowercased prompt for substring matching
  phrases.push(lower);
  return phrases;
}

export function findToolsLocal(
  prompt: string,
  dbPath?: string
): MatchedTool[] {
  const resolvedPath =
    dbPath ?? path.resolve(__dirname, "../../keytools/tools.json");
  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const db: ToolsDatabase = JSON.parse(raw);

  const phrases = buildPromptPhrases(prompt);

  const matched: MatchedTool[] = [];

  for (const tool of db.tools) {
    const keywords = tool.rules.keywords.map((k) => k.toLowerCase());
    const isMatch = keywords.some((keyword) => {
      // Check if any phrase equals the keyword, or if the full prompt contains it
      return phrases.includes(keyword) || phrases[phrases.length - 1].includes(keyword);
    });

    if (isMatch) {
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
    console.error("Usage: ts-node find_tools_local.ts <prompt>");
    process.exit(1);
  }

  const results = findToolsLocal(prompt);
  if (results.length === 0) {
    console.log("No matching tools found.");
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}
