# 92 — Migrate TextWriting and list renderers to Result v2

**What to build:** Migrate shared text/list transforms to selectable output, change/count summary, copy/download and validator semantics without changing deterministic text engines.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-09; preserve Unicode/newline semantics.

**Blocked by:** 77, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → inclusive-design → code-tdd → qa-browser

- [x] Assigned text/list ids declare transform/validator result classes.
- [x] Change counts appear only when meaningful.
- [x] Full transformed text remains exact for copy/download.

**Verification:** Text Gold plus Unicode, empty, huge-output and mobile fixtures.

**Evidence:** All 21 ledger-owned ids now declare Result v2 semantics in the generated catalog: 13 `text-code`, 7 `table`, and 1 `validator`. `TextWritingTool`, `ListCompareTool`, and `TextDiffTool` share `TextFamilyResultV2`, which renders semantic primary answers and meaningful breakdowns, uses bounded text/table previews, and resolves truthful copy/download/reuse/retry/reset actions; copy/download serialize the complete UTF-8 result rather than the bounded preview. `tests/text-result-v2.test.ts` proves exact Unicode/newline/CSV bytes, empty output, a 140-line bounded preview with full artifact retention, validator findings, table/list/diff semantics, and removal of the old JSON/manual-panel paths. Focused text/list/inventory/ledger/conformance/legacy tests pass 49/49. Fresh browser acceptance passes for the 15 text-writing Gold routes, list-compare/text-diff, and the four text-writing routes in local-jobs at 390px with keyboard/locality/a11y evidence; the relevant Gold certifications were replayed and remain PASS. The legacy-primary audit has zero findings in ticket-92 renderer files. `npm run catalog:check`, `npm run certification:check`, `npm run result-v2:conformance`, and `npx tsc --noEmit --pretty false` pass.
