---
name: create-indicator
description: Use when the user wants to build, design, or express a trading idea as a custom TrendIQ indicator — moving averages, whale/sentiment/order-book flow, crossovers, RSI/MACD, cross-market ratios, or any formula-based signal.
---

# Create a custom TrendIQ indicator

Turn a user's trading idea into a **valid, working** TrendIQ indicator formula.
The full grammar is in `../references/indicator-formula-language.md` — read it
before writing anything non-trivial. Platform data availability and the 0–1
price convention are in `../references/domain-primer.md`.

## How this reaches TrendIQ (be honest up front)

The plugin's MCP tools are **read-only** and TrendIQ's formula engine runs in the
**browser** — so you author the formula, the user runs it:

1. You produce the exact formula text (below).
2. The user opens the market's chart in TrendIQ → **Indicators → Custom → New**,
   pastes the formula, and saves. (Shared indicators can be brought in via
   **Import** with a share code.)

You cannot create, persist, or backtest the indicator through the MCP — don't
claim a result you can't observe. You can, however, use the read-only tools
(`get_candles`, `get_sentiment`, `get_whale_trades`) to sanity-check that the
inputs your formula relies on actually have signal on the target market.

## Workflow

1. **Clarify the idea and the market.** What is the user trying to see (trend,
   momentum, smart-money accumulation, divergence, cross-market spread)? On which
   **platform**? This gates the data you can use.
2. **Map the idea to inputs — and check availability.** OHLCV works everywhere.
   `whale_*`, `pro_*`, `sentiment_*`, and volume-flow fields are **Polymarket
   only** (zeros on Kalshi/Robinhood); order book is Poly+Kalshi. If the user is
   on Kalshi/Robinhood but wants whale flow, say so and either switch market or
   make the formula portable with `IF(whale_volume > 0, ..., price_fallback)`.
3. **Construct the formula.** Assignments build intermediate series; `PLOT` /
   `HLINE` draw the result. Keep prices in mind (0–1). Prefer readable
   intermediate variables over one giant expression.
4. **Self-validate against the rules** (the top offenders):
   - Functions are **UPPERCASE**; variables lowercase; statements are one line.
   - Exact arities: `SMA/EMA/STDEV/RSI/ROC/MOM(series, period)`, `MACD` needs
     **4** args, `BB` needs **3** (both ignore the last), `VWAP()` takes **none**.
   - **Avoid `ATR`** (returns zeros) — use `STDEV` or a manual true-range.
   - `HLINE`'s first arg must be a **literal number**.
   - `FILL`/`MARKER`/`BGCOLOR` are **not rendered** — plot a 0/1 signal series
     instead.
   - ≤ **5** cross-market refs (`CLOSE("platform:id")`, etc.), ≤ **5000** chars.
   - Division by zero is safe (→ 0), but guard intent with `MAX(x, 0.01)` when a
     ratio should stay finite.
5. **Hand off.** Give the formula in a code block, a one-line explanation of what
   each output means, the paste path (step above), and a note on rendering: RSI
   and other 0–100 series draw in a **separate pane**; 0–1 series overlay price.

## Quick cheat sheet

- **Inputs:** `open high low close volume` (all); `whale_net_flow whale_buy_volume
  whale_sell_volume pro_trader_count sentiment_yes sentiment_no yes_net_flow
  bid_depth ask_depth spread …` (Polymarket; order book also Kalshi).
- **Functions:** `SMA EMA VWAP() STDEV RSI MACD(…,4args) BB(…,3args) ROC MOM
  CROSSOVER CROSSUNDER RISING FALLING ABS MAX MIN AVG SUM LOG SQRT IF AND OR NOT`.
- **Outputs:** `PLOT(series,"label","#color")`, `HLINE(literal,"label","#color")`.
- **Operators:** `+ - * / %`, `> < >= <= == !=`, `and or not`.

## Worked examples

Simple trend line:

```text
ma20 = SMA(close, 20)
PLOT(ma20, "SMA 20", "#60a5fa")
HLINE(0.5, "Midpoint", "#6b7280")
```

Smart-money accumulation (Polymarket):

```text
flow = EMA(whale_net_flow, 5)
PLOT(flow, "Whale Net Flow", "#22c55e")
HLINE(0, "Neutral", "#6b7280")
```

EMA crossover as a plotted signal:

```text
fast = EMA(close, 9)
slow = EMA(close, 21)
PLOT(fast, "Fast EMA", "#22d3ee")
PLOT(slow, "Slow EMA", "#f59e0b")
PLOT(CROSSOVER(fast, slow), "Bull Cross", "#22c55e")
```

Real Bollinger Bands (since `BB()` returns only the middle band):

```text
mid = SMA(close, 20)
sd  = STDEV(close, 20)
PLOT(mid, "BB Mid", "#a78bfa")
PLOT(mid + 2 * sd, "BB Upper", "#ef4444")
PLOT(mid - 2 * sd, "BB Lower", "#22c55e")
```

Platform-portable signal (whale flow on Polymarket, price trend elsewhere):

```text
sig = IF(whale_volume > 0, EMA(whale_net_flow, 5), close - SMA(close, 20))
PLOT(sig, "Adaptive Signal", "#60a5fa")
```

For anything beyond these — the full variable list, every function signature,
cross-market syntax, and the validation rules — use
`../references/indicator-formula-language.md`.
