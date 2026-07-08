---
name: screen-for-opportunities
description: Use when hunting for tradeable prediction markets by liquidity, volume, or time-to-expiry, or building a candidate watchlist.
---

# Screen for opportunities

Kalshi & Polymarket only. See `../references/domain-primer.md`.

## Workflow

1. **Know the categories.** `mcp__trendiq__get_scanner_categories` for valid
   labels.
2. **Narrow.** `mcp__trendiq__screen_markets` with `platform`, a `sortBy`
   (volume / volume24h / liquidity / priceChange / timeRemaining), `sortDirection`,
   `timeRemaining`, and `min*` filters. Keep `limit` MODEST for Kalshi (its scans
   do per-market detail fetches and are slow).
3. **Enrich the top candidates:** `mcp__trendiq__get_sentiment` (Polymarket),
   `mcp__trendiq__get_whale_trades`, `mcp__trendiq__get_candles`.
4. **Hand off.** For a single promising market, switch to `analyze-a-market`; for
   a price gap, to `find-cross-platform-arbitrage`.

## Don't
- Don't request a huge Kalshi `limit` — it is slow. Page or tighten filters.
