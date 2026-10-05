# 33 — PDF conversion/productivity family

**What to build:** Add/search-proof the productivity gaps: search text across many PDFs with file/page/context hits, split by maximum output size, n-up pages per sheet, booklet imposition, front/back interleave, PDF→Markdown, table extraction→CSV/XLSX, and PDF↔Office conversion only for formats/fidelity proven by the feasibility spike.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-05.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Conversion fidelity is measured per job; no blanket "almost 100% accurate" claim; searchable-text jobs distinguish born-digital PDF from OCR-required scans.

**Blocked by:** 01, 05, 23, 34.

**Status:** blocked

- [ ] Multi-PDF search returns file/page/context and isolates unreadable/encrypted failures.
- [ ] Split-by-size guarantees each produced part respects the requested ceiling or explains why impossible.
- [ ] N-up/booklet/interleave outputs have page-order fixture proofs.
- [ ] Any Office conversion route has a documented fidelity corpus and unsupported-feature list.

**Verification:** PDF corpus covering text/tables/scans/encryption/page geometry; output page/order/size assertions; conversion fidelity receipts.

