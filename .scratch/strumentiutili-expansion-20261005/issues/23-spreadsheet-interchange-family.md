# 23 — Spreadsheet interchange family

**What to build:** Add local spreadsheet/structured-data interchange centered on CSV↔XLSX, XML↔JSON/CSV/XLSX where representable, Markdown tables→XLSX and large-CSV splitting with schema-preserving controls.

**Traces to:** US-EXP-04; AC-04.1, AC-05.1; DEC-EXP-01, DEC-EXP-05; C-EXP-05, C-EXP-08

**Constraints:** Preserve leading zeros/text intentionally; sheet selection and encoding choices are explicit; heavy parsers are lazy and bounded.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] CSV→XLSX offers column text-preservation controls and proves them with fixtures.
- [ ] XLSX→CSV requires explicit sheet choice for multi-sheet files.
- [ ] XML conversions reject/describe non-tabular structures rather than flatten silently.
- [ ] Large CSV splitting repeats headers and proves byte/row reconstruction.

**Verification:** Golden file round trips, leading-zero/date-like fixtures, malformed input tests, memory-size guidance and browser acceptance.
