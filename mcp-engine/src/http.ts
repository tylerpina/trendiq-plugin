import { fileURLToPath } from "node:url";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAppStateless } from "./mcp";
import type { TrendiqClient } from "./client";
import { createRateLimiter, readRateLimitConfigFromEnv, type RateLimiterConfig } from "./rate-limit";

const DEFAULT_PORT = 8080;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface HttpAppOptions {
  rateLimit?: Partial<RateLimiterConfig>;
  timeoutMs?: number;
  client?: TrendiqClient;
}

export function readTimeoutMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRENDIQ_MCP_TIMEOUT_MS;
  if (raw !== undefined && raw !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, error: { code, message }, id: id ?? null };
}

export function createHttpApp(options: HttpAppOptions = {}): express.Express {
  const app = express();
  // Railway's edge proxy is exactly one hop in front of this process, so it
  // appends the real client address to X-Forwarded-For. Trusting exactly 1 hop
  // makes req.ip the rightmost XFF entry (edge-appended client IP). Trusting
  // `true` instead would resolve to the leftmost entry, which the client can
  // spoof to rotate rate-limit keys.
  app.set("trust proxy", 1);

  const envLimit = readRateLimitConfigFromEnv();
  const limiterConfig: RateLimiterConfig = {
    limit: options.rateLimit?.limit ?? envLimit.limit,
    windowMs: options.rateLimit?.windowMs ?? envLimit.windowMs,
    now: options.rateLimit?.now,
  };
  const limiter = createRateLimiter(limiterConfig);
  const timeoutMs = options.timeoutMs ?? readTimeoutMsFromEnv();

  const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const decision = limiter.check(req.ip ?? "unknown");
    if (!decision.allowed) {
      res.setHeader("Retry-After", String(decision.retryAfterSec));
      res.status(429).json(jsonRpcError(null, -32000, "Rate limit exceeded; retry later"));
      return;
    }
    next();
  };

  const parseErrorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json(jsonRpcError(null, -32700, "Parse error: request body is not valid JSON"));
      return;
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      (err as { type?: unknown }).type === "entity.too.large"
    ) {
      res.status(413).json(jsonRpcError(null, -32603, "Request body exceeds the size limit"));
      return;
    }
    next(err);
  };

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.all("/mcp", rateLimitMiddleware, (req, res, next) => {
    if (req.method === "POST") {
      express.json({ limit: "1mb" })(req, res, (err?: unknown) => {
        if (err) {
          parseErrorHandler(err, req, res, next);
          return;
        }
        next();
      });
      return;
    }
    res.setHeader("Allow", "POST");
    res.status(405).json(jsonRpcError(null, -32000, `Method ${req.method} not allowed on /mcp`));
  });

  app.post("/mcp", asyncHandleWithTimeout(timeoutMs, async (req, res) => {
    const server: McpServer = createAppStateless(options.client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) {
        const message = e instanceof Error ? e.message : String(e);
        res.status(500).json(jsonRpcError(req.body?.id ?? null, -32603, `Internal server error: ${message}`));
      }
    }
  }));

  return app;
}

/**
 * Bounds a handler to `timeoutMs`. If the handler has not finished when the
 * timer fires and no response has started, respond with a JSON-RPC timeout
 * error so the client never hangs or gets a bare reset.
 */
function asyncHandleWithTimeout(
  timeoutMs: number,
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response) => {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    try {
      const outcome = await Promise.race([handler(req, res), timeoutPromise]);
      if (outcome === "timeout" && !res.headersSent) {
        const body = req.body as { id?: unknown } | undefined;
        res.status(504).json(
          jsonRpcError(body?.id ?? null, -32000, `Request timed out after ${timeoutMs}ms`),
        );
      }
    } catch (e) {
      if (!res.headersSent) {
        const message = e instanceof Error ? e.message : String(e);
        res.status(500).json(jsonRpcError(null, -32603, `Internal server error: ${message}`));
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

async function main(): Promise<void> {
  const app = createHttpApp();
  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  app.listen(port, () => {
    console.error(`trendiq mcp http server listening on :${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
