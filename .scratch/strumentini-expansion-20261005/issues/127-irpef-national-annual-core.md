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

**2026-10-09 isolated candidate, ticket still blocked by #117:** `src/engines/italy/irpef-national-127.ts` now computes only national gross IRPEF from explicitly supplied taxable euro cents for source-verified 2025/2026 brackets. Law 207/2024 and Law 199/2025 bytes are SHA-256-pinned in the partial #117 evidence; no 2027 fallback. `tests/italy-fiscal-official-subsets-117.test.ts` covers ±1 cent at €28k and €50k, reconciled components and invalid/unknown years. No public route, calculator UI or complete #117 annual IVA/forfettario pack; do not close this ticket on the narrow module alone.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #398.

**Next actionable AC:** Each bracket contribution is visible and sums to gross tax.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
