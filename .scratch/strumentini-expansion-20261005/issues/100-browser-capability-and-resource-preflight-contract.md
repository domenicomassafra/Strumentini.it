# 100 — Browser capability and resource preflight contract

**What to build:** Add a reusable runtime preflight for heavy local jobs that reports required APIs, supported/degraded/unsupported state, file/resource ceilings and reason before loading heavy dependencies or reading whole files.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1; DEC-EXP-05

**Constraints:** C-EXP-02, C-EXP-04, C-EXP-05, C-EXP-08; measured capability only.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → qa-browser → browser-performance-benchmark

- [x] WASM/worker/image-decode/resource needs can be declared separately.
- [x] Unsupported/resource-risk state fails before expensive load.
- [x] Light routes do not fetch heavy codec chunks.

**Verification:** Fake capability seams plus real browser missing-feature and bundle checks.

**Evidence (2026-10-06):** `src/runtime/heavy-preflight.ts` declares worker/WASM/image-decode needs independently and applies soft/hard input and working-set ceilings. `tests/heavy-preflight.test.ts` passes 5/5 fake-capability/resource cases, while `scripts/acceptance-heavy-preflight-browser.mjs` runs the real preflight in Chromium with Worker/WebAssembly/image decode APIs removed and records `unsupported` before worker creation; the same acceptance loads `/tools/business-day/` from the current Astro build and records zero heavy/WASM requests in `quality/benchmarks/heavy-local-runtime/preflight-browser-bundle.json`. `npx astro build`, `npx tsc --noEmit` and scoped diff-check pass.
