# 165 — Deterministic JSON repair with ordered edit log

**What to build:** Add bounded JSON repair that never invents semantic values and returns repaired output plus ordered edit spans/reasons; ambiguous cases must refuse.

**Traces to:** US-EXP-05, US-EXP-08; AC-05.1, AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 164 — Structured developer diagnostic envelope.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → security-audit → code-tdd

- [x] Every repair is logged with original input character span/reason.
- [x] Second pass is idempotent for accepted repaired output.
- [x] Ambiguous/deeply malformed input refuses instead of guessing.

**Verification:** `tests/developer-structured-data.test.ts` covers JSONC comments/trailing commas, ordered spans, second-pass idempotence, literal comment markers inside strings and fail-closed ambiguous repair. Shared parser bounds remain enforced before/after repair.
