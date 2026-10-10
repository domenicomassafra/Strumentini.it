# 33 — PDF conversion/productivity family

**What to build:** Finish the PDF productivity jobs that remain after the detailed compression/page/conversion tickets: search text across many PDFs, split by maximum output size, n-up pages per sheet, booklet imposition and front/back interleave, then integrate the outputs/handoffs from tickets 51–58 without duplicating their engines.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-05.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Conversion fidelity is measured per job; no blanket "almost 100% accurate" claim; searchable-text jobs distinguish born-digital PDF from OCR-required scans.

**Blocked by:** 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260.

**Status:** ready-for-agent

- [ ] Multi-PDF search returns file/page/context and isolates unreadable/encrypted failures.
- [ ] Split-by-size guarantees each produced part respects the requested ceiling or explains why impossible.
- [ ] N-up/booklet/interleave outputs have page-order fixture proofs.
- [ ] Conversion routes from tickets 56–58 are surfaced consistently without parallel implementations.

**Verification:** PDF corpus covering text/tables/scans/encryption/page geometry; output page/order/size assertions; conversion fidelity receipts.
