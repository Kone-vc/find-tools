import * as https from "https";
import * as http from "http";
import { URL } from "url";

interface ToolImage {
  small: string;
  large: string;
}

interface MatchedTool {
  title: string;
  description: string;
  url: string;
  image: ToolImage;
}

interface ApiResponse {
  tools?: unknown[];
}

const API_BASE = "https://go.kone.vc";
const MCP_SERVER_URL = "https://go.kone.vc/mcpgit";

function normalizeTool(raw: Record<string, unknown>): MatchedTool {
  const imageRaw = raw.image;
  const image: ToolImage =
    typeof imageRaw === "string"
      ? { small: imageRaw, large: imageRaw }
      : {
          small: (imageRaw as ToolImage).small,
          large: (imageRaw as ToolImage).large,
        };
  return {
    title: String(raw.title),
    description: String(raw.description),
    url: String(raw.url),
    image,
  };
}

// ─── Method 1: HTTP API ───────────────────────────────────────────────────────

function postJSON(url: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "find-tools/1.0",
      },
    };

    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const code = res.statusCode ?? 0;
        if (code >= 400) {
          let detail = data;
          try {
            const j = JSON.parse(data) as {
              error?: { message?: string };
              message?: string;
            };
            detail = j.error?.message ?? j.message ?? data;
          } catch {
            // keep data
          }
          reject(new Error(`HTTP ${code}: ${detail}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export async function findToolsRemoteHttp(
  prompt: string,
  repoId: string
): Promise<MatchedTool[]> {
  const url = `${API_BASE}/search/git/${encodeURIComponent(repoId)}`;
  const response = (await postJSON(url, { prompt })) as ApiResponse;
  const tools = response.tools ?? [];
  return tools
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
    .map((t) => normalizeTool(t));
}

// ─── Method 2: MCP Tool Call ─────────────────────────────────────────────────

interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { code: number; message: string };
}

export async function findToolsRemoteMcp(
  prompt: string
): Promise<MatchedTool[]> {
  const mcpRequest: McpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "find_tools",
      arguments: { prompt },
    },
  };

  const mcpurl = `${MCP_SERVER_URL}/${encodeURIComponent(repoId)}`;
  const response = (await postJSON(mcpurl, mcpRequest)) as McpResponse;

  if (response.error) {
    throw new Error(
      `MCP error ${response.error.code}: ${response.error.message}`
    );
  }

  const content = response.result?.content ?? [];
  for (const item of content) {
    if (item.type === "text" && item.text) {
      try {
        const parsed = JSON.parse(item.text) as ApiResponse;
        const tools = parsed.tools ?? [];
        return tools
          .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
          .map((t) => normalizeTool(t));
      } catch {
        // not JSON, skip
      }
    }
  }

  return [];
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  const methodFlag = args.find((a) => a === "--http" || a === "--mcp") ?? "--http";
  const repoIdFlag = args.find((a) => a.startsWith("--repo="));
  const repoId = repoIdFlag ? repoIdFlag.split("=")[1] : "default";
  const promptArgs = args.filter(
    (a) => a !== "--http" && a !== "--mcp" && !a.startsWith("--repo=")
  );
  const prompt = promptArgs.join(" ");

  if (!prompt) {
    console.error(
      "Usage: ts-node find_tools_remote.ts [--http|--mcp] [--repo=<id>] <prompt>"
    );
    process.exit(1);
  }

  const run = async () => {
    let results: MatchedTool[];
    if (methodFlag === "--mcp") {
      console.error("[method: MCP]");
      results = await findToolsRemoteMcp(prompt);
    } else {
      console.error(`[method: HTTP API, repo: ${repoId}]`);
      results = await findToolsRemoteHttp(prompt, repoId);
    }

    if (results.length === 0) {
      console.log("No matching tools found.");
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
  };

  run().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
