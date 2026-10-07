# 206 — Heavy local-job mobile and performance acceptance gate

**What to build:** Create the reusable acceptance matrix for cold lazy-load, runtime, memory/crash behavior, cancellation, no-network and genuine mobile evidence before any heavy local path is promoted.

**Traces to:** US-EXP-06; AC-06.1, AC-09.1; DEC-EXP-05, DEC-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** None — 34, 100 and 101 are complete.

**Status:** completed (gate contract complete; no heavy path promoted without physical evidence)

**Suggested skills:** browser-performance-benchmark → qa-browser → code-tdd

- [x] Each promoted heavy path has explicit thresholds and device/browser receipts; currently no heavy candidate is promoted, so missing physical iOS/Android evidence remains a promotion blocker rather than a fabricated pass.
- [x] Failure/cancel leaves tool recoverable and resources cleaned.
- [x] Unrelated lightweight routes show no heavy-bundle regression.

**Verification:** Production perf baseline/diff, browser QA and physical-device receipt schema.

**Closure evidence (2026-10-07):** ticket 100 defines API/resource preflight and hard/soft ceilings before heavy loading; ticket 101 supplies the shared terminable-worker protocol with cancel/retry/stale-suppression and owned-resource cleanup, backed by `quality/benchmarks/heavy-local-runtime/controlled-runtime.json`. The refreshed feasibility matrix in `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json` records exact desktop runtime/bundle/locality observations and explicit `NOT_RUN` physical iOS/Android fields. Its decision is to promote **zero** heavy candidates until those physical receipts exist. The light-route preflight/bundle acceptance continues to show no heavy codec/WASM fetch on unrelated routes. This ticket therefore closes the reusable acceptance gate itself without converting absent mobile evidence into a product promotion.
