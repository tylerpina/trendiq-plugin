export interface RateLimiterConfig {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  reset(): void;
}

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * In-memory fixed-window per-key limiter. Each key gets `limit` requests per
 * `windowMs`; a new window starts exactly `windowMs` after the current one
 * began, restoring full allowance. The clock is injectable for tests.
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const floorLimit = Math.floor(config.limit);
  const limit = Number.isFinite(floorLimit) && floorLimit >= 1 ? floorLimit : 1;
  const windowMs = Math.max(1, config.windowMs);
  const now = config.now ?? (() => Date.now());
  const windows = new Map<string, { count: number; windowStart: number }>();

  return {
    check(key: string): RateLimitDecision {
      const t = now();
      let entry = windows.get(key);
      if (!entry || t - entry.windowStart >= windowMs) {
        entry = { count: 0, windowStart: t };
        windows.set(key, entry);
      }
      if (entry.count < limit) {
        entry.count += 1;
        return {
          allowed: true,
          remaining: limit - entry.count,
          retryAfterSec: Math.ceil((entry.windowStart + windowMs - t) / 1000),
        };
      }
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((entry.windowStart + windowMs - t) / 1000)),
      };
    },
    reset(): void {
      windows.clear();
    },
  };
}

export function readRateLimitConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RateLimiterConfig {
  const raw = env.TRENDIQ_MCP_RATE_LIMIT_PER_MIN;
  let limit = DEFAULT_LIMIT;
  if (raw !== undefined && raw !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
  }
  return { limit, windowMs: DEFAULT_WINDOW_MS };
}
