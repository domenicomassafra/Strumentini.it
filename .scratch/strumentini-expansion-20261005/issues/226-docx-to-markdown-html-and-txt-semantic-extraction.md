# 226 — DOCX to Markdown HTML and TXT semantic extraction

**What to build:** Implement one DOCX import direction through normalized document semantics for headings/lists/tables/links/images and recoverable constructs, with a lost/unsupported construct report.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** none; 54 and 225 are complete and provide the normalized text/sanitization and bounded OOXML package seams.

**Status:** completed (bounded semantic extraction; not layout rendering)

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] Tracked/floating/field/macro limitations are disclosed.
- [x] Embedded assets are sanitized and HTML preview is safe.
- [x] Output structure maps deterministically to normalized model.

**Verification:** Independent DOCX corpus, semantic expected tree, package/XSS fixtures.

**Evidence (2026-10-07 downstream):** `extractDocxSemantics` reads `word/document.xml` only after bounded package validation/decompression and maps recoverable paragraphs, Heading1–6, list paragraphs, tables and hyperlink relationships to a deterministic semantic block model, then emits TXT, Markdown and escaped HTML. Embedded image relationships are inventoried with MIME/byte size but their bytes are deliberately not rendered or executed in HTML; external resources are never fetched. Tracked changes, fields, floating anchors, altChunk, footnotes/endnotes and other unsupported layout constructs are surfaced in `unsupportedConstructs`; macro packages are refused before extraction. `tests/office-downstream.test.ts` verifies the corpus semantic output and safe-preview policy. Browser acceptance runs the extractor inside the approved heavy worker and proves the sample text, zero external requests and no 390px overflow. This completion is semantic only and makes no DOCX layout/font fidelity claim.
