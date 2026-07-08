import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sentimentTools } from "./sentiment";
import { signalTools } from "./signals";

describe("sentiment + signals tools", () => {
  it("sentiment exposes get_sentiment and builds the polymarket path", () => {
    expect(sentimentTools.map((t) => t.name)).toEqual(["get_sentiment"]);
    expect(sentimentTools[0].toReq({ id: "0xcond" })).toEqual({ path: "/markets/polymarket/0xcond/sentiment" });
  });
  it("signals exposes get_signals with a type enum", () => {
    expect(signalTools.map((t) => t.name)).toEqual(["get_signals"]);
    const shape = z.object(signalTools[0].shape);
    expect(shape.safeParse({ type: "whale_cluster" }).success).toBe(true);
    expect(shape.safeParse({ type: "made_up" }).success).toBe(false);
    expect(shape.safeParse({ limit: 101 }).success).toBe(false);
  });
});
