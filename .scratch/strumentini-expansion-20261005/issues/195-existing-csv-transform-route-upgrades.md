# 195 — Existing CSV transform-route upgrades

**What to build:** Deepen filter/sort/group/join/pivot/column-select with explicit key/null/type policy, row-count effects, join explosion guard and direct XLSX/JSON/SQL handoffs as targets become available.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 94, 172, 170.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → inclusive-design

- [x] Join explosion is estimated/guarded before materialization.
- [x] Row-count effects and selected keys are visible.
- [x] Handoffs are offered only when compatible targets exist.

**Verification:** Current Gold plus large/join/null/mixed-type corpus.

Evidence (2026-10-06): `estimateTableJoinRows` computes matched/unmatched cardinality, output rows/cells and explosion factor before `joinCsvTables` allocates `outputRows`; joins fail closed when the 100,000-row or 2,000,000-cell result ceiling would be exceeded. Selector/filter/sort/group/join/pivot results now disclose input/output row counts, selected/key column names and explicit case/null/type policy, and TableWorkbench renders those disclosures in the Result v2 summary. The workbench enumerates only `compatibleHandoffTargets`, prioritizing JSON/SQL/XLSX-like conversion targets; current catalog compatibility offers JSON and SQL where descriptor constraints permit, while an XLSX target will appear automatically when a compatible CSV-accepting route exists. `tests/table-transform-upgrade-195.test.ts` executes the six existing data-table Gold vectors read-only, mixed-type/null fixture vectors, property-style join-estimate/cardinality checks, duplicate-key explosion rejection and concrete JSON/SQL compatibility checks; focused suite passes without rewriting receipts.
