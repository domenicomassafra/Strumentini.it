# 149 — FatturaPA batch to table export

**What to build:** Process multiple supported FatturaPA files through the reader into a stable table/CSV export with per-file failure isolation and provenance.

**Traces to:** US-EXP-07; AC-04.1, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None; 79 and 148 are complete.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] One malformed invoice does not suppress valid rows.
- [x] Columns and source filename/schema version are explicit.
- [x] Totals reconcile to each parsed invoice where represented.

**Verification:** Mixed batch corpus, export equality and 390px batch result.

**Evidence (2026-10-06):** `/tools/fatturapa-batch-csv/` reuses the hardened ticket-148 reader for every file and is bound to oracle `cand-259` plus `italy-2026-consumers`. The batch is bounded to 50 files, 5 MiB each and 25 MiB total; each file yields `ok`, `partial` or `error` independently. Export columns include filename, schema family, transmission format, XSD version, invoice identity, represented totals, reconciliation state and error details. Ordinary invoices reconcile represented line totals + represented VAT summary tax to `ImportoTotaleDocumento` when all terms exist; unsupported/simplified reconciliation reports `unavailable` rather than inventing values. The UI previews at most 25 rows while the downloaded UTF-8 CSV contains every row, with formula-like cells protected. Focused tests cover mixed valid/partial/hostile batches and a 30-row preview/export case. The shared browser receipt proves a mixed 3-file run, complete CSV download, 390px layout and zero external/non-GET/task-body requests.
