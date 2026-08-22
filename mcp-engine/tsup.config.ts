import { defineConfig } from "tsup";

export default defineConfig({
  entry: { mcp: "src/mcp.ts", http: "src/http.ts" },
  format: ["esm"],
  target: "node20",
  clean: true,
  splitting: false,
  // Bundle ALL runtime deps so dist/mcp.js is self-contained and ships inside
  // mcp-plugin without a node_modules tree (a marketplace install copies the
  // plugin dir and leaves sibling node_modules behind).
  noExternal: [/.*/],
  // CJS deps bundled into an ESM output can still call require() dynamically
  // (express -> depd -> require("path")). Provide it via createRequire.
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);',
  },
});
