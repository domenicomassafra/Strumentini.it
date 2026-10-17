MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 31 — OCR and document-scan family

**What to build:** Add local OCR for images/scanned PDFs, text extraction with confidence/page references where the engine exposes them, and a searchable-PDF path that keeps the visual page while adding a selectable text layer when technically reliable.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-04.1, AC-06.1; DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** OCR accuracy is never presented as exact transcription; language packs are lazy; large scans are cancellable and memory-bounded.

**Blocked by:** 246, 247.

**Status:** blocked

- [ ] Italian OCR path works locally with explicit language/quality state.
- [ ] Page/image text is copyable/downloadable with page provenance.
- [ ] Searchable PDF output is verified to contain selectable/searchable text without destroying page appearance beyond accepted tolerance.

**Verification:** Real scan/photo corpus, OCR accuracy/error fixtures, PDF text-layer inspection, bundle/lazy-load receipt, and physical mobile acceptance.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #371, #377, #395.

**Next actionable AC:** Italian OCR path works locally with explicit language/quality state.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
