import { describe, it, expect } from "vitest";
import { z } from "zod";
import { whaleTools } from "./whales";

const byName = Object.fromEntries(whaleTools.map((t) => [t.name, t]));

describe("whale tools", () => {
  it("exposes the 4 expected tools", () => {
    expect(whaleTools.map((t) => t.name).sort()).toEqual(
      ["get_whale_leaderboard", "get_whale_profile", "get_whale_stats", "get_whale_trades"].sort(),
    );
  });
  it("get_whale_profile validates a 0x wallet", () => {
    const shape = z.object(byName["get_whale_profile"].shape);
    expect(shape.safeParse({ wallet: "0x" + "a".repeat(40) }).success).toBe(true);
    expect(shape.safeParse({ wallet: "not-a-wallet" }).success).toBe(false);
  });
  it("get_whale_trades caps pageSize at 100", () => {
    const shape = z.object(byName["get_whale_trades"].shape);
    expect(shape.safeParse({ pageSize: 100 }).success).toBe(true);
    expect(shape.safeParse({ pageSize: 101 }).success).toBe(false);
  });
  it("get_whale_profile builds the wallet path", () => {
    const w = "0x" + "a".repeat(40);
    expect(byName["get_whale_profile"].toReq({ wallet: w })).toEqual({ path: `/whales/${w}` });
  });
});
