# 21 — Personal-finance calculator family

**What to build:** Add common deterministic personal-finance calculators such as simple/compound interest, savings goal, installment/loan scenarios, unit price, subscription cost and trip/energy cost, with formula-first transparency.

**Traces to:** US-EXP-03; AC-03.2; DEC-EXP-03, DEC-EXP-07; C-EXP-06

**Constraints:** Results are scenarios, not financial advice; fees/taxes/inflation are included only when explicitly modeled; currency rounding policy is stable.

**Blocked by:** 145, 146, 147.

**Status:** completed

- [x] Tickets 145–147 state modeled inputs, cadence/work assumptions and omitted costs; ticket 146 includes fees only when explicitly entered and never invents TAEG/taxes/insurance.
- [x] Interest, loan and everyday-cost outputs pair the primary answer with period/total breakdowns or exact cost components where relevant.
- [x] Reverse savings-goal modes expose cadence assumptions and fail closed for infeasible/invalid goals.
- [x] Shared business-math rational/money and amortization primitives are reused across routes instead of duplicating formulas.

**Verification:** `tests/calculator-math-core.test.ts` and `tests/business-math-expansion.test.ts` cover independent literals, zero/negative/boundary cases, cent reconciliation and locale/currency behavior; the scoped 390px BusinessMath browser acceptance covers answer-first rendering and complete downloadable amortization output.
