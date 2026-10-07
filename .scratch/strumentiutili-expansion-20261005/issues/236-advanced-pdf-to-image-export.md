# 236 — Advanced PDF to image export

**What to build:** Upgrade PDF→images with page range, JPG/PNG/WebP, scale/DPI, quality/background and deterministic one-file-per-page names plus ZIP.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98, 103, 215, 269.

**Status:** blocked

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [x] Chosen DPI/scale maps to verified output pixel dimensions.
- [x] Per-page failures isolate cleanly.
- [x] Raster output never claims vector preservation.

**Verification:** Multipage geometry/render corpus, output signatures, ZIP naming and mobile memory.

**Implementation evidence (2026-10-07):** Existing `pdf-to-images` now lazy-loads local `pdfjs-dist@6.4.299`, renders selected pages rather than extracting embedded JPEGs, supports JPG/PNG/WebP, 0.5–4× scale (reported as effective 72×scale DPI) and explicit JPG/WebP quality, uses deterministic `page-NNN.ext` names, isolates per-page failures, and adds a reopened/verified STORE ZIP when more than one page succeeds. Browser evidence renders the 2-page PDF in requested order `[2,1]` at 1× to verified 612×792 PNGs and verifies a two-entry ZIP. It explicitly describes raster rendering and makes no vector-preservation claim. Status remains formally blocked because the reusable 200-page thumbnail/mobile-memory prerequisites 215/269 are broader and still open.
