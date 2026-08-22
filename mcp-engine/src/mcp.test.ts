import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAppStateless } from "./mcp";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function connectClient() {
  const server = createAppStateless();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  cleanups.push(async () => {
    await client.close();
    await server.close();
  });
  return { server, client };
}

describe("createAppStateless", () => {
  it("yields independent instances that each complete initialize + tools/list with 20 tools", async () => {
    const first = await connectClient();
    const second = await connectClient();

    expect(first.server).not.toBe(second.server);

    const firstTools = await first.client.listTools();
    const secondTools = await second.client.listTools();

    expect(firstTools.tools).toHaveLength(20);
    expect(secondTools.tools).toHaveLength(20);

    const firstNames = firstTools.tools.map((t) => t.name).sort();
    const secondNames = secondTools.tools.map((t) => t.name).sort();
    expect(firstNames).toEqual(secondNames);
    expect(firstNames).toContain("health");
  });
});
