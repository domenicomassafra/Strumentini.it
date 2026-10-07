# 197 — File folder manifest and checksum workflow upgrades

**What to build:** Deepen folder/file inventory, compare, hash/checksum and manifest tools with richer file tables, JSON/CSV exports and verification handoffs without reselecting source data when safe.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 96, 102.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → inclusive-design

- [x] Inventory/compare/checksum outputs use sanitized relative paths plus byte size and, where requested, SHA-256/status. Duplicate source paths after sanitization fail closed instead of silently overwriting one another.
- [x] `client-handoff-index-generator` emits a versioned JSON manifest (`local-utility-handoff-index-v1`) plus Markdown; paths are sanitized and checksum manifests are bounded before export.
- [x] Handoff identity consists of path/size/type/timestamps and optional SHA-256 rather than file content; tests prove source content is absent from the JSON/Markdown handoff while hash identity remains available for verification.

**Verification:** `tests/file-privacy-engine.test.ts` covers portable checksum creation/verification, hash mismatches, relative-path compare, sanitized-path collision refusal, source-identity JSON/Markdown handoff without content leakage, traversal rejection and bounded cancellation. Existing file/privacy Result v2 tests verify complete-download versus bounded-preview behavior.
