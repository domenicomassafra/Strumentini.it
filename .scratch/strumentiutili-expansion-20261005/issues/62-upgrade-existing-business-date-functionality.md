# 62 — Upgrade existing business/date functionality

**What to build:** Deepen current business/date calculators with real user modes, schedules/tables where useful, formula transparency, configurable working calendars/holidays/timezones, scenario comparisons and exports instead of adding duplicate calculators for every wording variation.

**Traces to:** US-EXP-01, US-EXP-03; AC-01.1, AC-03.2; DEC-EXP-01, DEC-EXP-03, DEC-EXP-06; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Existing formulas/Gold remain authoritative until a ticket explicitly changes them; locale/timezone assumptions are always visible.

**Blocked by:** 01, 02, 19, 20, 21, 43.

**Status:** blocked

- [ ] Every existing business/date route gets a concrete mode/assumption/output audit.
- [ ] Date tools support practical inclusive/exclusive, business-calendar and timezone choices where relevant.
- [ ] Business calculators show scenario tables/schedules and export when that helps a decision.

**Verification:** Existing Gold plus scenario/timezone/DST/calendar boundary fixtures and generated route coverage.

