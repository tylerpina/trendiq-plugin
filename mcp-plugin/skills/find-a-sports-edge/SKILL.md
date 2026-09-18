---
name: find-a-sports-edge
description: Use when hunting for a priced edge on a specific game or a slate — line shopping across Kalshi and Polymarket after fees, same-game arbitrage, sharp flow and signals on a game.
---

# Find a sports edge

See `../references/domain-primer.md` for the fee math and pro-trader caveats.

## Workflow

1. **Scan the slate.** `mcp__trendiq__list_sports_games` with a `league`, or
   `sort:"edge", limit:20` to rank the whole board by Edge (unpriced games
   sort last). The full slate is ~270 games — always pass one of these, don't
   pull it unfiltered.
2. **Drill the top candidates.** `mcp__trendiq__get_sports_game(slug)` for
   each game worth a closer look. Read `edge` (the cost of buying every side
   at its cheapest venue, after fees — positive means same-game arbitrage),
   `spreads.impliedLine`, and `totals.impliedLine`.
3. **Check what's moving it.** `mcp__trendiq__get_sports_signals(game=slug)`
   for pinned signals and `mcp__trendiq__get_sports_whale_activity(game=slug)`
   for large trades on the game. The whale-activity tool is Premium-gated —
   without that entitlement, skip it rather than treating an error as "no
   activity."
4. **Pull the news context.** `mcp__trendiq__get_news_feed category:"sports"`
   and match articles to the game by team/league chips.
5. **Write the read in the brand voice.** Name the number, say "after fees"
   whenever prices are compared, and never say "guaranteed," "free money," or
   "lock."

## Worked example

`list_sports_games(sort:"edge", limit:20)` puts a game near the top with
`edge.edgeCents = 2.3`. `get_sports_game` shows the away side cheapest on
Kalshi at 41¢ (fee 2¢, cost 43¢) and the home side cheapest on Polymarket at
55¢ (no fee, cost 55¢) — 98¢ total, so buying both sides after fees costs 98¢
against a 100¢ payout, a 2.3% spread after fees, depth not checked.
`get_sports_signals` shows a `whale_cluster` on the home side twenty minutes
earlier; `get_sports_whale_activity` (Premium) confirms two trades over $15k
on the same side. `get_news_feed category:"sports"` has no article on this
game in the last 7 days. The read: "Home side has a 2.3% edge after fees, a
Kalshi buy underneath a Polymarket buy, with sharp flow behind it in the last
20 minutes. No same-game arbitrage margin left once depth and gas are
factored in past the top of book — check the order book before sizing
anything."

## Boundaries

- Depth is not checked — `edge` is a top-of-book number, not a fill guarantee.
- Polymarket gas is excluded from every cost.
- TrendIQ does not execute trades. This is a read, not an order.
