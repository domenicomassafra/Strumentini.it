# 146 — Generic loan and installment scenarios

**What to build:** Generalize the amortization primitive after mutuo to non-mortgage amount/rate/term scenarios; fees are included only when explicitly entered.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 16 — Mutuo + amortization calculator.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] The existing French-amortization primitive now covers generic amount/rate/term scenarios; zero-rate and standard schedules still reconcile to a zero ending balance.
- [x] No taxes, TAEG, insurance or mortgage-specific fees are invented. A one-time cost affects `totalCost` only when the user explicitly enters `explicitFees`.
- [x] Payment and interest remain determined solely by principal/TAN/term; `totalRepaid` reconciles the schedule and `totalCost = totalRepaid + explicitFees` is cent-exact.

**Verification:** `tests/business-math-expansion.test.ts` covers zero-rate and interest-bearing generic-loan scenarios, explicit-fee reconciliation, unchanged payment/schedule when a fee is added, and negative-fee refusal.
