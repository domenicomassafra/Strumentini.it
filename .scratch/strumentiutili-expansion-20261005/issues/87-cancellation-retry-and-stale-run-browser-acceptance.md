# 87 — Cancellation retry and stale-run browser acceptance

**What to build:** Add a controlled slow-operation fixture proving cancel→retry, double-submit protection, late completion suppression, error recovery and input preservation.

**Traces to:** US-EXP-01, US-EXP-06; AC-01.3, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04; no timing-only flaky assertions.

**Blocked by:** 72, 73, 75.

**Status:** completed

**Suggested skills:** interaction-design → qa-browser → code-tdd

- [x] Cancel leaves no stale success.
- [x] Retry can succeed without re-entering valid input.
- [x] Double submit cannot create competing visible completions.
- [x] Recovery returns focus/status predictably.

**Verification:** Deterministic delayed executor with controlled completion order in browser.

**Evidence:** acceptance:result-operation passes deterministic double-submit, cancel, stale completion suppression, retry without re-entry and error-focus recovery; shared recovery focus now runs in layout effect.
