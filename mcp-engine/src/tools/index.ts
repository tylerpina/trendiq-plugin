import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TrendiqClient } from "../client";
import { registerTools, type ToolDef } from "./helpers";
import { marketTools } from "./markets";
import { whaleTools } from "./whales";
import { screenerTools } from "./screener";
import { arbitrageTools } from "./arbitrage";
import { sentimentTools } from "./sentiment";
import { signalTools } from "./signals";
import { newsTools } from "./news";
import { sportsTools } from "./sports";

const healthTools: ToolDef[] = [
  {
    name: "health",
    description: "TrendIQ API liveness: { status, timestamp, uptime, version }.",
    shape: {},
    toReq: () => ({ path: "/health" }),
  },
];

export const allTools: ToolDef[] = [
  ...marketTools,
  ...whaleTools,
  ...screenerTools,
  ...arbitrageTools,
  ...sentimentTools,
  ...signalTools,
  ...newsTools,
  ...sportsTools,
  ...healthTools,
];

export function registerAll(server: McpServer, client: TrendiqClient): void {
  registerTools(server, client, allTools);
}
