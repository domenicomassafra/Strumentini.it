# 250 — PDF n-up pages per sheet

**What to build:** Add 2-up/4-up/custom bounded n-up imposition with paper size, orientation, margins/gaps and page-order preview.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** completed

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Sheet/page mapping is previewed and deterministic.
- [x] Blank padding policy is explicit.
- [x] Output geometry, source-page order and final-sheet padding are verified after independent PDF.js render of the downloaded PDF.

**Verification:** Page-numbered fixture PDFs and rendered imposition checks.

**Implementation evidence (2026-10-09, verification pending):** Isolated `src/engines/pdf/n-up.ts`, UI `src/components/tools/pdf/PdfNUpTool.tsx`, and stand-alone `/tools/pdf-n-up/` page implement row/column-first 2-up/4-up and custom grids (up to 8 slots), A4/Letter/custom 240–1200 pt, margins/gaps, deterministic source→slot preview and last-sheet explicit white padding. Independent manifest/module for registry integration live under `src/tools/pdf-n-up/` with candidate `cand-265`; no shared registry was edited. Input bounded 25 MiB and 64 pages, maximum 32 sheets; one PDF.js page and one sheet canvas rendered at a time. The output is **raster JPEG embedded in real PDF pages**: text selection, live links, vectors and source metadata are lost and the UI discloses this, while pages with annotations are rejected. The output parser independently checks PDF signature, sheet MediaBox dimensions and embedded JPEGs. Unit tests `tests/pdf-n-up-250.test.ts` pass 4/4 with deterministic mapping and negative cases; TypeScript and diff checks pass. The first Chromium UI run at 390 px reached source upload, preview, PDF export/download, geometry reparse and then stopped at a browser test-only import of PDF.js for independent rendered-pixel validation. Subsequent runs encountered a stalled local Astro dev server on this busy host, so **rendered color/order and blank visual proof have not been established**: ticket stays open; no fabricated browser PASS/Gold. The independent browser harness remains in `tests/pdf-n-up-250.browser.ts` for completion. Standalone route deliberately avoids shared catalog/oracle/dashboard modifications; prime can coordinate registry integration.

**Prime final acceptance (2026-10-09):** On integrated static build with `cand-265` append-only, `npx tsx tests/pdf-n-up-250.browser.ts` PASS exit 0. It loads a real five-page source PDF (five distinct colors and numbered pages) through the production UI at desktop Chromium 390×844, chooses 4-up landscape A4, verifies plan order 1→4 on first sheet and source 5 + three blank slots on second. Downloads resulting PDF, independently reparses both output MediaBox values `[841.89,595.28]`, verifies 2 sheets and embedded JPEG, then uses the actual *reopened PDF.js page previews* for **both output pages**, sampling color pixels independently of the writer. Observed sheet 1 RGB ≈ `[204,25,26] [25,135,36] [39,65,204] [225,174,20]`; sheet 2 `[170,35,174]` + 3 × `[255,255,255]` blank. No offsite requests. Unit `tests/pdf-n-up-250.test.ts` 4/4 PASS. Three AC demonstrably satisfied for this bounded raster imposition capability; no new Gold, no selectable vector/text/annotations preservation, no physical device/multi-browser certification claimed. The previously blocked browser verification is resolved; the paragraph above remains as history of the earlier intermediate run.
