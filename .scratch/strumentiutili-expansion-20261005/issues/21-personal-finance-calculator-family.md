# 21 — Personal-finance calculator family

**What to build:** Add common deterministic personal-finance calculators such as simple/compound interest, savings goal, installment/loan scenarios, unit price, subscription cost and trip/energy cost, with formula-first transparency.

**Traces to:** US-EXP-03; AC-03.2; DEC-EXP-03, DEC-EXP-07; C-EXP-06

**Constraints:** Results are scenarios, not financial advice; fees/taxes/inflation are included only when explicitly modeled; currency rounding policy is stable.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] Each calculator states modeled inputs and omitted real-world costs.
- [ ] Primary answer is paired with total/period breakdown where relevant.
- [ ] Reverse-goal calculators expose assumptions and feasibility errors.
- [ ] Shared finance primitives avoid duplicate formulas across routes.

**Verification:** Independent financial vectors, zero/negative/boundary cases, currency/locale tests and answer-first browser acceptance.
