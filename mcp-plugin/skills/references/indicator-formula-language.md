# TrendIQ custom-indicator formula language — complete reference

The authoritative grammar for TrendIQ's client-side indicator engine. Every rule
here was verified by running formulas through the real engine
(`src/client/components/indicators/formula/`). Use it to author formulas that
actually compile and run — not just ones that look plausible.

## Program structure

- A formula is one or more **newline-separated statements**. No semicolons.
- Two statement forms:
  - **Assignment:** `name = expression` — stores a series for reuse.
  - **Output:** `PLOT(...)` / `HLINE(...)` — declares what gets drawn. A formula
    must have **at least one output** to show anything.
- Comments start with `//` and run to end of line. Blank lines are ignored.
- **Statements are single-line** — an expression cannot span newlines.
- **Everything is a series** (`number[]`) aligned to the chart's candle axis;
  index `i` is bar `i`. Number literals are broadcast to the series length.
- **Prices are on a 0–1 scale** (multiply by 100 for %). See
  `./domain-primer.md`.

## Data variables (the input namespace)

All are series. Case-sensitive **lowercase**. Availability by platform matters —
unavailable groups resolve to **all zeros (not an error)**.

| Group | Variables | Platforms |
|---|---|---|
| OHLCV | `open` `high` `low` `close` `volume` `time` | All (Kalshi, Polymarket, Robinhood) |
| Whale flow | `whale_volume` `whale_buy_volume` `whale_sell_volume` `whale_net_flow` `whale_trade_count` | **Polymarket only** |
| Pro traders | `pro_trader_count` `pro_buy_volume` `pro_sell_volume` | **Polymarket only** |
| Sentiment | `sentiment_yes` `sentiment_no` `pct_in_profit` `whale_concentration` `holder_count` | **Polymarket only** (`sentiment_*` are 0–100) |
| Volume flow | `yes_buy_volume` `yes_sell_volume` `no_buy_volume` `no_sell_volume` `yes_net_flow` `no_net_flow` | **Polymarket only** |
| Order book | `bid_depth` `ask_depth` `spread` | Polymarket + Kalshi (zeros on Robinhood) |

`whale_net_flow = buy − sell` (positive = accumulation). On Kalshi/Robinhood
every whale/pro/sentiment/volume-flow field is 0, so a formula that keys off them
returns flat/zero there — guard with `IF(...)` (see Footguns) for portability.

## Operators

- Arithmetic (element-wise): `+` `-` `*` `/` `%`. **Division or modulo by zero
  yields `0`** (never `NaN`/`Infinity`).
- Comparison (return `1`/`0` per bar): `>` `<` `>=` `<=` `==` `!=`.
- Logical **keywords** (lowercase, return `1`/`0`): `and` `or` `not`. Function
  forms `AND(a,b)` `OR(a,b)` `NOT(a)` `IF(cond,then,else)` also exist and are
  equivalent.
- Assignment: `=` only (no `+=`).
- Precedence low→high: `or` → `and` → comparisons → `+ -` → `* / %` → unary
  (`not`, unary `-`) → function call / parentheses.
- Literals: numbers (`14`, `0.5`, `.5`; no scientific notation); strings are
  **double-quoted** only (`"label"`, `"#color"`, `"platform:id"`) with no escape
  sequences. No boolean type — nonzero = true.

## Functions

Called by **UPPERCASE** name, element-wise over series. `series` args are
arrays; `period`/`bars` args are number literals. Arity is enforced for the
functions below (`SMA(close)` → error "SMA() expects 2 arguments, got 1").

| Group | Function | Signature | Notes |
|---|---|---|---|
| Moving avg | `SMA` | `SMA(series, period)` | Partial window at the start (no NaN warm-up). |
| | `EMA` | `EMA(series, period)` | k = 2/(period+1). |
| | `VWAP` | `VWAP()` | **No args** — uses the current market's OHLCV. |
| Volatility | `STDEV` | `STDEV(series, period)` | Population std-dev. |
| | `BB` | `BB(series, period, stddev)` | **3 args required; returns the MIDDLE band (SMA) only** — the `stddev` arg is accepted but ignored. For real bands, build them: `mid = SMA(close,20)` / `sd = STDEV(close,20)` / `upper = mid + 2*sd`. |
| | `ATR` | `ATR(period)` | **Avoid — currently returns zeros (unfinished).** Use `STDEV` or a manual true-range. |
| Momentum | `RSI` | `RSI(series, period)` | 0–100 (→ separate pane). |
| | `MACD` | `MACD(series, fast, slow, signal)` | **4 args required**; returns the MACD line (fast EMA − slow EMA); `signal` is accepted but ignored. |
| | `ROC` | `ROC(series, period)` | % rate of change. |
| | `MOM` | `MOM(series, period)` | current − value `period` bars ago. |
| Signals | `CROSSOVER` | `CROSSOVER(a, b)` | 1 when a crosses above b. |
| | `CROSSUNDER` | `CROSSUNDER(a, b)` | 1 when a crosses below b. |
| | `RISING` | `RISING(series, bars)` | 1 after `bars` strictly-rising bars. |
| | `FALLING` | `FALLING(series, bars)` | 1 after `bars` strictly-falling bars. |
| Math | `ABS` `SQRT` `LOG` | `FN(series)` | `LOG`/`SQRT` return 0 for ≤0 / negative (no NaN). |
| | `MAX` `MIN` | `MAX(a, b)` | Element-wise; if `b` is a scalar literal it's compared to each element (e.g. `MAX(x, 0.01)` to avoid /0). |
| | `AVG` `SUM` | `AVG(series, period)` `SUM(series, period)` | Rolling mean / rolling sum. |
| Logic | `IF` | `IF(cond, then, else)` | Per bar: `then` where `cond`≠0 else `else`. |
| | `AND` `OR` `NOT` | `AND(a,b)` `OR(a,b)` `NOT(a)` | Function forms of the keywords. |

