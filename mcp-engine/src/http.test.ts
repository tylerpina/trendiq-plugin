import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createHttpApp, readTimeoutMsFromEnv } from "./http";
import { TrendiqClient, type FetchLike } from "./client";

const mcpMockState = vi.hoisted(() => ({ failConstruction: false }));

vi.mock("./mcp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mcp")>();
  return {
    ...actual,
    createAppStateless: (client?: Parameters<typeof actual.createAppStateless>[0]) => {
      if (mcpMockState.failConstruction) throw new Error("boom during construction");
      return actual.createAppStateless(client);
    },
  };
});

const okFetch: FetchLike = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ status: "healthy" }),
});

function makeApp(opts: Parameters<typeof createHttpApp>[0] = {}): Express {
  const client =
    opts.client ?? new TrendiqClient("https://unused.test/api", { fetchImpl: okFetch });
  return createHttpApp({ ...opts, client });
}

// The Streamable HTTP transport rejects requests whose Accept header does not
// include both application/json and text/event-stream.
function postMcp(app: Express, body: unknown) {
  const req = request(app)
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json");
  return typeof body === "string" ? req.send(body) : req.send(JSON.stringify(body));
}

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.0.1" },
  },
};

describe("POST /mcp", () => {
  it("initialize handshake returns trendiq server info", async () => {
    const app = makeApp();
    const res = await postMcp(app, INIT);
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.result.serverInfo.name).toBe("trendiq");
    expect(res.body.result.protocolVersion).toBe("2025-06-18");
  });

  it("tools/list returns exactly 26 tools", async () => {
    const app = makeApp();
    const res = await postMcp(app, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.status).toBe(200);
    expect(res.body.result.tools).toHaveLength(26);
  });

  it("tools/call health succeeds via injected client", async () => {
    const app = makeApp();
    const res = await postMcp(app, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "health", arguments: {} },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBeFalsy();
    const parsed = JSON.parse(res.body.result.content[0].text);
    expect(parsed.status).toBe("healthy");
  });

  it("malformed JSON body yields a parse error, not a crash", async () => {
    const app = makeApp();
    const res = await postMcp(app, '{"jsonrpc":"2.0","id":4,"method":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32700);
  });

  it("a constructor failure surfaces as a JSON-RPC internal error, not a hang", async () => {
    mcpMockState.failConstruction = true;
    try {
      const app = makeApp();
      const res = await postMcp(app, { jsonrpc: "2.0", id: 9, method: "ping" });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe(-32603);
      expect(res.body.error.message).toContain("boom during construction");
    } finally {
      mcpMockState.failConstruction = false;
    }
  });

  it("upstream on a dead port yields a bounded JSON-RPC error response", async () => {
    const client = new TrendiqClient("http://127.0.0.1:1/api", { timeoutMs: 1500 });
    const app = makeApp({ client });
    const res = await postMcp(app, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "health", arguments: {} },
    });
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/TrendIQ API error|Request failed/);
  }, 10_000);

  it("a hung upstream is cut off by the injected request timeout", async () => {
    const neverFetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const client = new TrendiqClient("https://hung.test/api", {
      fetchImpl: neverFetch,
      timeoutMs: 60_000,
    });
    const app = makeApp({ client, timeoutMs: 150 });
    const res = await postMcp(app, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "health", arguments: {} },
    });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe(-32000);
    expect(res.body.error.message).toContain("timed out");
  }, 10_000);
});

