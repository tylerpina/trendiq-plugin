import { z } from "zod";
import type { ToolDef } from "./helpers";

const ARB_CATEGORY = z.enum(["NFL", "NBA", "Politics", "NHL", "Soccer", "Entertainment", "NCAA", "Olympics", "Economics"]);

export const arbitrageTools: ToolDef[] = [
  {
    name: "scan_arbitrage",
    description:
      "Scan configured Kalshi<->Polymarket pairs for cross-platform arbitrage (fee-adjusted). Kalshi fee is NON-flat: ceil(0.07*P*(1-P)) per side; Polymarket has zero trading fee (only ~$0.01 Polygon gas). Expensive — server-cached; do not poll.",
    shape: {
      category: ARB_CATEGORY.optional(),
      minProfitPct: z.number().min(0).max(100).optional().describe("Minimum profit-percent threshold (default 0.5)."),
    },
    toReq: (a) => ({ path: "/arbitrage/scan", query: { category: a.category, minProfitPct: a.minProfitPct } }),
  },
  {
    name: "scan_arbitrage_pair",
    description:
      "Scan one named arbitrage pair by id. On an unknown id the API returns the list of valid pair ids in the error message — use it to recover (or call list_arbitrage_pairs first).",
    shape: { pairId: z.string().min(1), debug: z.boolean().optional() },
    toReq: (a) => ({ path: `/arbitrage/scan/${encodeURIComponent(a.pairId)}`, query: { debug: a.debug } }),
  },
  {
    name: "list_arbitrage_pairs",
    description: "List configured arbitrage pairs (optionally filtered by category).",
    shape: { category: ARB_CATEGORY.optional() },
    toReq: (a) => ({ path: "/arbitrage/pairs", query: { category: a.category } }),
  },
  {
    name: "get_arbitrage_config",
    description: "Current fees, strategies, thresholds, and live Polygon gas / POL price used by the arbitrage calculator.",
    shape: {},
    toReq: () => ({ path: "/arbitrage/config" }),
  },
];
