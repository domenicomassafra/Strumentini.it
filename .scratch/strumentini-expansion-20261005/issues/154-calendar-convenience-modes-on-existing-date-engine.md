# 154 — Calendar convenience modes on existing date engine

**What to build:** Reuse existing date primitives for leap-year/day-of-week and printable monthly calendar output rather than creating duplicate date arithmetic engines.

**Traces to:** US-EXP-03, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 89 — Migrate date-time shared renderers to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] Gregorian century/leap rules and ISO weekday mapping reuse the canonical UTC calendar primitives.
- [x] Printable month reuses the existing date engine, starts weeks on Monday and exposes Italian month/day labels plus deterministic printable text.
- [x] The existing `calendar-date-list-generator` route was extended; no duplicate date-difference/countdown implementation or route was introduced.

**Verification:** `tests/date-time-engine.test.ts` covers 1900/2000/2100 leap boundaries, 2024-02-29 weekday, February 2024 month-start/weeks and complete printable snapshot; module tests cover all four modes.
