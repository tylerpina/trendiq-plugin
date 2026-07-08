# TrendIQ plugin for Claude Code

Make a Claude agent a **prediction-market analyst**. This plugin exposes
[TrendIQ](https://trendiq.pro)'s analytics over Kalshi and Polymarket as
**read-only MCP tools**, plus **skills** that teach an agent how to combine them
into real analysis — whale-wallet forensics, cross-platform arbitrage, sentiment
divergence, real-time signals, and custom-indicator authoring.

It's a thin client over TrendIQ's public API (`https://trendiq.pro/api`), so it
needs **no credentials** and runs as a local stdio server.

## Install

Requires [Claude Code](https://claude.com/claude-code) and Node.js 20+.

```bash
claude plugin marketplace add tylerpina/trendiq-plugin
claude plugin install trendiq@trendiq
```

Then start a new Claude Code session — the `mcp__trendiq__*` tools and the
skills load automatically.

### Configuration (optional)

The server defaults to the hosted API. To point at a local dev server, set the
env var in the plugin's `.mcp.json` or your MCP config:

```
TRENDIQ_API_BASE_URL=http://localhost:3001/api
```

## What's inside

**20 read-only tools** (`mcp__trendiq__*`):

- **Market data** — `search_markets`, `list_markets`, `get_market`,
  `get_candles`, `get_orderbook`, `get_trades`, `get_correlated_markets`
- **Whale Watch** — `get_whale_trades`, `get_whale_profile`,
  `get_whale_leaderboard`, `get_whale_stats`
- **Screener** — `screen_markets`, `get_scanner_categories`
- **Arbitrage** — `scan_arbitrage`, `scan_arbitrage_pair`,
  `list_arbitrage_pairs`, `get_arbitrage_config`
- **Sentiment / Signals** — `get_sentiment`, `get_signals`
- **Utility** — `health`

**7 analyst skills:**

- `analyze-a-market` — full directional read on a single market
- `investigate-a-whale` — verify a wallet's win rate (redemption-bias aware)
- `find-cross-platform-arbitrage` — fee-adjusted Kalshi↔Polymarket arb
- `read-market-sentiment-divergence` — positioning vs. price
- `screen-for-opportunities` — filter/sort tradeable markets
- `interpret-signals` — react to volume spikes / whale clusters / pro convergence
- `create-indicator` — author any valid TrendIQ custom-indicator formula

## Notes

- **Read-only.** No trades, no writes, no account state — analytics only.
- **No credentials.** All data comes from TrendIQ's public API.
- Not affiliated with Kalshi or Polymarket. Data is provided as-is; not financial
  advice.

## Uninstall

```bash
claude plugin uninstall trendiq
claude plugin marketplace remove trendiq
```
