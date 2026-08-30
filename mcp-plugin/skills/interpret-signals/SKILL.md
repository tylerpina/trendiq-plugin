---
name: interpret-signals
description: Use when monitoring real-time market activity, reacting to volume spikes / whale clusters / pro convergence, or building a market-watch loop on TrendIQ.
---

# Interpret signals

See `../references/domain-primer.md`.

## Workflow

1. **Confirm the feed is live.** `mcp__trendiq__get_whale_stats` — if `isPolling`
   is false or `recentTradesCount` is 0, an empty signal feed is a data gap, not
   a quiet market.
2. **Read signals.** `mcp__trendiq__get_signals` (filter by `type` and/or
   `platform`; page backward with `cursor`).
3. **Interpret by type:**
   - `volume_spike`, `price_movement` — Kalshi + Polymarket.
   - `whale_cluster`, `pro_convergence` — Polymarket only.
   - For `pro_convergence`, the inferred BUY->YES side is UNRELIABLE and its
     winRate/pnl detail are placeholders — do not report them as fact.
4. **Pair the tape with news (Polymarket).** `mcp__trendiq__get_news_feed`
   (filter by `category`, page with `cursor`) surfaces fresh articles with their
   linked markets ranked by link strength — a signal plus a same-day article on
   the same market is a much stronger read than either alone. For one market's
   full news context, `mcp__trendiq__get_market_news(conditionId)`.
5. **Escalate.** On a high-severity `whale_cluster`, take the named wallets into
   `investigate-a-whale`; on a `volume_spike`/`price_movement`, into
   `analyze-a-market`.
