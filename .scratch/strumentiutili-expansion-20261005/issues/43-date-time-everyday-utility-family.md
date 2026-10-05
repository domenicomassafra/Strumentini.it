# 43 — Date/time everyday utility family

**What to build:** Extend the strong existing date family with missing everyday views: leap-year/day-of-week, printable monthly calendar, world clock, exact-time display, countdown, stopwatch, timer, Pomodoro, duration conversion, and optional seasons/sunrise/sunset/moon-phase jobs only when time/location data requirements are explicit and maintainable.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.2, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-04

**Constraints:** Reuse existing date/time/timezone/holiday engines; local clock utilities must not claim background reliability browsers cannot guarantee.

**Blocked by:** 01.

**Status:** blocked

- [ ] Overlapping jobs reuse existing date/time engines or become modes/aliases instead of duplicates.
- [ ] Timers/stopwatch handle tab suspension honestly and restore from timestamps rather than tick counts.
- [ ] Any astronomical/location-dependent route declares timezone/location assumptions and data source.

**Verification:** DST/timezone/date boundary fixtures, timer suspension/resume tests, printable calendar snapshots, and mobile controls acceptance.

