# 156 — Timer stopwatch and Pomodoro resilient clock

**What to build:** Build shared timestamp-based timer/stopwatch/Pomodoro state with pause/resume/reset and reload/tab-suspension recovery, explicitly documenting browser background limitations.

**Traces to:** US-EXP-03

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 72 — Result operation state model with partial and warning.

**Status:** completed

**Suggested skills:** interaction-design → code-module-design → code-tdd → qa-browser

- [x] Shared timer/stopwatch/Pomodoro state derives elapsed/remaining duration from absolute timestamps, never accumulated UI ticks.
- [x] Pause/resume/reset and serialized local-browser state restore deterministically; browser acceptance proves reload recovery.
- [x] UI refreshes from `Date.now()` and on `visibilitychange`, and explicitly states browser background-throttling limitations, so suspended time is recovered rather than silently lost.

**Verification:** `tests/resilient-clock.test.ts` uses fixed timestamps for long gaps, pause/resume/reset and serialization; `scripts/acceptance-date-time.mjs` observes runtime progression, visibility recovery and reload restoration in Chromium.
