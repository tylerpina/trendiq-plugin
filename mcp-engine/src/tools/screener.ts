import { z } from "zod";
import type { ToolDef } from "./helpers";

const PLATFORM_KP = z.enum(["kalshi", "polymarket"]);

export const screenerTools: ToolDef[] = [
  {
    name: "screen_markets",
    description:
      "Filter/sort all open markets on one platform. Kalshi & Polymarket only. NOTE: Kalshi scans with a large `limit` are slow (per-market detail fetches) — keep `limit` modest for Kalshi. Prices are 0-1.",
    shape: {
      platform: PLATFORM_KP,
      sortBy: z
        .string()
        .optional()
        .describe(
          "Sort field — advisory (API silently accepts any string and falls back to volume24h). " +
          "Confirmed-OK values: volume, volume24h, liquidity, priceChange, timeRemaining (default volume24h).",
        ),
      sortDirection: z.enum(["asc", "desc"]).optional().describe("Default desc."),
      timeRemaining: z
        .string()
        .optional()
        .describe(
          "Time-to-expiry filter — advisory (API silently accepts any string and treats unknowns as 'all'). " +
          "Confirmed-OK values: all, 1d, 1w, 1m, 3m, 6m, 1y (default all).",
        ),
      minPrice: z.number().min(0).max(1).optional(),
      maxPrice: z.number().min(0).max(1).optional(),
      minVolume: z.number().min(0).optional(),
      minVolume24h: z.number().min(0).optional(),
      minLiquidity: z.number().min(0).optional(),
      limit: z.number().int().positive().max(500).optional().describe("Default 50."),
    },
    toReq: (a) => ({
      path: "/scanner/markets",
      query: {
        platform: a.platform,
        sortBy: a.sortBy,
        sortDirection: a.sortDirection,
        timeRemaining: a.timeRemaining,
        minPrice: a.minPrice,
        maxPrice: a.maxPrice,
        minVolume: a.minVolume,
        minVolume24h: a.minVolume24h,
        minLiquidity: a.minLiquidity,
        limit: a.limit,
      },
    }),
  },
  {
    name: "get_scanner_categories",
    description: "List valid scanner category labels.",
    shape: {},
    toReq: () => ({ path: "/scanner/categories" }),
  },
];
