import { describe, it, expect } from "vitest";
import { registerTools, type ToolDef } from "./helpers";

function fakeServer() {
  const tools: Record<string, (args: any) => Promise<any>> = {};
  return {
    tools,
    tool(name: string, _desc: string, _shape: any, handler: (args: any) => Promise<any>) {
      tools[name] = handler;
    },
  };
}

const def: ToolDef = { name: "t", description: "d", shape: {}, toReq: () => ({ path: "/x" }) };

describe("registerTools", () => {
  it("formats a successful response as pretty JSON text", async () => {
    const s = fakeServer();
    const client = { get: async () => ({ ok: true, status: 200, data: { a: 1 } }) } as any;
    registerTools(s as any, client, [def]);
    const res = await s.tools["t"]({});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('"a": 1');
  });

  it("formats an error response with isError and status+code", async () => {
    const s = fakeServer();
    const client = { get: async () => ({ ok: false, status: 404, code: "NF", message: "nope" }) } as any;
    registerTools(s as any, client, [def]);
    const res = await s.tools["t"]({});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("404 NF");
    expect(res.content[0].text).toContain("nope");
  });

  it("passes toReq output (path+query) into client.get", async () => {
    const s = fakeServer();
    const calls: any[] = [];
    const client = { get: async (p: string, q: any) => (calls.push([p, q]), { ok: true, status: 200, data: {} }) } as any;
    const d2: ToolDef = { name: "u", description: "d", shape: {}, toReq: (a) => ({ path: "/y", query: { z: a.z } }) };
    registerTools(s as any, client, [d2]);
    await s.tools["u"]({ z: 5 });
    expect(calls[0]).toEqual(["/y", { z: 5 }]);
  });
});
