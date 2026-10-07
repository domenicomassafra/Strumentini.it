# 16 — Mutuo + amortization calculator

**What to build:** Add a mortgage calculator using a documented French-amortization model with payment, total interest, total repaid, amortization schedule and export, plus clear TAN/period assumptions.

**Traces to:** US-EXP-02, US-EXP-03; AC-02.1, AC-03.2; DEC-EXP-03; C-EXP-03, C-EXP-06

**Constraints:** Financial estimate only; do not infer APR/TAEG or fees unless explicitly entered; rounding policy must be stable and disclosed.

**Blocked by:** 88 — Migrate BusinessMathTool renderer to Result v2.

**Status:** completed

- [x] Monthly payment and totals reconcile with the schedule.
- [x] Zero-rate and very short/long term cases are handled explicitly.
- [x] Schedule can be downloaded without rendering thousands of rows at once.
- [x] Formula, periodic rate and rounding policy are visible.

**Verification:** Independent amortization vectors, zero-rate and rounding edge cases, export reconciliation and 390px browser acceptance.

**Evidence (2026-10-06):** `tests/business-math-expansion.test.ts` verifies independent one-year, zero-rate, single-payment and 100-year French-amortization literals; every schedule reconciles principal, interest, total paid and zero ending balance, including the exported CSV row count. `scripts/acceptance-business-math-expansion.mjs` passed against the built site at 390px with an 8-row bounded preview, a 240-row CSV download plus header, final balance `0.00`, and no external/write task request. The Result v2 view exposes TAN, monthly periodic rate, the annuity formula, half-up cent rounding and the explicit exclusion of TAEG/fees.
