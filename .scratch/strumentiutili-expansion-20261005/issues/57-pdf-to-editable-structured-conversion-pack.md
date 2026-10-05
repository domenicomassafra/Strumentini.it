# 57 — PDF-to-editable/structured conversion pack

**What to build:** Add truthful PDF outbound conversions: PDF→Markdown, PDF→DOCX semantic reconstruction, PDF tables→XLSX, and PDF→PPTX page-as-slide baseline; allow editable reconstruction modes only where a fidelity corpus proves them, with OCR handoff for scans.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-05.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Never sell arbitrary visual PDF→XLSX as a spreadsheet; table extraction is table extraction. Page-as-slide PPTX is distinct from editable object reconstruction. Scanned PDFs require OCR and must say so.

**Blocked by:** 31, 34, 55.

**Status:** blocked

- [ ] PDF→MD/DOCX includes page provenance and structure-loss warnings.
- [ ] PDF→XLSX operates on detected/selected tables and previews extracted grids before export.
- [ ] PDF→PPTX baseline preserves each page visually as a slide; any editable mode is separately labelled/proven.

**Verification:** Born-digital/scanned/mixed PDF corpus, semantic/table fidelity metrics, OCR handoff tests, OOXML output validation.

