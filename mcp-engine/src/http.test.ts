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

  it("tools/list returns exactly 20 tools", async () => {
    const app = makeApp();
    const res = await postMcp(app, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.status).toBe(200);
    expect(res.body.result.tools).toHaveLength(20);
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

// Production topology behind Railway: the client connects to Railway's edge
// proxy (one hop). The proxy appends the real client address to any
// X-Forwarded-For chain the client sent, then forwards over a socket whose
// remote address is the edge itself. With `trust proxy` = 1, req.ip resolves
// to the rightmost XFF entry when present, else the socket address.
describe("per-IP rate limiting under trust-proxy=1", () => {
  async function statusOf(app: Express, xff?: string): Promise<number> {
    const req = postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" });
    const res = await (xff === undefined ? req : req.set("X-Forwarded-For", xff));
    return res.status;
  }

  it("requests arriving without a client-set XFF are keyed on the socket address", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app)).not.toBe(429);
    expect(await statusOf(app)).toBe(429);
  });

  it("the 61st request from one client within the window gets 429 while a second client is unaffected", async () => {
    // Single-entry XFF models what the edge appends when the client sent none.
    const app = makeApp({ rateLimit: { limit: 60, windowMs: 60_000 } });
    for (let i = 0; i < 60; i++) {
      expect(await statusOf(app, "10.0.0.1")).not.toBe(429);
    }
    expect(await statusOf(app, "10.0.0.1")).toBe(429);
    expect(await statusOf(app, "10.0.0.2")).not.toBe(429);
  }, 30_000);

  it("a spoofed leftmost XFF never becomes the limiter key: two clients behind one proxy hop share the limit", async () => {
    // Both "clients" sit behind the same upstream proxy hop, so their requests
    // arrive with the same rightmost (edge-appended) address. Each injects a
    // distinct fake leftmost entry hoping to rotate keys. Under trust-proxy=1
    // only the rightmost entry is trusted, so the second request must be
    // blocked even though the fake values differ.
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app, "6.6.6.6, 10.9.9.9")).not.toBe(429);
    expect(await statusOf(app, "7.7.7.7, 10.9.9.9")).toBe(429);
  });

  it("over-limit responses include Retry-After", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusOf(app, "10.0.1.1")).not.toBe(429);
    const res = await postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" }).set(
      "X-Forwarded-For",
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
