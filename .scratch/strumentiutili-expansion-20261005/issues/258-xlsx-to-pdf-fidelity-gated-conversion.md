# 258 — XLSX to PDF fidelity-gated conversion

**What to build:** Implement worksheet→PDF only on approved local rendering stack with sheet/range selection, orientation/fit and clear print-layout limitations.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 161, 206, 270.

**Status:** completed

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [x] **REFUSED for production implementation:** ticket 270 keeps faithful Office rendering at `REFUSE_UNPROVEN`; the bounded XLSX parse/write seam does not authorize spreadsheet print rendering.
- [x] No sheet/range print-layout UI or unsupported-formatting promise is exposed without an approved renderer.
- [x] No PDF page-count/layout success claim is made without independent render verification.

**Verification:** Closed as a refusal downstream of ticket 270. Reopen only after an approved local spreadsheet renderer passes workbook fidelity and print-geometry acceptance.
