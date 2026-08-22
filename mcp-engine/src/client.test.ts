import { describe, it, expect } from "vitest";
import { buildUrl, normalizeError, TrendiqClient } from "./client";

describe("buildUrl", () => {
  it("joins base + path and skips empty params", () => {
    expect(
      buildUrl("https://trendiq.pro/api", "/markets/search", { q: "btc", platform: undefined, limit: 20 }),
    ).toBe("https://trendiq.pro/api/markets/search?q=btc&limit=20");
  });
  it("strips trailing slashes on base", () => {
    expect(buildUrl("https://x/api/", "/health")).toBe("https://x/api/health");
  });
  it("stringifies booleans", () => {
    expect(buildUrl("https://x/api", "/m", { unified: false })).toBe("https://x/api/m?unified=false");
  });
});

describe("normalizeError", () => {
  it("shape A {message,code,status}", () => {
    expect(normalizeError(404, { message: "Not found", code: "NOT_FOUND", status: 404 })).toEqual({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
  it("shape B {error}", () => {
    expect(normalizeError(500, { error: "boom" })).toEqual({ ok: false, status: 500, message: "boom" });
  });
  it("appends availablePairs recovery hint", () => {
    const r = normalizeError(404, { error: "unknown pair", availablePairs: ["a", "b"] });
    expect(r.message).toContain("available pairs: a, b");
  });
  it("falls back to HTTP <status> for non-object bodies", () => {
    expect(normalizeError(502, "<html>")).toEqual({ ok: false, status: 502, message: "HTTP 502" });
  });
});

describe("TrendiqClient.get", () => {
  const fakeFetch = (status: number, payload: unknown) => async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  });

  it("returns ok+data on 200", async () => {
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: fakeFetch(200, { hello: 1 }) as any });
    expect(await c.get("/health")).toEqual({ ok: true, status: 200, data: { hello: 1 } });
  });
  it("normalizes a 404 error body", async () => {
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: fakeFetch(404, { error: "nope" }) as any });
    expect(await c.get("/whales/0xabc")).toMatchObject({ ok: false, status: 404, message: "nope" });
  });
  it("returns a status-0 error when the request times out", async () => {
    const hangingFetch: any = (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: hangingFetch, timeoutMs: 5 });
    const r = await c.get("/health");
    expect(r).toMatchObject({ ok: false, status: 0 });
  });

  it("sends Authorization header on every call when a bearer token is set", async () => {
    const inits: Array<{ headers?: Record<string, string> } | undefined> = [];
    const spyFetch = (async (_url: string, init?: any) => {
      inits.push(init);
      return fakeFetch(200, {})();
    }) as any;
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: spyFetch, bearerToken: "tok-1" });
    await c.get("/a");
    await c.get("/b", { x: 1 });
    expect(inits).toHaveLength(2);
    for (const init of inits) {
      expect(init?.headers?.Authorization).toBe("Bearer tok-1");
    }
  });

  it("sends no Authorization header when no bearer token is set", async () => {
    let seen: any;
    const spyFetch = (async (_url: string, init?: any) => {
      seen = init;
      return fakeFetch(200, {})();
    }) as any;
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: spyFetch });
    await c.get("/health");
    expect(seen?.headers?.Authorization).toBeUndefined();
  });

  it("treats an empty bearer token as absent", async () => {
    let seen: any;
    const spyFetch = (async (_url: string, init?: any) => {
      seen = init;
      return fakeFetch(200, {})();
    }) as any;
    const c = new TrendiqClient("https://trendiq.pro/api", { fetchImpl: spyFetch, bearerToken: "" });
    await c.get("/health");
    expect(seen?.headers?.Authorization).toBeUndefined();
  });
});
