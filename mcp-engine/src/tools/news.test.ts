import { describe, it, expect } from "vitest";
import { z } from "zod";
import { newsTools } from "./news";

describe("news tools", () => {
  it("exposes get_market_news and get_news_feed", () => {
    expect(newsTools.map((t) => t.name)).toEqual(["get_market_news", "get_news_feed"]);
  });

  it("get_market_news builds the polymarket news path and URL-encodes the id", () => {
    const [marketNews] = newsTools;
    expect(marketNews.toReq({ id: "0xcond" })).toEqual({ path: "/news/polymarket/0xcond" });
    expect(marketNews.toReq({ id: "a/b" })).toEqual({ path: "/news/polymarket/a%2Fb" });
  });

  it("get_market_news requires a non-empty id", () => {
    const shape = z.object(newsTools[0].shape);
    expect(shape.safeParse({ id: "0xcond" }).success).toBe(true);
    expect(shape.safeParse({ id: "" }).success).toBe(false);
    expect(shape.safeParse({}).success).toBe(false);
  });

  it("get_news_feed builds /news/feed and passes category/limit/cursor through as query", () => {
    const [, feed] = newsTools;
    expect(feed.toReq({})).toEqual({ path: "/news/feed", query: { category: undefined, limit: undefined, cursor: undefined } });
    expect(feed.toReq({ category: "politics", limit: 10, cursor: "abc" })).toEqual({
      path: "/news/feed",
      query: { category: "politics", limit: 10, cursor: "abc" },
    });
  });

  it("get_news_feed validates category enum and limit bounds", () => {
    const shape = z.object(newsTools[1].shape);
    expect(shape.safeParse({}).success).toBe(true);
    expect(shape.safeParse({ category: "sports" }).success).toBe(true);
    expect(shape.safeParse({ category: "weather" }).success).toBe(false);
    expect(shape.safeParse({ limit: 100 }).success).toBe(true);
    expect(shape.safeParse({ limit: 101 }).success).toBe(false);
    expect(shape.safeParse({ limit: 0 }).success).toBe(false);
  });
});
