---
name: analyze-a-market
description: Use when asked for a full read or directional view on a single prediction market or ticker (Kalshi or Polymarket) — orchestrates TrendIQ tools into one analysis.
---

# Analyze a market

The front-door playbook. Composes the other TrendIQ tools into a single
directional read on one market. See `../references/domain-primer.md` for the
data caveats referenced below.

## Workflow

1. **Resolve the market.** `mcp__trendiq__search_markets` with the user's
   keywords. Pick the intended market/event; note its `platform` and `id` (for
   Polymarket the sentiment tool needs the `conditionId`).
2. **Pull the snapshot.** `mcp__trendiq__get_market` for details and current
   price (0-1).
3. **Read the trend.** `mcp__trendiq__get_candles` (start at `1h`). Remember
   candle timestamps are SECONDS and volume is two-sided.
4. **Check depth (Kalshi/Poly).** `mcp__trendiq__get_orderbook` for liquidity,
   `mcp__trendiq__get_trades` for recent flow (trade timestamps are MS).
5. **Positioning (Polymarket only).** `mcp__trendiq__get_sentiment` with the
   `conditionId`. Treat 50/50 as "no data." If sentiment diverges from price,
   that is the signal — escalate to `read-market-sentiment-divergence`.
6. **Smart money.** `mcp__trendiq__get_whale_trades` and scan for this market;
   for a notable wallet, escalate to `investigate-a-whale`.
7. **Context.** `mcp__trendiq__get_correlated_markets` to see what moves with it
   (bidirectional Kalshi<->Poly).
8. **Synthesize.** State a directional view with the evidence, and explicitly
   flag what is unknown (null win rates, no-data sentiment, thin liquidity).

> **Robinhood markets:** only steps 1–3 apply (search, details, candles).
> Robinhood has no order book, trades, sentiment, correlation, or whale data —
> skip steps 4–7.

## Don't
- Don't treat a null win rate as 0% or a 50/50 sentiment as "neutral conviction."
- Don't poll faster than the cache TTLs in the primer.
