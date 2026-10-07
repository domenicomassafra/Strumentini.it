# 208 — PNG lossless and palette compression modes

**What to build:** Implement one PNG adapter with pixel-lossless optimization and separately labelled palette/color-lossy mode including alpha-safe behavior and optional dithering.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 268.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] **REFUSED for production implementation:** ticket 268 records `pngOptimization=REFUSE_NO_VETTED_OPTIMIZER`; no PNG optimizer/palette mode is promoted without a vetted implementation.
- [x] Because the optimizer path is refused, no lossy palette/dither controls or visual-delta claims are exposed.
- [x] Existing PNG behavior is not relabelled with a generic JPEG-style quality control or claimed as lossless optimization.

**Verification:** Closed as a refusal downstream of ticket 268. Reopen only after a vetted PNG optimizer proves pixel-lossless and palette-mode semantics on the required corpus.
