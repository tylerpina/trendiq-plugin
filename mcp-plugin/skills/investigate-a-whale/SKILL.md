---
name: investigate-a-whale
description: Use when asked to analyze a Polymarket wallet, verify or dispute a trader's win rate, or explain why a trader looks good or bad.
---

# Investigate a whale

Highest-value playbook. Win rates are easy to misread — this is how to get them
right. See `../references/domain-primer.md` for the bias catalog.

## Workflow

1. **Resolve identity.** If given `@username`, scrape `https://polymarket.com/@<user>`
   with a browser User-Agent and extract `proxyWallet`. The display name is NOT
   stored in TrendIQ, so you cannot recover it from the profile — scraping is the
   only path. If given a `0x...` address, proceed.
2. **Canonical stats.** `mcp__trendiq__get_whale_profile(wallet)`. This is the
   win-rate authority.
3. **Read it correctly:**
   - `winRate: null` = unknown (< 3 closed trades). Say "unknown," never 0%.
   - Win rate is redemption-bias-safe; only the unrealized-PnL part of total PnL
     touches the biased Positions API.
   - Apply BOTH pro-trader definitions from the primer; don't assume one number.
   - A missing pro flag may just mean "not yet backfilled."
4. **Recent behavior.** `mcp__trendiq__get_whale_trades` with `proTradersOnly:
   true` and look for this wallet's activity / clustering.
5. **Dispute path (only when the number is challenged).** Query the keyless
   Goldsky PNL subgraph directly (see primer): cursor-paginate `userPositions`
   by `id_gt`, `first:100`, never `skip:`/`first:1000`; `/1e6`; classify win
   `realizedPnl > $1`, loss `< -$1`; require >= 3 closed trades; mind the 5000
   cap.
6. **Report in layers:** raw subgraph -> what TrendIQ shows -> any divergence ->
   which layer owns the discrepancy.
