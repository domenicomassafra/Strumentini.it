# 210 — Image target-size search engine

**What to build:** Implement cancellable iterative ≤KB/MB solving over proven image codecs, with quality floor and optional dimension reduction as a separate user choice.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 207, 208.

**Status:** completed (bounded browser-native target solver; physical-device promotion separately gated)

**Suggested skills:** code-module-design → code-tdd → browser-performance-benchmark

- [x] Success is asserted only when final bytes meet target.
- [x] Impossible target returns best effort plus limiting reason.
- [x] Cancellation works between iterations without leaking resources.

**Verification:** Exact-byte boundary, nonmonotonic codec and cancellation/memory fixtures.

**Implementation proof (2026-10-08):** `src/engines/image/target-size.ts` implements bounded measured search with explicit quality floor and opt-in scale reduction. Every candidate is a real encoded Blob; the chosen output is signature/size/header/decode verified. The encoder releases each canvas and observes cancellation between attempts. PNG never pretends to expose quality control; WebP→PNG browser fallback fails closed. `tests/image-target-size.test.ts` exercises impossible targets, nonmonotonic codecs, cancellation and MIME safety. `npm run acceptance:image-target-size` runs actual JPEG downloads against Chromium, Firefox and WebKit. Advanced codec paths refused by ticket 268 and physical iOS/Android certification remain separate from this bounded feature.
