import { z } from "zod";
import type { ToolDef } from "./helpers";

const PLATFORM_ALL = z.enum(["kalshi", "polymarket", "robinhood"]);
const PLATFORM_KP = z.enum(["kalshi", "polymarket"]);
const RESOLUTION = z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]);

export const marketTools: ToolDef[] = [
  {
    name: "search_markets",
    description:
      "Search Kalshi/Polymarket/Robinhood markets by keyword — the entry point for resolving a query into market/event IDs. Default returns a compact flat `{ markets: [{ id, platform, title, description, outcomes, volume24h, status }] }` list (best for resolving IDs). Pass unified=true for grouped `{ results: [{ type:'event'|'market', ... }] }`, but note events embed their full market lists so it is ~10x larger — use sparingly.",
    shape: {
      q: z.string().min(1).describe("Search keyword, e.g. 'bitcoin 100k'."),
      platform: PLATFORM_ALL.optional().describe("Restrict to one platform; default all."),
      limit: z.number().int().positive().max(100).optional().describe("Max results (default 20)."),
      unified: z.boolean().optional().describe("Group into events+markets. Default false (compact flat list). unified=true embeds each event's full market list and is ~10x larger."),
    },
    toReq: (a) => ({ path: "/markets/search", query: { q: a.q, platform: a.platform, limit: a.limit, unified: a.unified } }),
  },
  {
    name: "list_markets",
    description:
      "List/browse markets by platform, status, and category. Returns { markets, hasMore, warnings? }; a non-empty warnings[] means a platform partially failed (non-fatal — use the markets you got).",
    shape: {
      platform: PLATFORM_ALL.optional(),
      status: z.string().optional().describe("Status filter, e.g. 'open'."),
      category: z.string().optional(),
      limit: z.number().int().positive().max(100).optional().describe("Default 20."),
      cursor: z.string().optional().describe("Opaque pagination cursor from a prior call."),
    },
    toReq: (a) => ({
      path: "/markets",
      query: { platform: a.platform, status: a.status, category: a.category, limit: a.limit, cursor: a.cursor },
    }),
  },
  {
    name: "get_market",
    description: "Get full details for one market by platform + id.",
    shape: { platform: PLATFORM_ALL, id: z.string().min(1) },
    toReq: (a) => ({ path: `/markets/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.id)}` }),
  },
  {
    name: "get_candles",
    description:
      "OHLC candlesticks for a market. NOTE: prices are 0-1; candle timestamps are in SECONDS; the returned `market` is a stub {id,platform,title}, not a full Market; volume is two-sided (YES+NO).",
    shape: {
      platform: PLATFORM_ALL,
      id: z.string().min(1),
      resolution: RESOLUTION.optional().describe("Default 1h."),
      startTime: z.number().int().optional().describe("Unix SECONDS."),
      endTime: z.number().int().optional().describe("Unix SECONDS."),
      limit: z.number().int().positive().max(1000).optional().describe("Default 100."),
      seriesTicker: z.string().optional().describe("Kalshi series ticker override."),
      smooth: z.boolean().optional().describe("Kalshi forward-fill smoothing."),
    },
    toReq: (a) => ({
      path: `/markets/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.id)}/candles`,
      query: {
        resolution: a.resolution,
        startTime: a.startTime,
        endTime: a.endTime,
        limit: a.limit,
        seriesTicker: a.seriesTicker,
        smooth: a.smooth,
      },
    }),
  },
  {
    name: "get_orderbook",
    description: "YES/NO order-book depth for a market. Kalshi & Polymarket only.",
    shape: { platform: PLATFORM_KP, id: z.string().min(1) },
    toReq: (a) => ({ path: `/markets/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.id)}/orderbook` }),
  },
  {
    name: "get_trades",
    description: "Recent executed trades for a market. Kalshi & Polymarket only. NOTE: trade timestamps are in MILLISECONDS.",
    shape: { platform: PLATFORM_KP, id: z.string().min(1), limit: z.number().int().positive().max(500).optional().describe("Default 50.") },
    toReq: (a) => ({
      path: `/markets/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.id)}/trades`,
      query: { limit: a.limit },
    }),
  },
  {
    name: "get_correlated_markets",
    description:
      "Find cross-platform price-correlated markets (Pearson on hourly candles). Bidirectional Kalshi<->Polymarket. Source platform must be kalshi or polymarket.",
    shape: {
      platform: PLATFORM_KP,
      id: z.string().min(1),
      resolution: RESOLUTION.optional().describe("Default 1h."),
      windowDays: z.number().int().positive().max(90).optional().describe("Default 7."),
      limit: z.number().int().positive().max(50).optional().describe("Default 10."),
    },
    toReq: (a) => ({
      path: `/markets/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.id)}/correlated`,
      query: { resolution: a.resolution, windowDays: a.windowDays, limit: a.limit },
    }),
  },
];
