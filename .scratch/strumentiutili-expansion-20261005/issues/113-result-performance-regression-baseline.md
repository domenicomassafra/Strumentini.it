# 113 — Result performance regression baseline

**What to build:** Record production performance baselines for lightweight, large-output, file and later heavy Result v2 examples, including initial JS, lazy chunks, long tasks and transfer/runtime.

**Traces to:** US-EXP-01, US-EXP-06; AC-06.1

**Constraints:** C-EXP-08; heavy examples may be absent until feasibility resolves, but light routes must stay clean.

**Blocked by:** 81 — Semantic result-class conformance harness.

**Status:** completed

**Suggested skills:** browser-performance-benchmark → qa-browser

- [x] Result v2 does not eagerly pull unrelated engine/WASM chunks.
- [x] Baseline records comparable metrics and bundle/resource list.
- [x] Later heavy routes can extend the same baseline without replacing light-route thresholds.

**Verification:** Production browser baseline and regression diff workflow.

Evidence (2026-10-06): a fresh static Astro build plus `npm run acceptance:result-v2-performance` passes representative calculator, large text/code, and file Result v2 routes. `quality/baselines/result-v2-performance.json` carries versioned fixed ceilings for initial JS, lazy JS, action runtime and long tasks; the gate now fails closed if any representative scenario lacks a budget. `quality/receipts/result-v2/performance-current.json` records exact initial/lazy resource lists and bytes, zero eager WASM, runtime/long-task observations, the applied budget, and a deterministic 80-line bounded preview for a 6,011-line large output. The existing controlled heavy-local receipt is attached separately, so heavy evidence extends the receipt without replacing the three light-route thresholds. `npx tsc --noEmit` and scoped `git diff --check` pass.
