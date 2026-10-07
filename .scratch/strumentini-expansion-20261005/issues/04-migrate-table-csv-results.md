# 04 — Migrate table/CSV results

**What to build:** Migrate the 20 existing `table-operations` (17) and `table-csv` (3) tools to Result v2 with real table previews, row/column summaries, issue counts, per-row warnings/errors where needed, and explicit export/download actions.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-01.2, AC-04.1, AC-05.1; DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-09

**Constraints:** Preserve CSV dialect/encoding behavior and existing fixtures; no screenshot-as-table presentation.

**Blocked by:** 94, 95.

**Status:** completed

- [x] 20/20 engine entries are covered by a table/result declaration.
- [x] Outputs show rows/columns and a bounded real preview before raw serialization.
- [x] Errors identify the affected row/column when the engine can determine it.

**Verification:** Generated 20/20 coverage proof, existing data-table Gold suite, and mobile/browser tests with wide/long cells.

**Evidence:** child tickets 94 and 95 are completed: all 17 TableWorkbench and 3 bespoke CSV ids declare table semantics. Data-table Gold/browser acceptance covers wide/long/ragged/empty/full-download cases and shared handoff; bespoke CSV browser acceptance covers positioned ragged warnings and a 50,000-row bounded preview with complete download/reset behavior.
