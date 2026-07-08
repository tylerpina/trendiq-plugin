---
name: find-cross-platform-arbitrage
description: Use when looking for arbitrage between Kalshi and Polymarket, or to judge whether a cross-platform price gap is real profit after fees.
---

# Find cross-platform arbitrage

See `../references/domain-primer.md` for the fee math.

## Workflow

1. **Get live costs.** `mcp__trendiq__get_arbitrage_config` (current gas, fees,
   strategies).
2. **Scan.** `mcp__trendiq__scan_arbitrage` (optionally a `category` and a
   `minProfitPct`). Expensive — don't poll.
3. **Confirm each candidate.** `mcp__trendiq__scan_arbitrage_pair(pairId)`. If a
   `pairId` is wrong, the error lists valid ids — or call
   `mcp__trendiq__list_arbitrage_pairs` first.
4. **Reality-check fees.** Kalshi fee is `ceil(0.07 * P * (1 - P))` per side (NOT
   flat); Polymarket is zero fee + ~$0.01 gas. Real arb only when the
   fee-adjusted combined cost < $1.00 (`profitMargin > 0`).
5. **Check executability.** `mcp__trendiq__get_orderbook` on both legs — a gap
   with no depth is not executable. Note that opportunities can vanish fast.

## Don't
- Don't report a raw price gap as profit without subtracting the per-side Kalshi
  fee and confirming depth.
