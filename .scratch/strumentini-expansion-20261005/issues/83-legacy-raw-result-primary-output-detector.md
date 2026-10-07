# 83 — Legacy raw-result primary-output detector

**What to build:** Add a static audit for live primary-result uses of raw JSON, generic JSON serialization and manual result-panel paths so migration cannot be claimed merely by using ToolResultPanel.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2; DEC-EXP-03

**Constraints:** C-EXP-01, C-EXP-09; optional raw/debug representations stay allowed.

**Blocked by:** 82 — Renderer-seam migration ledger for all 200 tools.

**Status:** completed

**Suggested skills:** code-architecture-review → code-typescript → code-tdd

- [x] Audit reports exact callers and path class.
- [x] Seeded raw-primary callers are caught.
- [x] Final mode can require zero primary generic fallbacks.

**Verification:** Static-analysis fixtures for forbidden primary and allowed secondary raw views.

**Evidence:** tests/legacy-result-primary.test.ts catches forbidden primary raw/generic/manual paths while allowing secondary raw views; result-v2:legacy-zero now reports 0 findings.
