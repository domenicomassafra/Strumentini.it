# 24 — Office/Markdown productivity family

**What to build:** Integrate the detailed document-conversion work into the broader Office productivity surface, then add the remaining non-conversion jobs: Office viewers, metadata cleanup, embedded-image compression, VCF→CSV, EML/MSG inspection and EPUB reading/export where the feasibility gate approves them.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2, AC-06.1; DEC-EXP-05; C-EXP-05, C-EXP-08

**Constraints:** Do not ship a parser/converter merely because a library exists; preserve document semantics only within declared scope; password removal requires a user-supplied password and supported format.

**Blocked by:** 56, 264.

**Status:** blocked (accepted/refused non-rendering Office matrix integrated; PDF-print and embedded-media compression remain unresolved)

Direct jobs 162/163/226/227/261 are complete; 262/263 are completed refusals downstream of 275. Ticket 56 remains unresolved and ticket 264 has no approved image-codec path.

- [ ] Detailed DOCX/Markdown/PDF conversion logic is consumed from tickets 55/56 rather than reimplemented here. (DOCX/Markdown is complete via 55; ticket 56 is still blocked.)
- [x] Each remaining accepted viewer/metadata format has a declared supported-feature matrix.
- [x] Heavy dependencies load only on relevant routes after explicit file selection/action.
- [x] Metadata cleanup reports what was removed and re-inspects output.
- [x] Unsupported document features survive where possible or trigger a clear warning.

**Verification:** Representative DOCX/ODT/PPTX/ODP fixtures, output re-open tests, dependency/bundle gate and mobile memory acceptance.

**Evidence / accepted-refused matrix (2026-10-07):** accepted bounded paths are VCF→CSV (162), OOXML metadata cleanup (163), DOCX semantic extract/generate (226/227 via umbrella 55) and read-only DOCX/XLSX/PPTX structure inspection (261). EML/MSG (262) and EPUB (263) remain deliberate **REFUSE** decisions from feasibility ticket 275; no parser is shipped to satisfy catalog count. Faithful Office rendering remains refused by ticket 270, including the PPTX raster half of 260. Embedded-image recompression is **not claimed implemented**: ticket 264 still depends on blocked codec tickets 207/208/268, so it remains outside the accepted matrix until an approved codec/mobile path exists. Ticket 56 also remains blocked, so this family umbrella cannot truthfully close yet. Office lazy worker/browser evidence is `quality/receipts/office-downstream/browser-acceptance.json` (8 isolated workers, zero external requests, 390px no overflow).

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #368, #392.

**Next actionable AC:** Detailed DOCX/Markdown/PDF conversion logic is consumed from tickets 55/56 rather than reimplemented here. (DOCX/Markdown is complete via 55; ticket 56 is still blocked.). The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
