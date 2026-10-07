# 249 — Split PDF by maximum output size

**What to build:** Add deterministic page-group splitting toward a requested maximum part size, proving every successful part is ≤ ceiling or explaining why a single page/content unit prevents it.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 217, 218.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd

- [ ] Every successful part is measured under requested ceiling.
- [ ] Impossible single-page case is explicit.
- [ ] Page order is preserved and part naming/grouping previewed.

**Verification:** Boundary-size corpus and reconstructed page-order verification.