describe("method and route policy", () => {
  it("GET /mcp returns 405", async () => {
    const res = await request(makeApp()).get("/mcp");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("DELETE /mcp returns 405", async () => {
    const res = await request(makeApp()).delete("/mcp");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("GET /healthz returns 200 { ok: true }", async () => {
    const res = await request(makeApp()).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// Rate-limit keying, in precedence order: X-Real-IP (set by Railway's edge,
// not the client) > req.ip (rightmost XFF under trust-proxy=1, or socket
// address locally) > "unknown".
//
// HONESTY NOTE: these local tests can only prove the middleware's PRECEDENCE
// rules. The claim that makes X-Real-IP trustworthy — that Railway's edge
// overwrites it so a client cannot spoof it — is NOT testable here; it was
// verified empirically against the live post-deploy environment (65 rotating-
// XFF POSTs → zero 429s before this fix). See the comment block in http.ts.
describe("per-IP rate limiting keyed on edge-set X-Real-IP", () => {
  async function statusOf(
    app: Express,
    opts: { xff?: string; realIp?: string } = {},
  ): Promise<number> {
    let req = postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" });
    if (opts.xff !== undefined) req = req.set("X-Forwarded-For", opts.xff);
    if (opts.realIp !== undefined) req = req.set("X-Real-IP", opts.realIp);
    return (await req).status;
  }

  it("requests arriving without X-Real-IP fall back to req.ip (socket address here)", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app)).not.toBe(429);
    expect(await statusOf(app)).toBe(429);
  });

  it("requests with X-Real-IP are keyed on it: 61st from one X-Real-IP gets 429 despite rotating XFF values", async () => {
    // Each request carries a different fake X-Forwarded-For — the exact
    // rotation that bypassed the old limiter behind Railway — but shares one
    // X-Real-IP, so all 61 land in the same bucket.
    const app = makeApp({ rateLimit: { limit: 60, windowMs: 60_000 } });
    for (let i = 0; i < 60; i++) {
      expect(await statusOf(app, { xff: `6.6.${i}.${i}`, realIp: "203.0.113.7" })).not.toBe(429);
    }
    expect(await statusOf(app, { xff: "6.6.99.99", realIp: "203.0.113.7" })).toBe(429);
  }, 30_000);

  it("two different X-Real-IP values get independent buckets even with identical XFF", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app, { xff: "10.9.9.9", realIp: "203.0.113.1" })).not.toBe(429);
    expect(await statusOf(app, { xff: "10.9.9.9", realIp: "203.0.113.2" })).not.toBe(429);
    expect(await statusOf(app, { xff: "10.9.9.9", realIp: "203.0.113.1" })).toBe(429);
    expect(await statusOf(app, { xff: "10.9.9.9", realIp: "203.0.113.2" })).toBe(429);
  });

  it("when present, X-Real-IP takes precedence over both client-supplied XFF and the socket address", async () => {
    // Same X-Real-IP, different spoofed XFF chains AND a fresh socket each
    // time: still one bucket. This replaces the old "spoofed leftmost XFF"
    // assertion — the mechanism now is X-Real-IP precedence, since without an
    // edge overwriting headers, a rightmost client-supplied XFF entry would
    // resolve as req.ip under trust-proxy=1.
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app, { xff: "6.6.6.6, 10.9.9.9", realIp: "198.51.100.5" })).not.toBe(429);
    expect(await statusOf(app, { xff: "7.7.7.7, 10.8.8.8", realIp: "198.51.100.5" })).toBe(429);
  });

  it("over-limit responses include Retry-After", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app, { realIp: "10.0.1.1" })).not.toBe(429);
    const res = await postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" }).set(
      "X-Real-IP",
      "10.0.1.1",
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("readTimeoutMsFromEnv", () => {
  it("defaults to 30000ms when unset", () => {
    expect(readTimeoutMsFromEnv({})).toBe(30_000);
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "" })).toBe(30_000);
  });

  it("reads TRENDIQ_MCP_TIMEOUT_MS when set to a valid positive number", () => {
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "45000" })).toBe(45_000);
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "1500" })).toBe(1_500);
  });

  it("falls back to the default on garbage or non-positive values", () => {
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "abc" })).toBe(30_000);
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "0" })).toBe(30_000);
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "-5" })).toBe(30_000);
    expect(readTimeoutMsFromEnv({ TRENDIQ_MCP_TIMEOUT_MS: "Infinity" })).toBe(30_000);
  });
});

describe("oversized request bodies", () => {
  it("return a JSON-RPC -32603 body with status 413, not Express HTML", async () => {
    const app = makeApp();
    const big = "x".repeat(1024 * 1024 + 1024);
    const res = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", padding: big }));
    expect(res.status).toBe(413);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.error.code).toBe(-32603);
    expect(res.text).not.toMatch(/<html/i);
  });
});

afterEach(() => {
  mcpMockState.failConstruction = false;
});

// The news tools were added after the limiter shipped; this pins the guarantee
// that they sit behind the same /mcp rate limit as every other tool — a
// tools/call to a news tool from an over-limit key gets 429 before any
// upstream request happens.
describe("news tools are behind the /mcp rate limiter", () => {
  it("get_news_feed tools/call from an over-limit X-Real-IP gets 429, not an upstream call", async () => {
    let upstreamCalls = 0;
    const countingFetch: FetchLike = async () => {
      upstreamCalls += 1;
      return { ok: true, status: 200, text: async () => JSON.stringify({ articles: [], nextCursor: null, windowDays: 7 }) };
    };
    const client = new TrendiqClient("https://unused.test/api", { fetchImpl: countingFetch });
    const app = createHttpApp({ client, rateLimit: { limit: 1, windowMs: 60_000 } });
    const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_news_feed", arguments: { limit: 5 } } };

    const first = await postMcp(app, call).set("X-Real-IP", "203.0.113.9");
    expect(first.status).toBe(200);
    expect(first.body.result.isError).toBeFalsy();
    expect(upstreamCalls).toBe(1);

    const second = await postMcp(app, call).set("X-Real-IP", "203.0.113.9");
    expect(second.status).toBe(429);
    expect(second.headers["retry-after"]).toBeDefined();
    expect(upstreamCalls).toBe(1);
  });
});
