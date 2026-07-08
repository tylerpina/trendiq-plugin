# TrendIQ domain primer

Shared facts every TrendIQ skill relies on. Read the relevant items before
interpreting tool output.

- **Prices are 0-1.** Multiply by 100 for a percentage.
- **Timestamps differ by source.** Whale/market *trades* are in MILLISECONDS;
  *candles* are in SECONDS. Never compare them without converting.
- **`winRate: null` != 0%.** Null means unknown / fewer than 3 closed trades.
  Render "unknown", never "0%".
- **Two different pro-trader definitions exist — don't conflate them:**
  - `pro_traders` table / `isProTrader` enrichment: `winRate > 0.75` AND
    `positions >= 10` AND `totalPnl > $10k`.
  - `isProfitableTrader` / cached profitable traders: `winRate >= 0.80` OR
    `totalPnl >= $10k`.
- **Pro flags are lazily backfilled.** Absence of a pro flag means "not yet
  backfilled," NOT "not a pro." `get_whale_trades(proTradersOnly=true)` returns
  `[]` when the table is unpopulated.
- **Redemption bias (B1).** The Polymarket Positions API loses redeemed winners
  (they vanish) while losers linger at $0. TrendIQ's WIN RATE uses the Goldsky
  subgraph (realized PnL) and is safe; the bias only contaminates the
  UNREALIZED-PnL component of total PnL.
- **Win/loss & sample.** Win = `realizedPnl > $1`, loss = `realizedPnl < -$1`,
  regardless of any remaining position (partial-exit bias B2). `winRate` needs
  >= 3 closed trades.
- **Goldsky PNL subgraph (keyless GraphQL).** Cursor-paginate `userPositions`
  by `id_gt` with `first:100`. NEVER use `skip:` or `first:1000` (statement
  timeout). Divide raw amounts by 1e6. Results truncate at `MAX_POSITIONS = 5000`
  for ultra-active wallets.
  Endpoint: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn`
- **Candle volume is two-sided** (YES+NO token IDs), not YES-only. The price
  series is the YES token.
- **Sentiment caveats.** Polymarket only; weights NetFlow 50 / Pro 30 / PnL 10 /
  TVL 10; net-flow is from <= 500 trades AND <= 24h (undercounts busy markets);
  market-makers filtered (balanced YES+NO within 20% dropped); a 50/50 result =
  "no data", not neutral conviction; 3-min cache.
- **`pro_convergence` side flaw.** `side === "BUY"` is hardcoded to YES and
  `"SELL"` to NO — semantically wrong on Polymarket (you can buy the NO token).
  Treat the inferred side as unreliable; its winRate/pnl detail are placeholders.
- **Arbitrage fees.** Kalshi `ceil(0.07 * P * (1 - P))` per side (NOT flat);
  Polymarket zero trading fee + ~$0.01 Polygon gas. Positive `profitMargin =
  1 - feeAdjustedCost` is real arb. Trust the API's category list, not stale
  inline comments.
- **Scanner cost.** Kalshi `screen_markets` does N per-market detail fetches —
  slow at high `limit`. Keep `limit` modest for Kalshi.
- **Two API error shapes** (`{message,code,status}` and `{error,message?}`) are
  normalized by the MCP client into one envelope; tool errors read
  `TrendIQ API error (<status> <code?>): <message>`.
- **Cache TTLs** — don't poll faster than: whale 5s, orderbook 5s, candles 60s,
  search 2min, markets 5min, sentiment 3min.
- **Robinhood** supports only `search_markets` / `get_market` / `get_candles`
  (derived data); it has NO orderbook/trades/sentiment/correlated/scanner.
- **Feature-gate note.** TrendIQ currently runs with the subscription gate OFF,
  so full detail (including full signal detail) is returned without auth — a
  deliberate toggle that could change; don't hard-depend on it.
