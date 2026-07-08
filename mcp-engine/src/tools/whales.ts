import { z } from "zod";
import type { ToolDef } from "./helpers";

const WALLET = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 42-char 0x wallet address.");

export const whaleTools: ToolDef[] = [
  {
    name: "get_whale_trades",
    description:
      "Recent large Polymarket trades (>= $1k), enriched with trader win-rate, paginated. NOTE: winRate may be null (= unknown, NOT 0%); proTradersOnly=true can return [] if the pro_traders table is not yet backfilled (absence of a pro flag != 'not a pro').",
    shape: {
      page: z.number().int().positive().optional().describe("Default 1."),
      pageSize: z.number().int().positive().max(100).optional().describe("Default 10, max 100."),
      minSizeUsd: z.number().positive().optional().describe("Minimum trade size in USD."),
      proTradersOnly: z.boolean().optional(),
    },
    toReq: (a) => ({
      path: "/whales/recent",
      query: { page: a.page, pageSize: a.pageSize, minSizeUsd: a.minSizeUsd, proTradersOnly: a.proTradersOnly },
    }),
  },
  {
    name: "get_whale_profile",
    description:
      "Per-wallet trader stats (win rate, PnL, volume, recent trades) — the win-rate authority. winRate is null with <3 closed trades (render 'unknown', never 0%). Win rate is redemption-bias-safe (subgraph realized PnL); only the unrealized-PnL component of total PnL touches the biased Positions API.",
    shape: { wallet: WALLET },
    toReq: (a) => ({ path: `/whales/${encodeURIComponent(a.wallet)}` }),
  },
  {
    name: "get_whale_leaderboard",
    description: "Top whale wallets by profit. NOTE: winRate is ALWAYS null in this list — call get_whale_profile for a real win rate.",
    shape: {},
    toReq: () => ({ path: "/whales/leaderboard" }),
  },
  {
    name: "get_whale_stats",
    description:
      "Whale poller diagnostics: { isPolling, lastPollTime, lastTradeTimestamp, recentTradesCount, minTradeSizeUsd }. Check this before trusting an empty whale/signal feed.",
    shape: {},
    toReq: () => ({ path: "/whales/stats" }),
  },
];
