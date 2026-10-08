# 218 — Image-aware and scan PDF compression profiles

**What to build:** Keep current structural optimizer truthful and add separate image-aware/scan profiles with embedded-image inventory, DPI/downsample/recompression and optional user-chosen grayscale while retaining text/vector content.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98, 100, 103, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → code-module-design → code-tdd → browser-performance-benchmark

- [ ] Reports images touched/skipped and effective settings.
- [ ] Text/vector extraction stays stable unless an explicit raster mode is chosen.
- [ ] Output growth produces warning/keep-original recommendation.

**Verification:** Text/vector/image/scan corpus, render+extract comparison, size/perf/mobile checks.

**2026-10-08 bounded implementation (NOT ticket completion):** The existing structural-only compressor now reports the recognized embedded Image XObject dimensions, encoded byte lengths and filter names, explicitly counts `touched=0` and `skipped=N`, and records source/result byte deltas with a keep-original recommendation for zero savings or growth. It rejects requests for `image-aware`, `scan`, or grayscale instead of falsely claiming image recompression or rasterizing text/vector content. Output page count and geometry are inspected before/after, with limited non-semantic text/image metadata equality flags and explicit visual/extracted-text NOT_VERIFIED. `src/engines/pdf/compression-profile.ts` plus `tests/pdf-compression-profile-218.test.ts` are the relevant evidence. Actual image-aware downsample/recompression, verified text/vector parity, current-build browser/physical-mobile performance remain OPEN; the module must not be presented as a completed scan compression profile.

**2026-10-08 browser acceptance (bounded sample; ticket remains OPEN):** `npm run acceptance:pdf-export-compression` ran on a rebuilt static site in Chromium, Firefox and WebKit at 390px viewport (69/69 assertions). For a synthetic vector/text 3-page PDF and `jpeg-1page.pdf` Image XObject fixture, it downloaded the actual structural-only compressed PDFs, reparsed page geometry, compared extracted text before/after, rerendered original/output with PDF.js and compared decoded PNG pixel hashes page-by-page. Both sample documents passed. This proves sample-specific structural text/pixel parity only; no full vector-operator identity, image-aware compression, scan profile, physical-device/mobile-memory or larger real-world corpus coverage is certified. Source/output growth and unchanged-image inventory remain per the structural-analysis contract; `verification.pixelVisualParity` correctly remains `not-verified` for arbitrary input documents.
