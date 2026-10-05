# 04 — Migrate table/CSV results

**What to build:** Migrate the 20 existing `table-operations` (17) and `table-csv` (3) tools to Result v2 with real table previews, row/column summaries, issue counts, per-row warnings/errors where needed, and explicit export/download actions.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-01.2, AC-04.1, AC-05.1; DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-09

**Constraints:** Preserve CSV dialect/encoding behavior and existing fixtures; no screenshot-as-table presentation.

**Blocked by:** 01 — Expand Result System v2 primitives.

**Status:** blocked

- [ ] 20/20 engine entries are covered by a table/result declaration.
- [ ] Outputs show rows/columns and a bounded real preview before raw serialization.
- [ ] Errors identify the affected row/column when the engine can determine it.

**Verification:** Generated 20/20 coverage proof, existing data-table Gold suite, and mobile/browser tests with wide/long cells.

