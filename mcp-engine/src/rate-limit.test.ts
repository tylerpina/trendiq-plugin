import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter, readRateLimitConfigFromEnv } from "./rate-limit";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a burst up to the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(true);
    const third = limiter.check("ip-a");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks at limit+1 with 429 semantics (retryAfterSec set)", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("ip-a");
    limiter.check("ip-a");
    const blocked = limiter.check("ip-a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("restores allowance after the window resets", () => {
    let time = 1_000_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => time });
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(false);

    time += 10_001;
    const decision = limiter.check("ip-a");
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(1);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(false);
    expect(limiter.check("ip-b").allowed).toBe(true);
  });

  it("respects an injected clock for retry timing", () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 30_000, now: () => time });
    limiter.check("ip-a");
    const blocked = limiter.check("ip-a");
    expect(blocked.retryAfterSec).toBe(30);
    time += 15_000;
    expect(limiter.check("ip-a").allowed).toBe(false);
    time += 16_000;
    expect(limiter.check("ip-a").allowed).toBe(true);
  });

  it("reset() clears all windows", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("ip-a");
    limiter.check("ip-b");
    limiter.reset();
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-b").allowed).toBe(true);
  });

  it("coerces invalid config to usable bounds", () => {
    const limiter = createRateLimiter({ limit: Number.NaN, windowMs: 0 });
    expect(limiter.check("ip-a").allowed).toBe(true);
  });
});

describe("readRateLimitConfigFromEnv", () => {
  it("defaults to 60 req/min", () => {
    const cfg = readRateLimitConfigFromEnv({});
    expect(cfg.limit).toBe(60);
    expect(cfg.windowMs).toBe(60_000);
  });

  it("reads TRENDIQ_MCP_RATE_LIMIT_PER_MIN when set to a valid number", () => {
    const cfg = readRateLimitConfigFromEnv({ TRENDIQ_MCP_RATE_LIMIT_PER_MIN: "120" });
    expect(cfg.limit).toBe(120);
  });

  it("falls back to the default on garbage or non-positive values", () => {
    expect(readRateLimitConfigFromEnv({ TRENDIQ_MCP_RATE_LIMIT_PER_MIN: "abc" }).limit).toBe(60);
    expect(readRateLimitConfigFromEnv({ TRENDIQ_MCP_RATE_LIMIT_PER_MIN: "0" }).limit).toBe(60);
    expect(readRateLimitConfigFromEnv({ TRENDIQ_MCP_RATE_LIMIT_PER_MIN: "-5" }).limit).toBe(60);
  });
});
