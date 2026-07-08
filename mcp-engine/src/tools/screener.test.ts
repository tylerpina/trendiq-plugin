import { describe, it, expect } from "vitest";
import { z } from "zod";
import { screenerTools } from "./screener";

const byName = Object.fromEntries(screenerTools.map((t) => [t.name, t]));

describe("screener tools", () => {
  it("exposes the 2 expected tools", () => {
    expect(screenerTools.map((t) => t.name).sort()).toEqual(["get_scanner_categories", "screen_markets"].sort());
  });
  it("screen_markets requires platform (KP-only) and bounds price 0-1", () => {
    const shape = z.object(byName["screen_markets"].shape);
    expect(shape.safeParse({ platform: "kalshi" }).success).toBe(true);
    expect(shape.safeParse({}).success).toBe(false);
    expect(shape.safeParse({ platform: "robinhood" }).success).toBe(false);
    expect(shape.safeParse({ platform: "kalshi", maxPrice: 1.5 }).success).toBe(false);
  });
  it("screen_markets builds query", () => {
    expect(byName["screen_markets"].toReq({ platform: "polymarket", sortBy: "volume24h", limit: 25 })).toEqual({
      path: "/scanner/markets",
      query: { platform: "polymarket", sortBy: "volume24h", limit: 25 },
    });
  });
});
