# 323 — URL normalize compare and bulk transform upgrade

**What to build:** Deepen URL normalization/comparison/bulk tools with explicit canonicalization switches, before→after diff and isolated failures without performing network requests.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 99 — Migrate URL marketing QR and bespoke results to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Each normalization rule is explicit/toggleable where semantics can differ.
- [x] Bulk results retain source index/source row, before→after output and failure reason.
- [x] Local transform explicitly reports network: "not-used" / local-transform-only and does not imply redirect/canonical verification.

**Verification:** tests/url-marketing-upgrades.test.ts plus the existing URL fixture suite cover query/path/tracking switches and isolated failures; scripts/acceptance-url-marketing-upgrades.mjs verifies toggle-driven bulk output, source-row diagnostics and local-only scope in the real component.

**Evidence:** The existing url-comparison and url-bulk-normalizer routes now expose the shared engine rules rather than adding aliases for modes.
