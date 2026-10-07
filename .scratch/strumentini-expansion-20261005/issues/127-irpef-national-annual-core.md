# 127 — IRPEF national annual core

**What to build:** Implement year-scoped national IRPEF brackets and gross-tax line items with source/version metadata and explicit unsupported-scope warnings.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 74.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Each bracket contribution is visible and sums to gross tax.
- [ ] Every threshold edge is covered plus/minus one cent.
- [ ] Unsupported/stale year fails rather than falling forward.

**Verification:** Independent hand calculations around every bracket boundary.
