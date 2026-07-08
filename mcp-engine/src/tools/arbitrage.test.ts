import { describe, it, expect } from "vitest";
import { z } from "zod";
import { arbitrageTools } from "./arbitrage";

const byName = Object.fromEntries(arbitrageTools.map((t) => [t.name, t]));

describe("arbitrage tools", () => {
  it("exposes the 4 expected tools", () => {
    expect(arbitrageTools.map((t) => t.name).sort()).toEqual(
      ["get_arbitrage_config", "list_arbitrage_pairs", "scan_arbitrage", "scan_arbitrage_pair"].sort(),
    );
  });
  it("scan_arbitrage validates category enum", () => {
    const shape = z.object(byName["scan_arbitrage"].shape);
    expect(shape.safeParse({ category: "NFL" }).success).toBe(true);
    expect(shape.safeParse({ category: "Cricket" }).success).toBe(false);
    expect(shape.safeParse({}).success).toBe(true);
  });
  it("scan_arbitrage_pair encodes the pairId into the path", () => {
    expect(byName["scan_arbitrage_pair"].toReq({ pairId: "sb-2026-lar", debug: true })).toEqual({
      path: "/arbitrage/scan/sb-2026-lar",
      query: { debug: true },
    });
  });
});
