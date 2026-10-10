# 152 — Italian invoice stamp-duty reference helper

**What to build:** Create a bounded reference calculator/checklist for supported Italian invoice stamp-duty conditions using versioned primary-source rules, with clear scope and non-legal-cert language.

**Traces to:** US-EXP-07; AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117 — Italian fiscal annual source snapshots.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd

- [ ] Rule version/source and assumptions are visible.
- [ ] Unsupported invoice situations return out-of-scope rather than advice.
- [ ] Result separates computed/reference outcome from legal certification.

**Verification:** Boundary/value fixtures from the sourced rule set.

**2026-10-09 isolated archival candidate, ticket still blocked by #117:** Hash-pinned November 2024 Agenzia delle Entrate guide in `quality/reference-data/italy/artifacts/117-fiscal-annual/agenzia-bollo-fatture-2024.html`. `src/engines/italy/invoice-stamp-reference-152.ts` evaluates only a 2024 **single ordinary invoice line**, user-declared no-special-exemption, and N2.2/N3.6/N4 as reference outcomes: >€77.47 implies €2, equality implies €0. All newer years, mixed/other document contexts and undeclared exemptions yield `OUT_OF_SCOPE`, not an assumed tax determination. `tests/italy-fiscal-official-subsets-117.test.ts` checks exact source hash and boundaries. There is no public UI or independent current-year legal coverage, so #152 is not closed.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #397, #402.

**Next actionable AC:** Rule version/source and assumptions are visible.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
