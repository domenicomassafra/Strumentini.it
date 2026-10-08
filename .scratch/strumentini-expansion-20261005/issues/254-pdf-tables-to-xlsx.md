# 254 — PDF tables to XLSX

**What to build:** Detect/select real table regions and export previewed grids to XLSX sheets; never market arbitrary visual pages as Excel reconstruction.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 161, 220, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser

- [ ] User sees extracted grid before export.
- [ ] Page/table provenance is preserved per sheet/table.
- [ ] Non-tabular/ambiguous content is refused or requires selection.

**Verification:** Ruled/unruled/ambiguous table corpus and independent XLSX reopen.
