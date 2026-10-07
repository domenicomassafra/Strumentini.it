# 324 — Redirect chain and live network diagnostic upgrade

**What to build:** Deepen redirect/reference-network diagnostics with explicit opt-in request, timeout/loop/hop states, retrieval timestamp and separation from local URL parsing.

**Traces to:** US-EXP-09, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 80, 99.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → qa-browser

- [x] No live request occurs before the explicit live-mode submit action.
- [x] Loops, timeouts, opaque/blocked responses and hop-limit outcomes retain the partial chain gathered so far.
- [x] Network results include retrievedAt plus an explicit privacy boundary and do not include unrelated local-mode data.

**Verification:** tests/url-marketing-upgrades.test.ts injects mock fetchers for loop/timeout/blocked states and proves local mode never calls fetch; scripts/acceptance-url-marketing-upgrades.mjs intercepts browser requests, proves zero requests before submit, verifies partial Chromium manual-redirect evidence, retrieval timestamp/privacy copy and 390px usability.

**Evidence:** redirect-chain-inspector remains one route with local/live modes; its manifest now truthfully declares REFERENCE + reference-only and a concrete disclosure for the opt-in network boundary.
