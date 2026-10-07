# 151 — Ponti and ferie optimizer

**What to build:** Given year, leave-day budget and workweek, rank deterministic bridge opportunities against versioned Italian holidays and show leave days used versus consecutive days gained.

**Traces to:** US-EXP-07, US-EXP-10; AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for calendar year 2026.

**Status:** completed — authoritative 2026 public optimizer

**Suggested skills:** code-module-design → code-tdd

- [x] Optimization uses explicit holiday/workweek set.
- [x] Results expose exact leave days and continuous date interval.
- [x] Custom workweek and fixed/movable holiday/weekend cases are supported.

**Verification:** Easter/fixed-holiday/weekend/custom-workweek fixtures.

**Progress (2026-10-06):** `optimizeItalianBridges` consumes only `ITALY_NATIONAL_HOLIDAYS_2026`, a caller-supplied workweek and an explicit leave-day budget. It ranks deterministic in-year intervals, reports exact leave dates, consecutive days off, holidays in the final expanded interval and source provenance, and does not auto-apply Rome-only/local observances. 2027 and any other unsupported year fail closed instead of reusing the 2026 holiday set. `/tools/ponti-ferie-optimizer/` is bound to `cand-258` and `italy-2026-consumers`; focused tests cover Easter Monday, the 25 April/1 May bridge, custom workweeks and unsupported-year behavior, while 390px browser acceptance proves the public route without task-data network requests or overflow.
