# 220 — Page-scoped PDF text and embedded-image extraction

**What to build:** Upgrade text extraction with page range and reading-order/layout modes plus embedded-image extraction with page/object provenance and original compressed bytes when safely extractable.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.2, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98 — Migrate PdfTool and document renderers to Result v2.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd

- [x] Unsupported image filters are reported, not silently misdecoded.
- [x] Text output has explicit page separators/mode.
- [x] Optional dedupe preserves provenance for every occurrence.

**Verification:** Multi-filter/text-order corpus, DCT byte identity and malformed/encrypted cases.

**Evidence (2026-10-06):** Reused the existing `pdf-text-extraction`/`pdf-image-extractor` routes and oracle IDs `cand-128`/`cand-137`; no new oracle ID was consumed. `extractPdfTextScoped` validates optional page selection, preserves selected-page order, exposes explicit `content-order` and `operator-lines` modes, inserts `===== PAGINA N =====` separators and retains the existing bounded text/filter policy without claiming visual reading-order reconstruction. `extractPdfImagesScoped` walks selected page `Resources/XObject` entries, exports original compressed bytes only for a single validated `DCTDecode` JPEG stream, records page/resource/object provenance, optionally deduplicates repeated indirect objects while retaining all occurrences, and returns structured unsupported-filter records instead of silently skipping Flate/compound/raw cases. The hand-authored `quality/fixtures/pdf-gold/page-scoped-images-metadata.pdf` contains a JPEG object shared across two pages plus a page-local Flate image and multi-string page text; `tests/pdf-extraction-metadata-upgrades.test.ts` proves exact JPEG byte identity, both dedupe modes, page scoping, unsupported-filter disclosure and exact text modes/separators. Focused PDF suites pass 19/19. `node scripts/acceptance-pdf-upgrades.mjs` passes the production-module + production-`PdfResultV2` browser harness for text and image cases with zero external/non-GET/task-body requests and no 390px overflow; evidence is isolated at `.scratch/strumentiutili-expansion-20261005/evidence/pdf-220-318-browser.json` and does not rebind global PDF receipts. `python3 quality/oracles/validate.py` passes.
