# 19 — Universal unit-conversion family

**What to build:** Build a dimension-aware conversion engine and job views for the high-value physical/digital dimensions in the source plan, sharing unit definitions and precision rules rather than one engine per page.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.1, AC-10.1; DEC-EXP-01; C-EXP-03

**Constraints:** Separate affine conversions such as temperature from multiplicative units; declare decimal vs binary storage; no unsupported cross-dimension conversions.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] Unit registry declares dimension, symbol, aliases and conversion authority.
- [ ] Bidirectional conversions preserve a documented precision policy.
- [ ] High-intent job routes reuse the registry but have distinct defaults/copy where justified.
- [ ] Search aliases cover Italian/common symbols without ambiguous silent matches.

**Verification:** Independent known-answer vectors per dimension, property round trips, locale input tests, search/discovery and mobile browser acceptance.
