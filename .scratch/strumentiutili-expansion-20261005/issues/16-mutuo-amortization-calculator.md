# 16 — Mutuo + amortization calculator

**What to build:** Add a mortgage calculator using a documented French-amortization model with payment, total interest, total repaid, amortization schedule and export, plus clear TAN/period assumptions.

**Traces to:** US-EXP-02, US-EXP-03; AC-02.1, AC-03.2; DEC-EXP-03; C-EXP-03, C-EXP-06

**Constraints:** Financial estimate only; do not infer APR/TAEG or fees unless explicitly entered; rounding policy must be stable and disclosed.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] Monthly payment and totals reconcile with the schedule.
- [ ] Zero-rate and very short/long term cases are handled explicitly.
- [ ] Schedule can be downloaded without rendering thousands of rows at once.
- [ ] Formula, periodic rate and rounding policy are visible.

**Verification:** Independent amortization vectors, zero-rate and rounding edge cases, export reconciliation and 390px browser acceptance.
