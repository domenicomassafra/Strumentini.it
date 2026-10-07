# 172 — Table compare by explicit keys and columns

**What to build:** Compare two tables into added/removed/changed rows with explicit key, null and case policy and bounded downloadable diff.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 94 — Migrate TableWorkbench shared path to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] Duplicate-key ambiguity is detected and surfaced.
- [x] Changed cells retain row/key/column provenance.
- [x] Large result uses bounded preview and complete export.

**Verification:** Independent keyed-table fixtures including duplicates/null/case modes.

Evidence (2026-10-06): `compareCsvTables` indexes only explicit keys, reports duplicate-key ambiguity without arbitrary pairing, applies explicit case/NULL policy and stores key plus left/right row and column provenance on every changed cell. TableWorkbench Result v2 renders at most 30 diff rows while the download artifact retains the complete CSV diff; focused tests prove duplicate/null/case behavior and a 45-row changed result with 30-row preview plus complete export.
