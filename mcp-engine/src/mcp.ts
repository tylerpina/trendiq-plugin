import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TrendiqClient } from "./client";
import { registerAll } from "./tools/index";

const DEFAULT_BASE_URL = "https://trendiq.pro/api";

export function createServer(client?: TrendiqClient): McpServer {
  const server = new McpServer({ name: "trendiq", version: "0.1.0" });
  registerAll(server, client ?? new TrendiqClient(process.env.TRENDIQ_API_BASE_URL ?? DEFAULT_BASE_URL));
  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
