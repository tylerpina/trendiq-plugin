# Ledger: trendiq remote MCP server — 2026-08-22

Spec: `docs/superpowers/specs/2026-08-22-trendiq-remote-mcp-design.md` (agent-os @ 1f43d41)
Plan: `docs/superpowers/plans/2026-08-22-trendiq-remote-mcp.md` (agent-os @ 10279a1)
Branch: `feat/remote-mcp-server` (from main @ 4fb482d). Lock: `.opencode/state/lock-trendiq-plugin.json` (ox-alpha).

## Progress
### Task 1 — SDK bump (DONE)
- Implementer: ox-alpha general subagent. SDK 1.30.0 (^1.0.0 lockfile resolved 1.29.0 → range now ^1.30.0).
- No source changes needed. 34/34 tests, typecheck clean, tsup build ok, stdio handshake verified 20 tools.
- Smoke vs live API: exit 0; six endpoints 403 Premium-gated upstream (pre-existing account-tier, not a regression).
- Not verified: full `npm run build` sync step (implementer avoided touching mcp-plugin/); premium-endpoint error path live.
- Controller verified: git status clean-ish, npm test re-run green. Committed as SDK bump only.
### Task 2 — shared factory (DONE)
- createServer() confirmed stdio-free; added createAppStateless() wrapper + mcp.test.ts (InMemoryTransport pair, 20 tools each, independent instances). 35/35 tests, typecheck clean. Committed.
### Task 3 — HTTP endpoint + rate limiter (DONE)
- src/http.ts (express, stateless StreamableHTTP per request, 405 GET/DELETE, /healthz), src/rate-limit.ts (fixed window, injectable clock, trust proxy).
- Timeout: Promise.race backstop → JSON-RPC -32000; upstream failures surface as MCP isError results via client's own 20s fetch bound.
- 22 new tests; suite 57/57; typecheck clean. Committed.
- Uncovered (disclosed): parseErrorHandler fallthrough plumbing; main()/listen blocks.
### Task 4 — build wiring (DONE)
- tsup entries {mcp, http}; banner createRequire shim fixes express CJS dynamic require in ESM bundle.
- npm run build emits both; sync-plugin still copies only dist/mcp.js into plugin (verified).
- Live checks: dist/http.js /healthz → 200 {ok:true}; dist/mcp.js answers initialize over stdin. 57/57 tests.
- Not verified: Node 20 runtime (ran v22), no soak. Committed.
### Review gate after Tasks 3–4 (spec-fidelity-reviewer)
- Clauses 1,2,4,6,7,8,10 PASS. F1 WEAKENED (clause 5): trust proxy=true → req.ip from client-controlled leftmost XFF — limiter bypassable behind Railway. F2 PARTIAL (clause 3): rebuilt plugin bundle uncommitted + banner reaches shipped artifact (behavior verified fine). F3: timeout env knob untested.
### Fix lane (DONE)
- trust proxy=1; rewrote 429 test that was asserting the attack vector; added spoof-resistance test (fails under old code), XFF-less keying test, readTimeoutMsFromEnv parsing tests, 413 JSON-RPC handler for oversized bodies.
- Rebuilt mcp-plugin/engine/dist/mcp.js committed after stdio verification (initialize ok, 20 tools). Suite 63/63; typecheck clean. Committed.
- Not verified: real multi-hop Railway proxy chain behavior — confirm header handling at deploy (Task 5).
### Test-discriminator gate (DONE)
- 4 mutations, all caught: trust-proxy revert → spoof-XFF test fails (also 61st-request test); limiter disabled → 4 tests red; window-reset removed → reset unit fails; timeout race bypassed → hung-upstream test times out. No undetected mutations. Tree clean, 63/63 green after reverts.
### Task 5 — local artifacts (DONE, DEPLOY PARKED)
- Dockerfile (3-stage, non-root), railway.json (DOCKERFILE builder, /healthz healthcheck), .dockerignore, build:bundle script.
- Docker build + run verified: /healthz 200 {ok:true}, POST /mcp initialize 200 with serverInfo. Container/image cleaned up.
- DEPLOY PARKED: needs user's Railway access (no railway CLI/credentials in this environment). Env to set at deploy: TRENDIQ_API_BASE_URL=https://trendiq.pro/api.
- Not verified: live API calls through the container; real Railway proxy header behavior.
