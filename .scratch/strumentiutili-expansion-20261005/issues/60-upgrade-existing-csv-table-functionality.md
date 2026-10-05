# 60 — Upgrade existing CSV/table functionality

**What to build:** Deepen every existing CSV/table job beyond Result v2: preview before destructive transforms, dialect/encoding controls, column profiling/filter/sort/group/join/pivot options, large-file strategy, explicit type preservation and export handoffs to XLSX/JSON/SQL.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-05; AC-01.1, AC-04.1, AC-05.1; DEC-EXP-03, DEC-EXP-06; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Preserve current verified RFC/dialect behavior; never silently coerce IDs/dates/numbers; large-file changes need measured memory behavior.

**Blocked by:** 01, 04, 23, 26.

**Status:** blocked

- [ ] Every existing CSV/table route has an explicit functional-upgrade checklist and any missing high-value options implemented or deliberately refused.
- [ ] Join/filter/sort/group/pivot expose key columns, null handling and row-count effects clearly.
- [ ] Cleaner/dedupe/encoding tools provide change previews and exact affected-row counts.
- [ ] Compatible XLSX/JSON/SQL handoffs are available without re-uploading the result.

**Verification:** Existing Gold plus large/messy CSV corpus, type-preservation fixtures, row-count/change assertions and generated route coverage.

