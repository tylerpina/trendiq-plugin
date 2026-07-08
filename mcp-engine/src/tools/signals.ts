import { z } from "zod";
import type { ToolDef } from "./helpers";

const SIGNAL_TYPE = z.enum(["volume_spike", "whale_cluster", "price_movement", "pro_convergence"]);

export const signalTools: ToolDef[] = [
  {
    name: "get_signals",
    description:
      "Real-time smart-money signal feed. Types: volume_spike, whale_cluster (Polymarket-only), price_movement, pro_convergence (Polymarket-only; its inferred BUY->YES side is UNRELIABLE and its winRate/pnl detail are placeholders — do not report them as real). Page backward with cursor.",
    shape: {
      limit: z.number().int().positive().max(100).optional().describe("Default 20, max 100."),
      type: SIGNAL_TYPE.optional(),
      platform: z.enum(["kalshi", "polymarket"]).optional(),
      cursor: z.string().optional(),
    },
    toReq: (a) => ({ path: "/signals/feed", query: { limit: a.limit, type: a.type, platform: a.platform, cursor: a.cursor } }),
  },
];
