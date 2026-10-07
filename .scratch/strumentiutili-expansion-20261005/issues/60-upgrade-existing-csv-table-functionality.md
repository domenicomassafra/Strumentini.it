# 60 — Upgrade existing CSV/table functionality

**What to build:** Deepen every existing CSV/table job beyond Result v2: preview before destructive transforms, dialect/encoding controls, column profiling/filter/sort/group/join/pivot options, large-file strategy, explicit type preservation and export handoffs to XLSX/JSON/SQL.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-05; AC-01.1, AC-04.1, AC-05.1; DEC-EXP-03, DEC-EXP-06; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Preserve current verified RFC/dialect behavior; never silently coerce IDs/dates/numbers; large-file changes need measured memory behavior.

**Blocked by:** 172, 194, 195.

**Status:** completed

- [x] Every existing CSV/table route has an explicit functional-upgrade checklist and any missing high-value options implemented or deliberately refused.
- [x] Join/filter/sort/group/pivot expose key columns, null handling and row-count effects clearly.
- [x] Cleaner/dedupe/encoding tools provide change previews and exact affected-row counts.
- [x] Compatible XLSX/JSON/SQL handoffs are available without re-uploading the result.

**Verification:** Existing Gold plus large/messy CSV corpus, type-preservation fixtures, row-count/change assertions and generated route coverage.

Evidence (2026-10-07): `quality/functional-audit/csv-table-upgrade-checklist.json` covers all 25 current `table-csv` / `table-operations` catalog routes. The original routes retain their original-200 audit records; `csv-to-sql`, `csv-splitter`, `table-compare`, `fatturapa-reader` and `fatturapa-batch-csv` trace to their later implementation tickets 170–172 and 148–149. Ticket 195 supplies explicit key/null/type and row-count disclosure for filter/sort/group/join/pivot; ticket 194 supplies exact cleaner/dedupe/encoding effects. The result surfaces show exact affected row/cell counts plus encoding text-change counts. Handoffs use `compatibleHandoffTargets` and the real runtime transport ceiling: JSON is offered when a CSV table descriptor is accepted; SQL is offered only when its unique-header constraint is satisfied. The current generated handoff catalog contains no XLSX target, so XLSX remains explicitly `REFUSED_NO_TARGET_IN_CURRENT_CATALOG`; no synthetic handoff is invented. `tests/csv-table-upgrade-60.test.ts` proves complete current-route coverage, audit/ticket linkage, exact change effects and real JSON/SQL/XLSX compatibility/refusal behavior.
