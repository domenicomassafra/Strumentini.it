# 94 — Migrate TableWorkbench shared path to Result v2

**What to build:** Migrate shared table workbench output to row/column summary, bounded real preview, issue counts, row/column warnings and exports while preserving CSV dialect/type behavior.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-09; no screenshot-as-table and no silent coercion.

**Blocked by:** 77, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → inclusive-design → code-tdd → qa-browser

- [x] All TableWorkbench-owned ids declare table result semantics.
- [x] Wide/long cells remain usable at 390px without page overflow.
- [x] Exports stay complete when preview is bounded.

**Verification:** Data-table Gold plus wide/long/empty/malformed CSV browser fixtures.

Evidence (2026-10-06): the Result v2 migration ledger resolves exactly 17 owner-94 ids (`column-type-profiler`, `csv-column-selector`, `csv-delimiter-detector`, `csv-encoding-fixer`, `csv-filter`, `csv-group-count`, `csv-join`, `csv-pivot-lite`, `csv-sort`, `csv-to-json`, `csv-viewer`, `duplicate-row-profiler`, `json-to-csv`, `missing-value-profiler`, `quick-chart`, `table-transpose`, `tsv-to-csv`). `makeTableManifest` is exclusive to those 17 and now declares `result.class=table` with capability truth derived from real CSV accepts/emits descriptors; the three bespoke CSV ids owned by ticket 95 are not part of this factory migration. `TableWorkbench` now renders Result v2 `summary -> issue-counts -> table-preview` slots, uses a 30-row bounded real table preview, preserves full verified export artifacts separately from the preview, keeps real row/column warning positions when available, and resolves copy/download/reuse/handoff/reset only when declared and runtime-ready. CSV/JSON/SVG/TXT export type behavior and the existing CSV engine/handoff runtime remain unchanged.

Validation: focused table/Result v2/catalog/ledger tests pass 50/50; `npm run result-v2:conformance` passes all 9 semantic classes; `npm run catalog:check` passes after regeneration from the current shared source; `npx tsc --noEmit` and `git diff --check` pass; direct `npx astro build` builds 220 pages. `npm run acceptance:data-table` passes all 17 owner-94 routes and records PASS for a 40-row × 18-column fixture with a 700-character cell at 390px, bounded preview 30/40, complete downloaded row 40/long cell beyond preview, empty table, ragged-row warning, and a same-origin outgoing TableWorkbench handoff with zero task-content leaks. `node scripts/acceptance-table-handoff.mjs` preserves the existing Cleaner→Dedupe flow. `npm run gold:data-table` passes all 17 exact Gold vectors plus specialized fixtures and browser evidence. Legacy-primary audit observed 23 findings before this migration and 3 in the final shared tree due concurrent Result v2 migrations; TableWorkbench itself was not a legacy-audit finding before or after, so the ticket-94-attributable audit delta is truthfully 0 rather than claiming concurrent removals.
