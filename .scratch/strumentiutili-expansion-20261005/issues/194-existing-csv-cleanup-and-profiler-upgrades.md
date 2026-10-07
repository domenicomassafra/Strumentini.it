# 194 — Existing CSV cleanup and profiler upgrades

**What to build:** Deepen viewer/delimiter/encoding/cleaner/dedupe/profile routes with explicit dialect/encoding, before→after preview and exact affected-row/cell counts.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 95 — Migrate bespoke CSV and data renderers to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] Current delimiter/quoting behavior remains compatible and viewer/detector/cleaner/dedupe outputs expose explicit delimiter + UTF-8 dialect metadata.
- [x] Parsing continues to use Papa Parse with `dynamicTyping: false`; cell values remain strings and no silent coercion was introduced.
- [x] Non-semantic cleaner/encoding transforms report zero changed cell values plus exact BOM/record-break/replacement counts; dedupe reports exact removed rows and removed-cell count; inspection-only viewer/detector paths explicitly report zero affected rows/cells.

**Verification:** `tests/table-expansion.test.ts` covers semicolon/tab/pipe dialects, BOM + CRLF normalization, UTF-16LE decoding and exact dedupe row/cell counts. `tests/table-result-v2.test.ts` verifies bounded previews and complete output while retaining explicit dialect metadata; existing table Gold remains the regression baseline.
