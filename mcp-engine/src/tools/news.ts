import { z } from "zod";
import type { ToolDef } from "./helpers";

const NEWS_CATEGORY = z.enum(["politics", "econ", "sports", "crypto"]);

export const newsTools: ToolDef[] = [
  {
    name: "get_market_news",
    description:
      "News for one Polymarket market (by conditionId): { related, category, categoryLabel, windowDays }. `related` = articles linked to THIS market (score = linker P(yes)); `category` = the market's category feed. 7-day window, newest first, <=20 per section. Polymarket only — other platforms return { unsupported: true }. Server-cached, do not poll.",
    shape: { id: z.string().min(1).describe("Polymarket conditionId.") },
    toReq: (a) => ({ path: `/news/polymarket/${encodeURIComponent(a.id)}` }),
  },
  {
    name: "get_news_feed",
    description:
      "Global news feed: articles from the last 7 days with >=1 linked Polymarket market, newest first, keyset-paginated. Returns { articles: [{ id, url, source, title, lede, publishedAt, category, markets: [{ id, question, eventTitle, url, category, endDate, active, score, rank }] }], nextCursor, windowDays }. Pass nextCursor back as cursor for the next page; null = last page.",
    shape: {
      category: NEWS_CATEGORY.optional().describe("Filter to one category; default all."),
      limit: z.number().int().positive().max(100).optional().describe("Articles per page (default 50, max 100)."),
      cursor: z.string().optional().describe("Opaque cursor from a prior page's nextCursor."),
    },
    toReq: (a) => ({ path: "/news/feed", query: { category: a.category, limit: a.limit, cursor: a.cursor } }),
  },
];
