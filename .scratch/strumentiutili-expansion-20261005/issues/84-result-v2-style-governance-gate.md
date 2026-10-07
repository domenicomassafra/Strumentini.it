# 84 — Result v2 style-governance gate

**What to build:** Extend design-system enforcement so Result v2 cannot add independent token, color, spacing, radius or stylesheet authorities and stays inside the existing global/tool-surface contract.

**Traces to:** US-EXP-01; AC-01.3

**Constraints:** C-EXP-04, C-EXP-09; DESIGN.md two-stylesheet rule stays authoritative.

**Blocked by:** 74, 78.

**Status:** completed

**Suggested skills:** design-system → inclusive-design → code-tdd

- [x] Result primitives consume canonical tokens/classes.
- [x] Bespoke visual authority fails a deterministic test.
- [x] Semantic state classes meet contrast floors.

**Verification:** Design-system sabotage plus light/dark representative checks.

**Evidence:** tests/result-style-governance.test.ts plus tests/design-system.test.ts pass deterministic bespoke-authority/token sabotage and semantic warning/partial state rules; accessibility gates cover visual-state behavior.
