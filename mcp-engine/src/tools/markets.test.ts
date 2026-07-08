import { describe, it, expect } from "vitest";
import { z } from "zod";
import { marketTools } from "./markets";

const byName = Object.fromEntries(marketTools.map((t) => [t.name, t]));

describe("market tools", () => {
  it("exposes the 7 expected tools", () => {
    expect(marketTools.map((t) => t.name).sort()).toEqual(
      ["get_candles", "get_correlated_markets", "get_market", "get_orderbook", "get_trades", "list_markets", "search_markets"].sort(),
    );
  });
  it("search_markets requires q and rejects a bad platform", () => {
    const shape = z.object(byName["search_markets"].shape);
    expect(shape.safeParse({ q: "btc" }).success).toBe(true);
    expect(shape.safeParse({}).success).toBe(false);
    expect(shape.safeParse({ q: "x", platform: "bogus" }).success).toBe(false);
  });
  it("search_markets omits unified by default (compact flat list) and passes it through when set", () => {
    expect(byName["search_markets"].toReq({ q: "btc" }).query?.unified).toBeUndefined();
    expect(byName["search_markets"].toReq({ q: "btc", unified: true }).query).toMatchObject({ unified: true });
    expect(byName["search_markets"].toReq({ q: "btc", unified: false }).query).toMatchObject({ unified: false });
  });
  it("get_candles builds path + query", () => {
    expect(byName["get_candles"].toReq({ platform: "polymarket", id: "0xabc", resolution: "4h", limit: 50 })).toEqual({
      path: "/markets/polymarket/0xabc/candles",
      query: { resolution: "4h", limit: 50 },
    });
  });
  it("get_orderbook rejects robinhood (KP-only)", () => {
    const shape = z.object(byName["get_orderbook"].shape);
    expect(shape.safeParse({ platform: "polymarket", id: "x" }).success).toBe(true);
    expect(shape.safeParse({ platform: "robinhood", id: "x" }).success).toBe(false);
  });
});
