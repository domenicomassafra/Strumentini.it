# 95 — Migrate bespoke CSV and data renderers to Result v2

**What to build:** Migrate CSV/data components outside TableWorkbench to table/batch Result v2 with precise affected-row/column evidence and complete exports.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-09; preserve dialect/encoding/type behavior.

**Blocked by:** 77, 79, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → interaction-design → code-tdd → qa-browser

- [x] Every assigned data id is migrated or no-change with proof.
- [x] Destructive transforms preview/report affected rows.
- [x] Positioned warnings use real row/column evidence.

**Verification:** Data fixtures plus mixed warning/error and large-file representative browser cases.

**Evidence:** csv-cleaner, csv-column-map, and csv-dedupe declare table Result v2 and render through CsvTableResultV2 with bounded parsed-table previews, complete verified CSV downloads, copy/reset/handoff actions, affected-row/column metrics, and row-positioned parser warnings. The table expansion and handoff suites pass 27/27. Browser acceptance passes Cleaner to Dedupe transfer, Dedupe/ColumnMap keyboard/mobile/locality, a positioned ragged-row warning, and a 50,000-row cleaner case with an 8-row bounded preview, no overflow, reset, and zero task-content network leakage. Result v2 conformance remains 9/9 classes and the legacy-primary detector reports none of these three components.
