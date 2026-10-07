# 68 — DOCX/PPTX/XLSX OOXML compressor

**What to build:** Add local file-size reducers for modern Office OOXML packages by inspecting the ZIP package, recompressing/resizing embedded raster media when chosen, rebuilding with real DEFLATE compression, and preserving the editable document/presentation/workbook structure.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Modern `.docx/.pptx/.xlsx` only unless legacy formats get a separate proven parser; macro-enabled packages are refused or preserved without unsafe mutation until explicitly audited; no claim that text/XML itself can always shrink materially.

**Blocked by:** 225, 264.

**Status:** blocked

- [ ] DOCX/PPTX/XLSX analysis shows package size by media/XML/fonts/other before modification.
- [ ] Compression profiles can optimize embedded JPG/PNG/WebP-compatible media and optionally cap oversized image dimensions while keeping relationships intact.
- [ ] Output OOXML package reopens in independent parsers and preserves document/slide/sheet counts and relationships.
- [ ] Result shows source/result bytes, savings %, media changed/skipped and any fidelity warning.

**Verification:** Real OOXML corpus with images/tables/charts/fonts/links, ZIP/relationship validation, independent reopen tests, visual/semantic spot checks and mobile-memory receipt.
