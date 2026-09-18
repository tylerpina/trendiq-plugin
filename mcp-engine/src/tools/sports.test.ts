import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sportsTools } from "./sports";

const byName = Object.fromEntries(sportsTools.map((t) => [t.name, t]));

describe("sports tools", () => {
  it("exposes the 4 expected tools", () => {
    expect(sportsTools.map((t) => t.name).sort()).toEqual(
      ["get_sports_game", "get_sports_signals", "get_sports_whale_activity", "list_sports_games"].sort(),
    );
  });

  describe("list_sports_games", () => {
    const tool = byName["list_sports_games"];
    const shape = z.object(tool.shape);

    it("builds /sports/slate with no query by default", () => {
      expect(tool.toReq({})).toEqual({ path: "/sports/slate", query: { league: undefined, live: undefined, sort: undefined, limit: undefined } });
    });

    it("passes league/live/sort/limit through as query", () => {
      expect(tool.toReq({ league: "nfl", live: true, sort: "edge", limit: 20 })).toEqual({
        path: "/sports/slate",
        query: { league: "nfl", live: true, sort: "edge", limit: 20 },
      });
    });

    it("omitted optionals are absent from the query", () => {
      const req = tool.toReq({ league: "nfl" });
      expect(req.query).not.toHaveProperty("liveXYZ");
      expect(Object.values(req.query!).filter((v) => v !== undefined)).toEqual(["nfl"]);
    });

    it("accepts a bare call and a fully-specified call", () => {
      expect(shape.safeParse({}).success).toBe(true);
      expect(shape.safeParse({ league: "nfl", live: true, sort: "edge", limit: 20 }).success).toBe(true);
    });

    it("rejects limit 0 and limit 501", () => {
      expect(shape.safeParse({ limit: 0 }).success).toBe(false);
      expect(shape.safeParse({ limit: 501 }).success).toBe(false);
      expect(shape.safeParse({ limit: 1 }).success).toBe(true);
      expect(shape.safeParse({ limit: 500 }).success).toBe(true);
    });

    it("rejects a bad sort value", () => {
      expect(shape.safeParse({ sort: "kickoff" }).success).toBe(true);
      expect(shape.safeParse({ sort: "edge" }).success).toBe(true);
      expect(shape.safeParse({ sort: "volume" }).success).toBe(true);
      expect(shape.safeParse({ sort: "move" }).success).toBe(true);
      expect(shape.safeParse({ sort: "popularity" }).success).toBe(false);
    });

    it("rejects a league slug with spaces", () => {
      expect(shape.safeParse({ league: "not a slug" }).success).toBe(false);
      expect(shape.safeParse({ league: "nfl" }).success).toBe(true);
      expect(shape.safeParse({ league: "college-football" }).success).toBe(true);
    });

    it("does not mention Premium in its description", () => {
      expect(tool.description).not.toContain("Premium");
    });
  });

  describe("get_sports_game", () => {
    const tool = byName["get_sports_game"];
    const shape = z.object(tool.shape);

    it("builds the game path and URL-encodes the slug", () => {
      expect(tool.toReq({ slug: "chargers-vs-broncos" })).toEqual({ path: "/sports/games/chargers-vs-broncos" });
      expect(tool.toReq({ slug: "a/b" })).toEqual({ path: "/sports/games/a%2Fb" });
    });

    it("requires a slug", () => {
      expect(shape.safeParse({ slug: "chargers-vs-broncos" }).success).toBe(true);
      expect(shape.safeParse({}).success).toBe(false);
      expect(shape.safeParse({ slug: "" }).success).toBe(false);
    });

    it("rejects a slug with spaces", () => {
      expect(shape.safeParse({ slug: "not a slug" }).success).toBe(false);
    });

    it("does not mention Premium in its description", () => {
      expect(tool.description).not.toContain("Premium");
    });

    it("explains edge and the implied-line fields", () => {
      expect(tool.description).toContain("edge");
      expect(tool.description).toContain("impliedLine");
    });
  });

  describe("get_sports_signals", () => {
    const tool = byName["get_sports_signals"];
    const shape = z.object(tool.shape);

    it("builds /sports/signals and passes league/game/limit through as query", () => {
      expect(tool.toReq({})).toEqual({ path: "/sports/signals", query: { league: undefined, game: undefined, limit: undefined } });
      expect(tool.toReq({ league: "nfl", game: "chargers-vs-broncos", limit: 20 })).toEqual({
        path: "/sports/signals",
        query: { league: "nfl", game: "chargers-vs-broncos", limit: 20 },
      });
    });

    it("caps limit at 200", () => {
      expect(shape.safeParse({ limit: 200 }).success).toBe(true);
      expect(shape.safeParse({ limit: 201 }).success).toBe(false);
      expect(shape.safeParse({ limit: 0 }).success).toBe(false);
    });

    it("rejects a game slug with spaces", () => {
      expect(shape.safeParse({ game: "not a slug" }).success).toBe(false);
    });

    it("does not mention Premium in its description", () => {
      expect(tool.description).not.toContain("Premium");
    });
  });

  describe("get_sports_whale_activity", () => {
    const tool = byName["get_sports_whale_activity"];
    const shape = z.object(tool.shape);

    it("builds /sports/tape and passes league/game/minSizeUsd/proOnly/limit through as query", () => {
      expect(tool.toReq({})).toEqual({
        path: "/sports/tape",
        query: { league: undefined, game: undefined, minSizeUsd: undefined, proOnly: undefined, limit: undefined },
      });
      expect(tool.toReq({ league: "nfl", game: "chargers-vs-broncos", minSizeUsd: 10000, proOnly: true, limit: 20 })).toEqual({
        path: "/sports/tape",
        query: { league: "nfl", game: "chargers-vs-broncos", minSizeUsd: 10000, proOnly: true, limit: 20 },
      });
    });

    it("rejects a negative minSizeUsd", () => {
      expect(shape.safeParse({ minSizeUsd: -1 }).success).toBe(false);
      expect(shape.safeParse({ minSizeUsd: 0 }).success).toBe(true);
      expect(shape.safeParse({ minSizeUsd: 10000 }).success).toBe(true);
    });

    it("rejects a game slug with spaces", () => {
      expect(shape.safeParse({ game: "not a slug" }).success).toBe(false);
    });

    it("mentions Premium in its description (the only sports tool that should)", () => {
      expect(tool.description).toContain("Premium");
    });
  });

  it("mentions Premium only on get_sports_whale_activity", () => {
    for (const t of sportsTools) {
      if (t.name === "get_sports_whale_activity") continue;
      expect(t.description).not.toContain("Premium");
    }
  });
});
