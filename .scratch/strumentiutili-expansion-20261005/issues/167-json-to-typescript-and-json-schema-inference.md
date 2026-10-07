# 167 — JSON to TypeScript and JSON Schema inference

**What to build:** Build one safe deterministic inference module with TypeScript and JSON Schema outputs, explicit inference limitations and poison-key/invalid-identifier handling.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → security-audit → code-tdd

- [x] Arrays/null/heterogeneous values follow documented deterministic inference.
- [x] Generated TypeScript compiles and identifiers are escaped safely.
- [x] Generated schema validates the source example under declared mode.

**Verification:** `tests/developer-structured-data.test.ts` compiles/transpiles emitted TypeScript syntax, checks deterministic root-name normalization, verifies quoted `__proto__`/`constructor` keys without prototype pollution and asserts the generated schema accepts the source example.
