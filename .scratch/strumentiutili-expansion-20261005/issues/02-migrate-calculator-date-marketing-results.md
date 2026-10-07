# 02 — Migrate calculator/date/marketing results

**What to build:** Migrate the 44 existing tools in `business-math` (16), `date-time` (19), `marketing-math` (3), `client-time-math` (3), and `campaign-url` (3) to Result v2 so calculations lead with the answer and interpretation, then show breakdown/formula/assumptions/actions.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2, AC-01.3; DEC-EXP-03; C-EXP-01, C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Preserve existing numeric behavior and Gold vectors; this ticket changes presentation/interaction, not formulas.

**Blocked by:** 88, 89, 90.

**Status:** completed

- [x] All 44 engine entries have explicit calculator/date/result semantics rather than generic object dumping.
- [x] Currency, units, dates, formulas and assumptions use Italian formatting and human labels.
- [x] Copy/export exists only where meaningful and never hides the primary answer.

**Verification:** Generated 44/44 coverage assertion plus current Gold tests and browser/mobile checks for representative calculators and date tools.

**Evidence:** child tickets 88, 89 and 90 are completed. Inventory ownership totals 16 business + 18 shared date-time + 10 bespoke/date-marketing ids for 44/44 declared semantics. Business/date/campaign/client-time Gold suites and their browser/mobile/locality lanes pass; Result v2 answer-first/action semantics remain conformance-green.
