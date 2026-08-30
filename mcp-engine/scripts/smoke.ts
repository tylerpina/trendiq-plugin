import { TrendiqClient } from "../src/client";
import { allTools } from "../src/tools/index";

const BASE = process.env.TRENDIQ_API_BASE_URL ?? "https://trendiq.pro/api";
// Default client (20 s timeout) for most calls.
const client = new TrendiqClient(BASE);
// Sentiment is expensive (3-min server cache, multiple Polymarket sub-calls); give it 60 s.
const slowClient = new TrendiqClient(BASE, { timeoutMs: 60_000 });

const byName = Object.fromEntries(allTools.map((t) => [t.name, t]));

async function run(name: string, args: Record<string, any> = {}, opts: { slow?: boolean } = {}) {
  const def = byName[name];
  if (!def) throw new Error(`unknown tool ${name}`);
  const { path, query } = def.toReq(args);
  const c = opts.slow ? slowClient : client;
  const r = await c.get(path, query);
  const tag = r.ok ? `OK  ${r.status}` : `ERR ${r.status} ${r.message}`;
  const preview = r.ok ? JSON.stringify(r.data).slice(0, 120) : "";
  console.log(`${name.padEnd(28)} ${tag}  ${preview}`);
  return r;
}

function dig(obj: any, ...paths: string[][]): any {
  for (const p of paths) {
    let v = obj;
    for (const k of p) v = v?.[k];
    if (v != null) return v;
  }
  return undefined;
}

async function main() {
  console.log(`# smoke against ${BASE}\n`);
  await run("health");

  // search_markets (flat, no unified param) → { markets: [{id, platform, ...}] }
  const search = await run("search_markets", { q: "bitcoin", limit: 5 });

  await run("get_scanner_categories");

  // list_markets — uses /markets endpoint
  await run("list_markets", { platform: "polymarket", limit: 3 });

  // screen_markets → { markets: [{id: "0x...", ...}] }
  const screen = await run("screen_markets", { platform: "polymarket", limit: 5 });

  // Pick a polymarket conditionId from screener; fall back to search results
  const polyId =
    dig(screen.ok ? screen.data : undefined, ["markets", "0", "id"]) ??
    dig(search.ok ? search.data : undefined, ["markets", "0", "id"]);

  console.log("polyId:", polyId);
  if (polyId) {
    await run("get_market", { platform: "polymarket", id: polyId });
    await run("get_candles", { platform: "polymarket", id: polyId, resolution: "1h", limit: 10 });
    await run("get_orderbook", { platform: "polymarket", id: polyId });
    await run("get_trades", { platform: "polymarket", id: polyId, limit: 5 });
    await run("get_correlated_markets", { platform: "polymarket", id: polyId, limit: 3 });
    // get_sentiment is slow (upstream Polymarket sub-calls); use 60 s timeout
    await run("get_sentiment", { id: polyId }, { slow: true });
  }

  // get_whale_trades → { trades: [{walletAddress: "0x...", ...}] }
  const whales = await run("get_whale_trades", { pageSize: 5 });
  await run("get_whale_leaderboard");
  await run("get_whale_stats");

  // walletAddress is the correct field name (not wallet / proxyWallet / trader)
  const wallet = dig(whales.ok ? whales.data : undefined, ["trades", "0", "walletAddress"]);
  console.log("wallet:", wallet);
  if (wallet) await run("get_whale_profile", { wallet });

  // list_arbitrage_pairs → { pairs: [{id: "...", ...}] }
  const pairs = await run("list_arbitrage_pairs");
  await run("get_arbitrage_config");
  const pairId = dig(pairs.ok ? pairs.data : undefined, ["pairs", "0", "id"]);
  console.log("pairId:", pairId);
  if (pairId) await run("scan_arbitrage_pair", { pairId });
  await run("scan_arbitrage", { minProfitPct: 0.1 });

  await run("get_signals", { limit: 10 });

  // ── News (Polymarket only; 7-day window) ────────────────────────────────────
  // get_news_feed → { articles: [{..., markets: [...]}], nextCursor, windowDays }
  const feed = await run("get_news_feed", { limit: 3 });
  const newsMarketId = dig(feed.ok ? feed.data : undefined, ["articles", "0", "markets", "0", "id"]);
  console.log("newsMarketId:", newsMarketId);
  if (newsMarketId) await run("get_market_news", { id: newsMarketId });
  await run("get_news_feed", { category: "politics", limit: 2 });

  // ── Screener enum probe ──────────────────────────────────────────────────────
  // The API silently accepts any string for sortBy / timeRemaining and falls back
  // to defaults for unknown values — all calls return 200 regardless.
  // Confirmed-OK sortBy: volume, volume24h, liquidity, priceChange, timeRemaining
  // (NOT "price" or "expiration" — those silently fall through to volume24h)
  // Confirmed-OK timeRemaining: all, 1d, 1w, 1m, 3m, 6m, 1y
  // (NOT "gt1m" — treated as "all")
  console.log("\n# screener sortBy enum probe");
  for (const sortBy of ["volume", "volume24h", "liquidity", "priceChange", "timeRemaining", "price", "expiration"]) {
    await run("screen_markets", { platform: "polymarket", sortBy, limit: 3 });
  }

  console.log("\n# screener timeRemaining enum probe");
  for (const timeRemaining of ["all", "1d", "1w", "1m", "3m", "6m", "1y", "gt1m"]) {
    await run("screen_markets", { platform: "polymarket", timeRemaining, limit: 3 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
