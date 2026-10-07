# 43 — Date/time everyday utility family

**What to build:** Extend the strong existing date family with missing everyday views: leap-year/day-of-week, printable monthly calendar, world clock, exact-time display, countdown, stopwatch, timer, Pomodoro, duration conversion, and optional seasons/sunrise/sunset/moon-phase jobs only when time/location data requirements are explicit and maintainable.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.2, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-04

**Constraints:** Reuse existing date/time/timezone/holiday engines; local clock utilities must not claim background reliability browsers cannot guarantee.

**Blocked by:** 154, 155, 156, 311.

**Status:** completed

- [x] Leap-year/day-of-week/month calendar, world clock and live deadline were added as modes/surfaces on the existing date/time routes rather than duplicate date engines.
- [x] Timer/stopwatch/Pomodoro state derives from absolute timestamps, persists locally, and catches up on `visibilitychange`/reload instead of trusting background tick counts.
- [x] Ticket 311 deliberately REFUSES astronomical/location-dependent routes until a versioned maintainable local algorithm/source pack exists; therefore no route silently omits timezone/location/source assumptions.

**Verification:** Date/time engine and module suites cover DST boundaries, leap/weekday/month snapshots and deterministic countdown semantics; `tests/resilient-clock.test.ts` plus `scripts/acceptance-date-time.mjs` cover suspension/reload behavior. Ticket311 supplies the primary-source feasibility evidence for the refused astronomy branch.
