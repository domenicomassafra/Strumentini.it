# 155 — World clock and live deadline surface

**What to build:** Reuse timezone-converter and deadline-countdown engines for a live world-clock/deadline surface derived from timestamps/IANA zones, not accumulated ticks.

**Traces to:** US-EXP-03, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 89 — Migrate date-time shared renderers to Result v2.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] Live world-clock conversion calls the existing DST-aware `convertTimeZone` engine from an absolute UTC instant; it does not introduce a second timezone rule set.
- [x] Both live surfaces derive from `Date.now()` on each refresh and immediately recompute on `visibilitychange`, so a suspended tab catches up instead of accumulating ticks.
- [x] The world-clock surface exposes source timestamp, source/target IANA zones, rendered local time and offset; the deadline surface exposes the exact reference timestamp and deadline state.

**Verification:** Existing timezone engine fixtures cover Europe/Rome DST gap/overlap semantics. `scripts/acceptance-date-time.mjs` additionally observes live timestamp advancement and explicit `visibilitychange` recovery on both existing routes.
