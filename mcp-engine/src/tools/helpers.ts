import type { ZodRawShape } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TrendiqClient } from "../client";

export interface ToolDef {
  name: string;
  description: string;
  shape: ZodRawShape;
  toReq: (args: Record<string, any>) => { path: string; query?: Record<string, unknown> };
}

export function registerTools(server: McpServer, client: TrendiqClient, defs: ToolDef[]): void {
  for (const def of defs) {
    server.tool(def.name, def.description, def.shape, async (args: Record<string, any>) => {
      const { path, query } = def.toReq(args ?? {});
      const r = await client.get(path, query);
      if (!r.ok) {
        const code = r.code ? ` ${r.code}` : "";
        return {
          content: [{ type: "text" as const, text: `TrendIQ API error (${r.status}${code}): ${r.message}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(r.data, null, 2) }] };
    });
  }
}
