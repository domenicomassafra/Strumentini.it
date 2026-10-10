# 247 — Scanned PDF OCR and searchable text layer

**What to build:** Apply the accepted OCR stack to scanned PDF pages and produce selectable/searchable text-layer output while preserving page appearance within declared tolerance.

**Traces to:** US-EXP-04, US-EXP-06; AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 246.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Output contains selectable/searchable text on OCRed pages.
- [ ] Visual page rendering remains within documented tolerance.
- [ ] Mixed born-digital/scanned pages do not duplicate existing text silently.

**Verification:** Mixed PDF corpus, text search/extraction, rendered comparison and mobile/perf.

**2026-10-10 experimental bounded implementation (production still blocked):** A `noindex`, **DEV-only** route `/tools/pdf-scansionato-ocr-247/` now accepts PDFs locally (≤8 MiB, ≤3 pages, ≤2 scanned pages, ≤2 MP/page). Its dynamic Astro `[...route].astro` exports zero static paths in production (pattern accepted for #241); an isolated production build generated **exactly 291 pages and no `/tools/pdf-scansionato-ocr-247/index.html`**. `src/engines/pdf/ocr-searchable-247.browser.ts` renders each PDF.js page, refuses to OCR any page with existing selectable text, lazily invokes the same-origin experimental `tesseract.js@7.0.0` Italian model from #246 for actual word-level OCR confidence and bounding boxes, and runs an abortable worker with a 120s/page timeout. `src/engines/pdf/ocr-searchable-247.ts` appends PDF text rendering mode `3 Tr` (invisible but extractable text) with measured word coordinates and WinAnsi glyph validation, copying the original source page drawing streams byte-for-byte. It rejects unsupported/interactive/signed/encrypted/rotated or unreadable pages instead of guessing.

**Real checks:** `tests/pdf-ocr-searchable-247.test.ts` **3/3 PASS** includes source image stream byte preservation, PDF.js reopen and real scanned-image document, two-page mixed scanned+digital content and cancellation/unsupported coordinates/glyphs. `node --import tsx tests/ocr-247-local-browser.acceptance.mjs` **PASS in headless Chromium 390px** on the SHA-pinned 1280×240 Italian scan (fixture hash `1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b`) embedded as a real JPEG PDF and a separate two-page scanned+digital PDF; every downloaded output independently reopened with Node PDF.js and contains actual searchable OCR words (including `Fattura`, `numero`, `12345`, `678,90`). The digital source page text remains unchanged, no OCR duplication occurs, and original/output PDF.js render comparison measured **0 different pixels and 0/255 max-channel difference on every page** (threshold ≤0.05% changed pixels, ≤3/255 max-channel delta). Same-origin lazy WASM/model requests, no offsite requests or JS errors; digital-only PDF refuses output without starting OCR, cancellation yields no downloadable artifact. This verifies only the narrow measured desktop subset.

**Remaining production blockers:** #246/#271 still require real iOS Safari and Android Chrome devices, peak native+WASM total memory measurements, active recognition cancel/cleanup under memory pressure, diverse real scans and rotated/skewed corpus, and approved PDF OCR behavior outside the restrictive preview. The original acceptance boxes above remain unchecked and **Status remains `blocked`**; physical mobile/performance, broad visual-fidelity guarantees and full mixed-page text coverage have not been certified. No catalog/dashboard promotion, Gold assertion or deployment is implied.
