# 164 — Structured developer diagnostic envelope

**What to build:** Fix the developer error boundary so validators/formatters can preserve stable Italian error code plus line/column/character/path/context instead of dropping precise parser details.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → code-tdd

- [x] JSON malformed input surfaces line, column, character, path and bounded context from the parser.
- [x] Shared `DeveloperErrorEnvelope` / `DeveloperDiagnostic` preserves structured parser details without exposing a raw stack.
- [x] Existing stable error codes remain compatible.

**Verification:** `tests/developer-web-engine.test.ts` checks exact malformed JSON diagnostic fields and verifies no stack text leaks into the envelope.
