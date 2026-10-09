# 236 — Advanced PDF to image export

**What to build:** Upgrade PDF→images with page range, JPG/PNG/WebP, scale/DPI, quality/background and deterministic one-file-per-page names plus ZIP.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98, 103, 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [x] Chosen DPI/scale maps to verified output pixel dimensions.
- [x] Per-page failures isolate cleanly.
- [x] Raster output never claims vector preservation.

**Verification:** Multipage geometry/render corpus, output signatures, ZIP naming and mobile memory.

**Implementation evidence (2026-10-07):** Existing `pdf-to-images` now lazy-loads local `pdfjs-dist@6.4.299`, renders selected pages rather than extracting embedded JPEGs, supports JPG/PNG/WebP, 0.5–4× scale (reported as effective 72×scale DPI) and explicit JPG/WebP quality, uses deterministic `page-NNN.ext` names, isolates per-page failures, and adds a reopened/verified STORE ZIP when more than one page succeeds. Browser evidence renders the 2-page PDF in requested order `[2,1]` at 1× to verified 612×792 PNGs and verifies a two-entry ZIP. It explicitly describes raster rendering and makes no vector-preservation claim. Status remains formally blocked because the reusable 200-page thumbnail/mobile-memory prerequisites 215/269 are broader and still open.

**Follow-up implementation (2026-10-08):** The PDF→image page field now passes a strict, bounded `1-3, 5` expression through to the renderer, rather than discarding interval tokens via generic numeric parsing. Duplicate, reversed and out-of-range selections fail instead of yielding an incomplete export. A user-selected validated hex background is passed through to PDF.js raster rendering and returned in the export provenance. `tests/pdf-render-options-236.test.ts` validates page order/ranges/options, not mobile memory or a newly certified screenshot. Keep ticket open until current-build browser and physical-mobile memory evidence actually passes.

**2026-10-08 current-build browser acceptance:** `npm run acceptance:pdf-export-compression` verifies the downloaded real page PNG bytes and decoded dimensions/background pixels at 1×, preserves requested page order `3,1-2`, checks every ZIP entry is byte-identical to its separate download, refuses duplicate/reversed/out-of-range/malformed page ranges without stale downloads, and decodes JPG at 0.5× and WebP at 1.5× where supported. Chromium/Firefox/WebKit passed 69/69 checks on a local static build; WebKit's unsupported native WebP encoder is now detected and explicitly refused with no fake PNG-as-WebP download. Test viewport is 390px with overflow and no non-local requests checked. Physical-device/mobile-memory benchmarks and broader page-geometry corpus remain OPEN; no Gold or final ticket completion implied.

**2026-10-09 additional isolated #236 subset (ticket stays OPEN):** `src/engines/pdf/page-images-236.ts` introduces an isolated, callable PDF.js page raster engine with an explicit browser encoder capability probe, lazy local PDF.js worker, bounded PNG/JPEG output, strict page selection preserving order, page-scoped failures, per-page render cancellation, cleanup and a verified STORE ZIP. The engine does not replace or change the existing public `pdf-to-images` implementation; no catalog, registry or copy is touched. Accepted subset: PDF input ≤8 MiB; PDF page count 1–200; selected 1–8 pages; scale 0.5–2× (effective 36–144 DPI); ≤2 million pixels/page, ≤8 million cumulative pixels, ≤4096 px/side; ≤16 MiB accumulated encoded images; ≤20 MiB ZIP. PNG/JPEG actual signatures, sizes and dimensions are checked. Unsupported encoders fail closed rather than returning PNG with a wrong JPEG MIME. ZIP is reopened and entry order/bytes are checked, and the sample corpus is independently decoded by Pillow/zipfile. The renderer reports `fidelity: raster-visual-only`: **raster export is not secure PDF redaction/sanitization, does not preserve vectors and does not remove original hidden PDF content or metadata**.

**Measured proof (same 2026-10-09 branch):** `tests/pdf-page-images-236.test.ts` renders the actual `quality/fixtures/pdf-gold/simple-3page.pdf` through `pdfjs-dist/legacy` and native `@napi-rs/canvas`; selected order `3,1-2`, 0.5×, green raster background, three **306×396 PNGs** measuring **1,754 + 1,722 + 1,749 = 5,225 bytes**, verified **5,547-byte STORE ZIP** with `page-003.png, page-001.png, page-002.png` in order. Distinct raster pixels, exact backgrounds, output signatures and dimensions are reopened independently through both sharp and Python Pillow; Python standard-library zipfile verifies actual file entries and bytes independently of fflate. Page 2 is also exported independently at 1× as a **612×792 JPEG of 4,006 bytes**, reopened through sharp/Pillow. Unit tests cover corrupt headers, duplicate/reversed/out-of-range selections, encoder refusal, page-specific failure, oversized viewport rejected before canvas allocation, and cancellation with renderer/document cleanup. `vitest` for new and pre-existing #236 tests: **19/19 PASS**; targeted TypeScript **PASS**; diff-check **PASS**. Desktop Node proof is not equivalent to a new browser test or physical-device acceptance.

**Remaining acceptance:** Browser-live verification of the new isolated path, multi-layout/rotation/color/font corpus, physical iOS Safari/Android Chrome cancellation/memory receipts, and the broader 200-page page-selection/ZIP resource scenario are NOT_RUN for this tranche. Existing WebP browser path is outside this new bounded PNG/JPEG subset. Full acceptance and production promotion remain open; canonical `**Status:** ready-for-agent` must remain unchanged. The #241 signature/annotation and #237 true redaction workstreams are separate and untouched.
