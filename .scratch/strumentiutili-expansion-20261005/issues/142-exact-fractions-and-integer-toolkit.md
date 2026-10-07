# 142 — Exact fractions and integer toolkit

**What to build:** Implement shared exact integer/rational primitives for fractions, GCD/LCM, prime/factorization, combinations/permutations, Roman numerals and number-to-words modes with explicit bounds.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Fraction operations reduce exactly and avoid floating drift.
- [x] 0/negative/large input policies are explicit per mode.
- [x] Roman input rejects noncanonical/invalid forms when validation mode is used.

**Verification:** Property tests, large-bound cases and known Roman/integer literals.

**Evidence:** Exact fraction operations use reduced BigInt rationals; integer modes declare digit/factor/combinatoric/word bounds and explicit zero/negative policies. Focused tests cover exact reductions, zero division, gcd/lcm zero, negative factorization, factor/combinatoric limits, canonical Roman rejection and number words. The 37-test focused+regression run, catalog check, Astro check/build and existing business-math Gold suite all passed.
