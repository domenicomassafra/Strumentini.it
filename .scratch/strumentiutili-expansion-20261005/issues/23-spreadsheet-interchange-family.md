# 23 — Spreadsheet interchange family

**What to build:** Add local spreadsheet/structured-data interchange centered on CSV↔XLSX, XML↔JSON/CSV/XLSX where representable, Markdown tables→XLSX and large-CSV splitting with schema-preserving controls.

**Traces to:** US-EXP-04; AC-04.1, AC-05.1; DEC-EXP-01, DEC-EXP-05; C-EXP-05, C-EXP-08

**Constraints:** Preserve leading zeros/text intentionally; sheet selection and encoding choices are explicit; heavy parsers are lazy and bounded.

**Blocked by:** None — 161, 169 and 171 are complete.

**Status:** completed

- [x] CSV→XLSX offers column text-preservation controls and proves them with fixtures.
- [x] XLSX→CSV requires explicit sheet choice for multi-sheet files.
- [x] XML conversions reject/describe non-tabular structures rather than flatten silently.
- [x] Large CSV splitting repeats headers and proves byte/row reconstruction.

**Verification:** Golden file round trips, leading-zero/date-like fixtures, malformed input tests, memory-size guidance and browser acceptance.

**Closure evidence (2026-10-07):** `tests/spreadsheet-interchange.test.ts` proves default-text preservation for `00123` and date-like strings, explicit number/date column policies, explicit multi-sheet selection, Markdown→XLSX reopen and the pinned ISTAT workbook's leading-zero administrative codes. `tests/xml-interchange.test.ts` proves deterministic XML→JSON/CSV/XLSX mappings and ambiguity refusal. `tests/table-advanced-operations.test.ts` proves header-preserving CSV split reconstruction, byte-mode splitting, cancellation and a 48 MiB-class bounded parser buffer. The heavy XLSX path is lazy and browser-bounded by the ticket-161 acceptance evidence.
