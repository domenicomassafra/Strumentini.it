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
