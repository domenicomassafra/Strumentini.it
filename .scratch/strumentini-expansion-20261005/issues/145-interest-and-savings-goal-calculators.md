# 145 — Interest and savings-goal calculators

**What to build:** Add simple/compound interest, periodic contribution growth and reverse savings-goal modes with explicit compounding cadence and formula breakdown.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 88 — Migrate BusinessMathTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Zero-rate/zero-period behavior is defined.
- [x] Reverse goal reports infeasible/invalid inputs.
- [x] Currency rounding is presentation-only until final displayed totals.

**Verification:** Independent finance literals and reverse-goal cases.

**Evidence:** Simple, compound, periodic-contribution and reverse-goal modes expose cadence, periods, rate assumptions and formula breakdowns. Focused tests cover zero rate, zero periods, already-met and infeasible goals, negative savings-rate rejection and non-integral period rejection; fixture literals independently cover all four modes. Full-precision intermediates feed only final displayed currency rounding. The 37-test focused+regression run, catalog check and Astro check/build passed.
