# 256 — TXT Markdown HTML and CSV to printable PDF

**What to build:** Build one local print-layout engine for deterministic text/markup/table→PDF with page size, orientation, margins, fonts, wrapping and page-number controls.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 54, 103, 269.

**Status:** completed

**Suggested skills:** pdf → design-impeccable → code-module-design → code-tdd

- [x] TXT/MD/HTML/CSV map through explicit format-specific content rules.
- [x] Long text/tables paginate without clipping/overlap.
- [x] Output pages/size/layout warnings are reported.

**Verification:** Render-to-image visual inspection for long text/table/Unicode/page-break corpus.

**2026-10-09 worker-1 bounded implementation (ticket remains `ready-for-agent`):** Added `src/engines/pdf/printable-document.ts`, `src/components/tools/PrintablePdfTool.tsx`, `src/pages/tools/printable-pdf-from-text.astro`, plus owned manifest/module. No catalog, oracle, dashboard or production integration. TXT retains explicit line breaks; Markdown/HTML use the existing normalized text/markup converter and document their structural loss (HTML is parsed as inert text, never injected into DOM or fetched remotely); CSV uses the existing quote-aware Papa parser with bounded columns, cell-level word wrapping, multiline records, table row pagination and repeated header. Page sizes A4/Letter, orientation, margins, Courier font size and optional page numbers are configurable. Generated PDF uses Courier WinAnsi, preserving supported Italian accents and rejecting unsupported Unicode with explicit `UNSUPPORTED_UNICODE`; no silent glyph replacements. Bounds: ≤512 KiB UTF-8 source, ≤8 CSV columns, ≤1800 CSV rows, ≤9000 printed lines, ≤80 pages, 24–90 pt margins and 8–14 pt font. Output is reparsed to verify page count and MediaBox. UI additionally requires a successful local PDF.js first-page PNG render before enabling download. Route is `noindex` until prime integrates catalog.

**Verification scoped to the increment:** `tests/printable-pdf-256.test.ts` 4/4 PASS (TXT long-page wrap/full tail, deterministic bytes; Markdown/HTML parser boundaries; CSV 172 multiline/quoted rows over multiple pages with header on every page; Italian WinAnsi/unrepresentable Unicode fail closed). Browser/download acceptance is `scripts/acceptance-printable-pdf-256.ts` and requires a current isolated Astro build. The controls above prove subsets of AC1/AC2/AC3 only; do not close full AC without browser render and larger multilingual/page-break corpus. Fidelity exclusions: typography beyond Courier, embedded images/CSS/HTML table semantics, PDF/A, full Unicode font embedding, very wide CSV beyond eight columns, full accessibility tagging and physical-mobile/multi-browser proof.

**2026-10-09 browser update:** `npx tsc --noEmit` PASS; isolated `npx astro build` PASS (285 pages, no generated catalog edits). `npx tsx scripts/acceptance-printable-pdf-256.ts` PASS on Chromium headless at 390×844, downloading and reparsing actual PDFs: TXT 5 pages, CSV 17 pages (header on each; last record present), inert HTML 1 page, actual PDF.js PNG preview 596×842 decoded for each, 0 offsite requests, no HTML script execution, Unicode unsupported fail-closed and no stale download. The result pages' first-page previews are verified, but not the full-page render corpus or physical devices. Ticket remains `ready-for-agent`, the pagination visual-matrix checkbox stays OPEN.

**2026-10-09 final AC2 acceptance / completion evidence:** Independent `npx tsx scripts/acceptance-printable-pdf-all-pages-256.ts` **PASS** against the integrated main static build, with one local HTTP server and one 390×844 Chromium instance. All three scenarios use the actual printable route and its **downloaded PDFs**, then open them with an independent PDF.js `getDocument` text-geometry oracle and upload the same files into the existing PDF-to-images route for a second, browser-executed PDF.js PNG render of **every output page**. All 23/23 pages render as decoded PNGs in the downloaded ZIP: TXT A4 portrait/WinAnsi/long unbroken tokens **5 pages**, CSV Letter landscape/quoted multiline cells **11 pages**, CSV A4 portrait/8pt/wide wraps **7 pages**. **3908 measured body text runs**, with page-by-page numeric bounds for all glyph boxes, pairwise intersection checking (including an adversarial collision self-check), a complete one-occurrence census of all source row identifiers, repeat CSV header and correct numbered footer on every page. Independent Sharp pixel decoding checks all 23 raster pages are nonblank and dimensions match PDF MediaBoxes, with **0 border-ink/clipped pixels**, **0 offsite requests**, **0 missing/duplicate pages**. Previous AC1 format-specific tests (4/4) and AC3 output metadata/layout warnings remain PASS. All three ticket AC demonstrated, therefore **completed**. Bounded product fidelity still explicitly excludes CSS/image-rich HTML, full Unicode font embedding, very wide CSV and physical-device/multi-browser certification; these are outside this AC subset, and no Gold/prod claim is made.
