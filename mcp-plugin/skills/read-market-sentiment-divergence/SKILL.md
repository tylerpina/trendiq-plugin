---
name: read-market-sentiment-divergence
description: Use when gauging which way smart money leans on a Polymarket market, or when price seems to disagree with trader positioning.
---

# Read market sentiment divergence

Polymarket only. See `../references/domain-primer.md` for sentiment caveats.

## Workflow

1. **Get the market + price.** `mcp__trendiq__get_market` (need the `conditionId`
   and the current YES price, 0-1).
2. **Get positioning.** `mcp__trendiq__get_sentiment(conditionId)`. Weights:
   NetFlow 50 / Pro 30 / PnL 10 / TVL 10.
3. **Compare.** Divergence = positioning (yesScore/noScore) leans one way while
   PRICE sits elsewhere. That gap is the signal; agreement is confirmation.
4. **Qualify it.** A 50/50 score is "no data," not conviction. Net-flow is from
   <= 500 trades AND <= 24h, so it undercounts busy markets; market-makers are
   filtered out. Expensive (3-min cache) — read once, don't poll.
5. **Corroborate.** Optionally `mcp__trendiq__get_whale_trades` for this market
   and escalate notable wallets to `investigate-a-whale`;
   `mcp__trendiq__get_market_news(conditionId)` often supplies the catalyst that
   explains which side of the divergence is right.
