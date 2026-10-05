# 24 — Office/Markdown productivity family

**What to build:** Integrate the detailed document-conversion work into the broader Office productivity surface, then add the remaining non-conversion jobs: Office viewers, metadata cleanup, embedded-image compression, VCF→CSV, EML/MSG inspection and EPUB reading/export where the feasibility gate approves them.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2, AC-06.1; DEC-EXP-05; C-EXP-05, C-EXP-08

**Constraints:** Do not ship a parser/converter merely because a library exists; preserve document semantics only within declared scope; password removal requires a user-supplied password and supported format.

**Blocked by:** 23 — spreadsheet interchange; 34 — feasibility refresh; 55 — DOCX semantic conversions; 56 — Office/PDF printable export.

**Status:** blocked

- [ ] Detailed DOCX/Markdown/PDF conversion logic is consumed from tickets 55/56 rather than reimplemented here.
- [ ] Each remaining accepted viewer/metadata format has a declared supported-feature matrix.
- [ ] Heavy dependencies load only on relevant routes after explicit file selection/action.
- [ ] Metadata cleanup reports what was removed and re-inspects output.
- [ ] Unsupported document features survive where possible or trigger a clear warning.

**Verification:** Representative DOCX/ODT/PPTX/ODP fixtures, output re-open tests, dependency/bundle gate and mobile memory acceptance.
