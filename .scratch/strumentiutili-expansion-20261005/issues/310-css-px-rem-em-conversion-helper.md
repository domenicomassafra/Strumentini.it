# 310 — CSS px rem em conversion helper

**What to build:** Add px↔rem and contextual em conversion with explicit root/current font-size inputs and no hidden browser-default assumption.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-tdd → inclusive-design

- [x] rem conversion refuses execution without an explicit positive root font-size and returns that root size in the result assumptions; no browser/default 16px value is inferred.
- [x] em conversion likewise requires and reports an explicit positive current-context font-size.
- [x] px↔rem/em uses exact rational multiplication/division and states the shared at-most-12-decimal display precision policy, so round trips are deterministic within that display policy.

**Verification:** `tests/unit-conversion.test.ts` covers 32px↔2rem at explicit 16px root, contextual em round trips, missing context refusal and zero/negative context rejection.
