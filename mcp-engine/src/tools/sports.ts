import { z } from "zod";
import type { ToolDef } from "./helpers";

const SLUG = z.string().regex(/^[a-z0-9-]+$/, "Must be a lowercase slug (letters, digits, hyphens only).");
const SORT = z.enum(["kickoff", "edge", "volume", "move"]);

export const sportsTools: ToolDef[] = [
  {
    name: "list_sports_games",
    description:
      "The sports slate: every tracked game across leagues, both venues, with fee-adjusted Edge. Returns " +
      "{ leagues: [{code,name,family,ordering,kalshiSeries?,gameCount}], games: [SportsGame], generatedAt, " +
      "sharpWindowStart, pagesFetched }. Each SportsGame = { slug, league, title, startTime, live, ended, decided, " +
      "sides: [{key: 'away'|'home'|'draw', name, code?, polymarket: VenueQuote|null, kalshi: VenueQuote|null, " +
      "sharpNetUsd}], kalshiEventTicker?, polymarketUrl, kalshiUrl?, volume24hUsd, liquidityUsd, conditionIds, " +
      "edge: GameEdge, signals24h }. VenueQuote = { platform, marketId, seriesTicker?, bid, ask, last, change24h, " +
      "liquidityUsd, volume24hUsd, url } — bid/ask/last are 0-1 probabilities. GameEdge.edgeCents is 100 minus the " +
      "cost of buying every side at its cheapest venue after Kalshi's fee; positive means the venues disagree by " +
      "more than their combined vig (same-game arbitrage), after fees; depth is not checked and Polymarket gas is " +
      "excluded. sharpNetUsd is exact only for entitled callers (whaleFeed); everyone else sees it rounded to the " +
      "nearest $10,000. The full slate is roughly 270 games — pass `league` or a small `limit` rather than pulling " +
      "everything. Server-cached, do not poll.",
    shape: {
      league: SLUG.optional().describe("Restrict to one league code, e.g. 'nfl'. Omit for every league."),
      live: z.boolean().optional().describe("true = live games only."),
      sort: SORT.optional().describe(
        "kickoff (default, chronological), edge (best Edge first, unpriced last), volume (24h volume desc), " +
          "move (largest absolute 24h move of the favourite desc).",
      ),
      limit: z.number().int().positive().max(500).optional().describe("Default 50, max 500."),
    },
    toReq: (a) => ({ path: "/sports/slate", query: { league: a.league, live: a.live, sort: a.sort, limit: a.limit } }),
  },
  {
    name: "get_sports_game",
    description:
      "Full detail for one game: a SportsGame (see list_sports_games) plus spreads: Ladder|null and totals: " +
      "Ladder|null. Ladder = { kind: 'spread'|'total', rungs: [{marketId, line, side?, price, bid, ask, " +
      "liquidityUsd, change24h}], impliedLine, impliedSide }. impliedLine is the line where the ladder's price " +
      "crosses 0.5, interpolated — null when the rungs don't bracket it; impliedSide names which side the implied " +
      "line favours (spreads only). Read `edge` for the same-game-arbitrage read (see list_sports_games for the " +
      "field-by-field meaning of GameEdge). On a two-way game only one side's Polymarket outcome is usually a " +
      "directly queryable market — the other side's price/candles are its complement (1 − the queried side), not a " +
      "separate feed. Server-cached, do not poll.",
    shape: { slug: SLUG.min(1).describe("Game slug (the Polymarket event slug), from list_sports_games.") },
    toReq: (a) => ({ path: `/sports/games/${encodeURIComponent(a.slug)}` }),
  },
  {
    name: "get_sports_signals",
    description:
      "Smart-money signals pinned to games, newest first. Returns { signals: [Signal + {gameSlug, gameTitle, " +
      "league, marketType, sideLabel}], windowStart, lastUpdated }; sideLabel follows the tape's labelling " +
      "('Chargers', 'Over 43.5', 'Chiefs -2.5') and is null when the signal has no side. Gating mirrors the " +
      "platform signal feed: callers without the realtime-signals entitlement get the same delayed, " +
      "headline-only form everyone else gets there — detail fields are stripped, not the signals themselves.",
    shape: {
      league: SLUG.optional().describe("Restrict to one league code, e.g. 'nfl'."),
      game: SLUG.optional().describe("Restrict to one game slug."),
      limit: z.number().int().positive().max(200).optional().describe("Default 50, max 200."),
    },
    toReq: (a) => ({ path: "/sports/signals", query: { league: a.league, game: a.game, limit: a.limit } }),
  },
  {
    name: "get_sports_whale_activity",
    description:
      "Recent large trades on sports markets, attributed to a game. Premium-gated (whaleFeed entitlement) — " +
      "callers without it get a TrendIQ API error, not a truncated feed. Returns { trades: [WhaleTrade + " +
      "{gameSlug, gameTitle, league, marketType, line?, sideLabel}], minSizeUsd, windowStart, lastUpdated }; " +
      "sideLabel is the same tape labelling used elsewhere ('Chargers', 'Over 43.5', 'Chiefs -2.5'). windowStart " +
      "is the oldest trade considered, not a fixed lookback. `minSizeUsd` filters the trades returned; `proOnly` " +
      "restricts to trades from wallets flagged as pro traders.",
    shape: {
      league: SLUG.optional().describe("Restrict to one league code, e.g. 'nfl'."),
      game: SLUG.optional().describe("Restrict to one game slug."),
      minSizeUsd: z.number().nonnegative().optional().describe("Minimum trade size in USD."),
      proOnly: z.boolean().optional().describe("true = only trades from wallets flagged as pro traders."),
      limit: z.number().int().positive().max(200).optional().describe("Default 50, max 200."),
    },
    toReq: (a) => ({
      path: "/sports/tape",
      query: { league: a.league, game: a.game, minSizeUsd: a.minSizeUsd, proOnly: a.proOnly, limit: a.limit },
    }),
  },
];
