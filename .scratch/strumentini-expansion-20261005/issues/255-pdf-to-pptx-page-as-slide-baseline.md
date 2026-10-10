# 255 — PDF to PPTX page-as-slide baseline

**What to build:** Create PPTX with each PDF page rendered as a slide image as the reliable baseline; editable reconstruction is a separate future mode only if proven.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 225, 236, 270.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd

- [x] Slide count/order equals selected PDF pages.
- [x] Rendered slide image dimensions/aspect are deterministic.
- [x] UI labels baseline as page-as-slide, not editable reconstruction.

**Verification:** Multipage corpus, PPTX reopen, slide count and rendered appearance.

**2026-10-10 functional closure (#255, no separate Gold/release promotion):** Reuses approved local dependencies `fflate@0.8.3` (MIT), production browser PDF.js/Canvas raster exporter from completed #236, and a blank OOXML package generated with permissively licensed python-pptx (MIT). Prior #270 explicitly declined `pptxgenjs@4.0.1`; no dependency/manifest/oracle/registry/catalog change. New source `src/engines/pdf/pdf-to-pptx-255.ts`, verified no-slide template `src/engines/pdf/pptx-255-blank.pptx` (27,387 bytes), user-facing `src/components/tools/pdf/PdfToPptx255Tool.tsx` mounted in the **existing public** `/tools/pdf-to-images/` route. A user selects 1–8 local PDF pages with existing strict grammar, preserving user-specified order (e.g., 3,1,2), then explicit opt-in triggers lazy PDF.js pixel rendering at 72/108/144 DPI (PNG only). Failed render(s), out-of-policy input, invalid selections, cancellation, and bad PNG encoding refuse the entire PPTX; no partial deck/stale downloads. A fflate OOXML ZIP writer stores genuine page image bytes as separate `ppt/media/pdf-page-N.png` parts with slide content, image/slide-layout relationships and content types. Fixed 10×7.5-inch 4:3 slides (9,144,000×6,858,000 EMU); page images use deterministic integer contain-fit coordinates and white margins, retaining aspect without cropping or stretching. UI explicitly says *conversione visiva pagina per slide, non ricostruzione modificabile*; no OCR/editability or unsupported codec claims. It also previews the first image re-read from the **produced PPTX**, not its source file. Limits inherited from #236 (8 MiB input; 8 pages/2M pixels per page/8M total raster pixels/16 MiB image bytes) plus PPTX package ≤25 MiB.

**Independent functional evidence:** `vitest run tests/pdf-pptx-255.test.ts` **2/2 PASS** including adversarial negative cases and a 3-page synthetic RGB corpus (80×40 red, 32×80 blue, 50×50 green) in deliberately reordered [3,1,2] sequence. The output was independently reopened by `python-pptx`, Python stdlib `zipfile` and Pillow: 3 picture shapes (one and only one raster/page), slide metadata/order/relationships, exact unmodified PNG pixel colors, dimensions, verified containment and rectangle aspect/centering, reconstructed 1000×750 slide appearance, and ZIP CRC all PASS. `astro check` 1,896 files, 0 errors, 0 warnings (21 existing deprecation hints). **Actual desktop Chromium browser at 390×844** `node tests/pdf-pptx-255.browser.mjs` **12/12 PASS**: real 3-page `quality/fixtures/pdf-gold/simple-3page.pdf` uploaded and PDF.js-rendered, pages selected **3,1,2**, actual PPTX downloaded, independently reopened by `python-pptx` with 3 slides/3 original PNG images/ZIP CRC, invalid page 50 refuses and discards previous download, zero external/write requests, zero page errors and no viewport overflow. First slide pixel screenshot from PPTX archive verified visually as page 3: `.scratch/strumentini-expansion-20261005/evidence/255-first-slide-browser.png`.

**Static build repeat:** `astro build --outDir /tmp/strumentini-pptx-255-build` **291 pages PASS** (isolated destination preserves concurrent shared build); served the produced static site at localhost and repeated `PDF255_ORIGIN=http://127.0.0.1:18456 node tests/pdf-pptx-255.browser.mjs` → **12/12 PASS** with independently reopened actual downloadable PPTX. No Office application executable or physical mobile device was available; the independently reconstructed raster appearance, native PPTX picture geometry, actual Chromium downloaded file and screenshot satisfy the specified baseline visual/OOXML acceptance, without claiming editable text or full PowerPoint product certification.
