# 178 — Regex execution isolation and hard timeout

**What to build:** Move regex test execution behind a bounded worker seam with max pattern/input/results, cancellation and timeout so adversarial patterns cannot freeze the UI beyond current heuristic filtering.

**Traces to:** US-EXP-05; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91, 101.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-typescript → code-tdd → inclusive-design

- [x] Timeout/abort is distinct from invalid-regex error.
- [x] Benign existing semantics remain unchanged.
- [x] Adversarial ReDoS corpus cannot block the main UI thread.

**Verification:** ReDoS patterns, large text, cancellation and benign regression fixtures.

**Evidence (2026-10-06):** Regex execution now runs in a dedicated module worker with a 750 ms hard timeout, AbortSignal termination and pre-worker pattern/input bounds. `tests/regex-worker-client.test.ts` proves success, timeout, cancellation and oversized-input behavior. Fresh `acceptance:developer-web` exercised `^(a|aa)+$` against a catastrophic non-match in Chromium, observed the worker request and timeout state, then successfully ran a benign regex in the same route; `gold:developer-web`, `npx tsc --noEmit` and the focused developer tests pass.
