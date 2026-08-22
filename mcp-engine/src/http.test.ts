import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createHttpApp } from "./http";
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

describe("per-IP rate limiting", () => {
  async function statusAsIp(app: Express, ip: string): Promise<number> {
    const res = await postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" }).set(
      "X-Forwarded-For",
      ip,
    );
    return res.status;
  }

  it("the 61st request from one IP within the window gets 429 while a second IP is unaffected", async () => {
    const app = makeApp({ rateLimit: { limit: 60, windowMs: 60_000 } });
    for (let i = 0; i < 60; i++) {
      expect(await statusAsIp(app, "10.0.0.1")).not.toBe(429);
    }
    expect(await statusAsIp(app, "10.0.0.1")).toBe(429);
    expect(await statusAsIp(app, "10.0.0.2")).not.toBe(429);
  }, 30_000);

  it("over-limit responses include Retry-After", async () => {
    const app = makeApp({ rateLimit: { limit: 1, windowMs: 60_000 } });
    expect(await statusAsIp(app, "10.0.1.1")).not.toBe(429);
    const res = await postMcp(app, { jsonrpc: "2.0", id: 1, method: "ping" }).set(
      "X-Forwarded-For",
      "10.0.1.1",
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });
});

afterEach(() => {
  mcpMockState.failConstruction = false;
});
