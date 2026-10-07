# 168 — XML validate format and minify core

**What to build:** Add parser-backed XML validation, prettify and semantic minify with exact error location, no external-entity/network resolution and careful whitespace preservation.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 164 — Structured developer diagnostic envelope.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → security-audit → code-tdd

- [x] XXE/external entity access is disabled.
- [x] Invalid input never produces an optimized-success artifact.
- [x] Text-sensitive whitespace is preserved under the declared minify mode.

**Verification:** `tests/developer-structured-data.test.ts` covers valid/invalid XML, DTD/SYSTEM-entity refusal, unknown entity refusal, structured line/path diagnostics, exact mixed-content preservation, `xml:space=preserve`, prettify and semantic minify.
