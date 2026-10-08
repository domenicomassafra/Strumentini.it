# 250 — PDF n-up pages per sheet

**What to build:** Add 2-up/4-up/custom bounded n-up imposition with paper size, orientation, margins/gaps and page-order preview.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Sheet/page mapping is previewed and deterministic.
- [x] Blank padding policy is explicit.
- [ ] Output geometry and source-page order are verified.

**Verification:** Page-numbered fixture PDFs and rendered imposition checks.

**Implementation evidence (2026-10-09, verification pending):** Isolated `src/engines/pdf/n-up.ts`, UI `src/components/tools/pdf/PdfNUpTool.tsx`, and stand-alone `/tools/pdf-n-up/` page implement row/column-first 2-up/4-up and custom grids (up to 8 slots), A4/Letter/custom 240–1200 pt, margins/gaps, deterministic source→slot preview and last-sheet explicit white padding. Independent manifest/module for registry integration live under `src/tools/pdf-n-up/` with candidate `cand-265`; no shared registry was edited. Input bounded 25 MiB and 64 pages, maximum 32 sheets; one PDF.js page and one sheet canvas rendered at a time. The output is **raster JPEG embedded in real PDF pages**: text selection, live links, vectors and source metadata are lost and the UI discloses this, while pages with annotations are rejected. The output parser independently checks PDF signature, sheet MediaBox dimensions and embedded JPEGs. Unit tests `tests/pdf-n-up-250.test.ts` pass 4/4 with deterministic mapping and negative cases; TypeScript and diff checks pass. The first Chromium UI run at 390 px reached source upload, preview, PDF export/download, geometry reparse and then stopped at a browser test-only import of PDF.js for independent rendered-pixel validation. Subsequent runs encountered a stalled local Astro dev server on this busy host, so **rendered color/order and blank visual proof have not been established**: ticket stays open; no fabricated browser PASS/Gold. The independent browser harness remains in `tests/pdf-n-up-250.browser.ts` for completion. Standalone route deliberately avoids shared catalog/oracle/dashboard modifications; prime can coordinate registry integration.
