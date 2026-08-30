import { describe, it, expect } from "vitest";
import { allTools } from "./index";

describe("allTools", () => {
  it("registers exactly 22 tools", () => {
    expect(allTools.length).toBe(22);
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
