# 215 — Bounded lazy PDF page-thumbnail renderer

**What to build:** Create a reusable lazy/virtualized page-thumbnail interface with stable page identity and rotation state; the existing mutation engine remains authoritative.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 78, 100, 269.

**Status:** completed (bounded on-demand browser PDF.js preview; physical-device evidence remains separate)

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] A 200-page PDF is not eagerly rendered in full.
- [x] Leaving/cancelling releases render resources.
- [x] Page/document render failure is isolated and explained.

**Verification:** Page-count corpus, lazy/memory evidence, keyboard order and 390px browser QA.

**Implementation proof (2026-10-08):** The reusable `src/engines/pdf/thumbnails.ts` opens PDF.js only after explicit preview activation, enforces existing PDF byte/page limits, allows 4 visible pages at most, renders sequentially at <=176×208px, and always calls page cleanup, releases canvases, cancels the active render and destroys the PDF.js document/worker when leaving. The accessible, keyboard-operated `PdfThumbnailPicker` shows stable page numbers and selected rotation, makes failure per-page and per-document explicit, and revokes all Blob object URLs when hidden, changed or unmounted. Wired to the original authoritative input fields of `pdf-page-reorder` and `pdf-rotate` without rewriting PDF mutation operations. `tests/pdf-thumbnails.test.ts` asserts 200-page window boundaries. `scripts/acceptance-pdf-thumbnails.ts` renders 200-page real synthetic PDFs in Chromium, Firefox and WebKit, verifies no eager thumbnails, URL revocation, keyboard selection, rotation, corrupted-document boundary and 390px responsive layout: **21/21 PASS**. Full unit suite **1104/1104**, Astro **0 errors**, build **279 pages**, existing PDF browser acceptance **20 tools PASS**, Cloudflare dry-run PASS. Physical iOS/Android browser certification is not inferred from desktop/mobile-viewport testing.
