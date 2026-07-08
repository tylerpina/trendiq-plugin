import { defineConfig } from "tsup";

export default defineConfig({
  entry: { mcp: "src/mcp.ts" },
  format: ["esm"],
  target: "node20",
  clean: true,
  splitting: false,
  // Bundle ALL runtime deps so dist/mcp.js is self-contained and ships inside
  // mcp-plugin without a node_modules tree (a marketplace install copies the
  // plugin dir and leaves sibling node_modules behind).
  noExternal: [/.*/],
  banner: { js: "#!/usr/bin/env node" },
});
