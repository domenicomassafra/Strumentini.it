MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 135 — TFR indicative taxation layer

**What to build:** Add a separate indicative taxation layer over gross/revalued TFR with explicit history inputs and scope limits; never imply employer settlement or official liquidation.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 127, 134.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd

- [ ] Tax estimate is separable from gross TFR calculation.
- [ ] Insufficient history returns partial/warning rather than fabricated rate.
- [ ] Result labels it indicative with assumptions.

**Verification:** Independent sample plus insufficient-history cases.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #401.

**Next actionable AC:** Tax estimate is separable from gross TFR calculation.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