## Output directives

- `PLOT(series, "label", "#color")` — draws a line. `label` and `color` are
  optional (default `"Custom"` / amber `"#fbbf24"`). Multiple `PLOT`s allowed.
  Outputs in 0–1 overlay the price pane; outputs outside 0–1 (e.g. RSI) render in
  a separate pane below.
- `HLINE(value, "label", "#color")` — horizontal reference line. **`value` must
  be a number literal.** `HLINE(myVar, ...)` silently draws at 0. Multiple
  allowed.
- **v2 directives `FILL`, `MARKER`, `BGCOLOR` parse and save fine but are NOT
  rendered yet** (silently skipped). Don't rely on them for a working indicator —
  use `PLOT`/`HLINE` (e.g. plot a 0/1 signal series instead of a `MARKER`).

## Cross-market references

Pull another market's series: `CLOSE`, `OPEN`, `HIGH`, `LOW`, `VOLUME`,
`WHALE_VOLUME`, each taking one string literal `"platform:market-id"` (platform =
`polymarket` or `kalshi`; the market-id is the id from the TrendIQ URL). Example:
`CLOSE("polymarket:will-btc-hit-100k")`.
- **Max 5 unique cross-market ids per formula** — a 6th is a hard compile error
  (`Too many cross-market references (6). Maximum is 5.`).
- Missing/unfetched market data → zeros (warning, not error).

## Limits & what makes a formula invalid

- Length ≤ **5000 chars** (enforced client + server), nesting depth ≤ 50,
  runtime ≤ 500 ms, ≤ 5 cross-market refs.
- **Errors:** unknown variable (`Unknown variable: 'foo'`), unknown function
  (`Unknown function: 'FOO'`), wrong argument count, too many cross-market refs,
  formula too long. Unknown-name/arity errors surface at run time and blank the
  affected output.
- **Not errors (silent):** division/modulo by zero → 0; `LOG`/`SQRT` of ≤0 → 0;
  referencing Polymarket-only fields on Kalshi/Robinhood → zeros; `HLINE(var)` →
  0; v2 directives → ignored; a string used as a number → zeros.

## Footguns

- Function names are **UPPERCASE** (`SMA`, not `sma`); variables are lowercase.
- `VWAP()` takes no args. `MACD` needs **4** args, `BB` needs **3** (both ignore
  their last arg). Avoid `ATR` (returns zeros).
- `HLINE`'s first arg must be a literal number.
- Rolling functions use a shrinking window at the start, so the first
  `period − 1` bars are inaccurate (not NaN/zero) — don't over-read the left edge.
- Don't shadow a built-in (`close = SMA(close,3)` overwrites `close` for later
  lines).
- Portable across platforms: guard smart-money fields, e.g.
  `sig = IF(whale_volume > 0, EMA(whale_net_flow,5), close - SMA(close,20))`.
- Don't name a variable `CLOSE`/`OPEN`/`HIGH`/`LOW`/`VOLUME`/`WHALE_VOLUME` —
  those are cross-market functions.

## Verified example formulas

All of these compile and execute with zero errors in the real engine.

```text
# 20-bar SMA with a midpoint reference
ma20 = SMA(close, 20)
PLOT(ma20, "SMA 20", "#60a5fa")
HLINE(0.5, "Midpoint", "#6b7280")
```

```text
# Whale net-flow momentum (Polymarket)
flow = EMA(whale_net_flow, 5)
PLOT(flow, "Whale Net Flow", "#22c55e")
HLINE(0, "Neutral", "#6b7280")
```

```text
# EMA crossover — plot the 0/1 signal instead of a (non-rendered) MARKER
fast = EMA(close, 9)
slow = EMA(close, 21)
cross = CROSSOVER(fast, slow)
PLOT(fast, "Fast EMA", "#22d3ee")
PLOT(slow, "Slow EMA", "#f59e0b")
PLOT(cross, "Bull Cross", "#22c55e")
```

```text
# RSI with overbought/oversold bands (renders in its own pane, 0–100)
r = RSI(close, 14)
PLOT(r, "RSI 14", "#a78bfa")
HLINE(70, "Overbought", "#ef4444")
HLINE(30, "Oversold", "#22c55e")
```

```text
# Real Bollinger Bands, built by hand (BB() only gives the middle band)
mid = SMA(close, 20)
sd  = STDEV(close, 20)
PLOT(mid, "BB Mid", "#a78bfa")
PLOT(mid + 2 * sd, "BB Upper", "#ef4444")
PLOT(mid - 2 * sd, "BB Lower", "#22c55e")
```

```text
# Order-book imbalance, smoothed (Polymarket/Kalshi)
imb = (bid_depth - ask_depth) / (bid_depth + ask_depth)
PLOT(SMA(imb, 10), "Book Imbalance", "#eab308")
HLINE(0, "Neutral", "#6b7280")
```

```text
# Cross-market ratio (uses 2 of the 5 allowed references)
a = CLOSE("polymarket:will-btc-hit-100k")
b = CLOSE("polymarket:will-btc-hit-150k")
PLOT(b / MAX(a, 0.01), "BTC Risk Appetite", "#f59e0b")
```

```text
# Platform-portable adaptive signal (whale flow on Poly, price elsewhere)
whale_sig = EMA(whale_net_flow, 5)
price_sig = close - SMA(close, 20)
sig = IF(whale_volume > 0, whale_sig, price_sig)
PLOT(sig, "Adaptive Signal", "#60a5fa")
```
