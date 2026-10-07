# 238 — PDF page numbers placement and ranges

**What to build:** Add page-number insertion with page range, position, offset/start number, font/size/margins and preview based on shared page thumbnails.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Selected range and numbering start are previewed before write.
- [ ] Existing page content remains unchanged outside overlay insertion.
- [ ] Output pages/count/signature and visual placement are verified.

**Verification:** Multi-page/range/position corpus and rendered visual checks.
