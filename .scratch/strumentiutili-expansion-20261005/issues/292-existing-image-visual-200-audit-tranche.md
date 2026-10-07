# 292 — Existing image-visual 200-audit tranche

**What to build:** Audit every original tool in category image-visual (5 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 5/5 current image-visual ids receive one audit record.
- [x] No current-contract gap was found; tickets 298–316 are separate image-workspace/file capabilities and ticket 317 is explicitly additive export/ZIP work for platform presets rather than a missing current calculator behavior.
- [x] All five ALREADY_COMPLETE records carry concrete Gold, executable unit/source and real-route browser evidence; no Result v2-only or visual-only proof is used.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** `quality/functional-audit/records/` contains exactly the five current `image-visual` tools: aspect-ratio-calculator, color-converter, color-picker, contrast-checker and platform-size-presets. `tests/functional-audit-tranche-292.test.ts` validates exact catalog parity, ticket-110 schema binding, existing evidence refs, Gold/tool-id identity and browser-route evidence. `tests/image-visual-tools.test.ts` directly exercises aspect-ratio, color conversion and WCAG contrast primitives; `tests/image-media-tools.test.ts` directly exercises platform preset calculations and the public platform-size module. Ticket 317 remains future additive multi-output/export work and is recorded as context only, not a child blocker. The original-200 final validator passes 200/200 with 196 VERIFIED and 4 REFUSED decisions.
