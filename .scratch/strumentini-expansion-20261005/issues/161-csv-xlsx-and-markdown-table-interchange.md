# 161 — CSV XLSX and Markdown-table interchange

**What to build:** Add local CSV→XLSX, XLSX→CSV sheet selection and Markdown-table→XLSX using one approved lazy spreadsheet parser/writer with explicit text/date/leading-zero policy.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** none; ticket 270's parse/write decision was reopened with an audited replacement stack while faithful Office rendering remains refused.

**Status:** completed (bounded local parse/write core; public catalog handoff remains an integration concern of the spreadsheet-family umbrella)

**Suggested skills:** code-module-design → code-typescript → code-tdd → inclusive-design

- [x] Multi-sheet XLSX requires explicit sheet selection for CSV export.
- [x] Leading zeros/date-like IDs are preserved according to user-selected column policy.
- [x] Generated XLSX reopens independently and heavy parser loads lazily.

**Verification:** Golden workbook corpus, round trips and mobile memory/browser checks.

**Evidence (2026-10-07 refresh):** the old `xlsx@0.18.5` denial is not weakened or reused. A replacement stack is now pinned at `read-excel-file@9.3.10` + `write-excel-file@4.1.1` + `fflate@0.8.3`; all direct/transitive packages in this path are MIT and `npm audit --omit=dev --audit-level=high` reports zero production advisories. `src/engines/table/spreadsheet-interchange.ts` implements CSV→XLSX, Markdown-table→XLSX and XLSX→CSV with default-string cells, explicit number/date policy, strict leading-zero protection and explicit multi-sheet selection. The pinned official ISTAT 3-sheet workbook reopens with `01/001/001001` identifiers preserved; writer output independently reopens through the separate reader package. `src/engines/office-local/*` owns the heavy path in the shared terminable Worker runtime. Standalone Vite evidence is 1.55 KB gzip initial, 12.52 KB gzip lazy client and 54.50 KB gzip lazy worker; `npm run acceptance:office-interchange` proves no Office implementation before user action, three isolated worker runs, zero external requests and no 390px overflow. Focused coverage is `tests/spreadsheet-interchange.test.ts`; consolidated evidence is `quality/benchmarks/heavy-local-feasibility/office-ooxml-refresh-2026-10-07.json`. The existing public handoff refusal test is intentionally not falsified: this tranche supplies the production engine seam, not a fabricated catalog route.
