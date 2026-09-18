import { describe, it, expect } from "vitest";
import { allTools } from "./index";

describe("allTools", () => {
  it("registers exactly 26 tools", () => {
    expect(allTools.length).toBe(26);
  });
  it("includes the 4 sports tools", () => {
    const names = allTools.map((t) => t.name);
    expect(names).toContain("list_sports_games");
    expect(names).toContain("get_sports_game");
    expect(names).toContain("get_sports_signals");
    expect(names).toContain("get_sports_whale_activity");
  });
  it("has unique tool names", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("includes the health tool", () => {
    expect(allTools.some((t) => t.name === "health")).toBe(true);
  });
  it("every tool has a non-empty name and a callable toReq returning an absolute path", () => {
    for (const t of allTools) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.toReq).toBe("function");
      const req = t.toReq({});
      expect(req.path.startsWith("/")).toBe(true);
    }
  });
});
