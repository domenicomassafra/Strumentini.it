# 256 — TXT Markdown HTML and CSV to printable PDF

**What to build:** Build one local print-layout engine for deterministic text/markup/table→PDF with page size, orientation, margins, fonts, wrapping and page-number controls.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 54, 103, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → design-impeccable → code-module-design → code-tdd

- [x] TXT/MD/HTML/CSV map through explicit format-specific content rules.
- [ ] Long text/tables paginate without clipping/overlap.
- [x] Output pages/size/layout warnings are reported.

**Verification:** Render-to-image visual inspection for long text/table/Unicode/page-break corpus.

**2026-10-09 worker-1 bounded implementation (ticket remains `ready-for-agent`):** Added `src/engines/pdf/printable-document.ts`, `src/components/tools/PrintablePdfTool.tsx`, `src/pages/tools/printable-pdf-from-text.astro`, plus owned manifest/module. No catalog, oracle, dashboard or production integration. TXT retains explicit line breaks; Markdown/HTML use the existing normalized text/markup converter and document their structural loss (HTML is parsed as inert text, never injected into DOM or fetched remotely); CSV uses the existing quote-aware Papa parser with bounded columns, cell-level word wrapping, multiline records, table row pagination and repeated header. Page sizes A4/Letter, orientation, margins, Courier font size and optional page numbers are configurable. Generated PDF uses Courier WinAnsi, preserving supported Italian accents and rejecting unsupported Unicode with explicit `UNSUPPORTED_UNICODE`; no silent glyph replacements. Bounds: ≤512 KiB UTF-8 source, ≤8 CSV columns, ≤1800 CSV rows, ≤9000 printed lines, ≤80 pages, 24–90 pt margins and 8–14 pt font. Output is reparsed to verify page count and MediaBox. UI additionally requires a successful local PDF.js first-page PNG render before enabling download. Route is `noindex` until prime integrates catalog.

**Verification scoped to the increment:** `tests/printable-pdf-256.test.ts` 4/4 PASS (TXT long-page wrap/full tail, deterministic bytes; Markdown/HTML parser boundaries; CSV 172 multiline/quoted rows over multiple pages with header on every page; Italian WinAnsi/unrepresentable Unicode fail closed). Browser/download acceptance is `scripts/acceptance-printable-pdf-256.ts` and requires a current isolated Astro build. The controls above prove subsets of AC1/AC2/AC3 only; do not close full AC without browser render and larger multilingual/page-break corpus. Fidelity exclusions: typography beyond Courier, embedded images/CSS/HTML table semantics, PDF/A, full Unicode font embedding, very wide CSV beyond eight columns, full accessibility tagging and physical-mobile/multi-browser proof.

**2026-10-09 browser update:** `npx tsc --noEmit` PASS; isolated `npx astro build` PASS (285 pages, no generated catalog edits). `npx tsx scripts/acceptance-printable-pdf-256.ts` PASS on Chromium headless at 390×844, downloading and reparsing actual PDFs: TXT 5 pages, CSV 17 pages (header on each; last record present), inert HTML 1 page, actual PDF.js PNG preview 596×842 decoded for each, 0 offsite requests, no HTML script execution, Unicode unsupported fail-closed and no stale download. The result pages' first-page previews are verified, but not the full-page render corpus or physical devices. Ticket remains `ready-for-agent`, the pagination visual-matrix checkbox stays OPEN.
