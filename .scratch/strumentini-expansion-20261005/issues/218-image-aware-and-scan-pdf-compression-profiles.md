# 218 — Image-aware and scan PDF compression profiles

**What to build:** Keep current structural optimizer truthful and add separate image-aware/scan profiles with embedded-image inventory, DPI/downsample/recompression and optional user-chosen grayscale while retaining text/vector content.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98, 100, 103, 269.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd → browser-performance-benchmark

- [ ] Reports images touched/skipped and effective settings.
- [ ] Text/vector extraction stays stable unless an explicit raster mode is chosen.
- [ ] Output growth produces warning/keep-original recommendation.

**Verification:** Text/vector/image/scan corpus, render+extract comparison, size/perf/mobile checks.
