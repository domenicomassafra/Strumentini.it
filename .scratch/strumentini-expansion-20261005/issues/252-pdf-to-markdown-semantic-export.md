# 252 — PDF to Markdown semantic export

**What to build:** Add PDF→Markdown from page/text structure with page provenance and loss warnings, handing scanned PDFs to OCR instead of pretending extraction succeeded.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 220, 54.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd

- [x] Page boundaries/provenance are preserved in metadata/output convention.
- [x] No-text/scanned input offers OCR path.
- [x] Layout/table/image losses are declared.

**Verification:** tests/pdf-search-markdown-upgrades.test.ts covers multi-page born-digital export, Markdown metacharacter escaping, no-text/scanned-shaped input, encrypted input and deterministic filename/provenance. scripts/acceptance-pdf-search-markdown.mjs passed at 390px using production pdf-to-markdown + PdfResultV2 and verifies visible provenance markers plus declared table/image/multi-column/style losses. quality/oracles/validate.py passes with cand-254.

**Evidence (2026-10-06):** Added the distinct /tools/pdf-to-markdown job while reusing the ticket-220 page-scoped extractor in content-order mode. Every exported page begins with a deterministic HTML comment carrying URI-encoded source filename + page number. Source Markdown metacharacters are escaped so headings/lists/emphasis/HTML are not invented. No-text input returns no Markdown and an explicit unavailable OCR handoff (ticket 247); encrypted input returns no Markdown. The UI visibly declares that tables, images, multi-column reading order, typography and semantic heading/list structure are not reconstructed.
