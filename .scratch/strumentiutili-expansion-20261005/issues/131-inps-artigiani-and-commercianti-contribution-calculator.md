# 131 — INPS artigiani and commercianti contribution calculator

**What to build:** Implement the supported 2026 artigiani/commercianti contribution model from versioned INPS sources, including relevant minimum/threshold components and declared profile boundaries.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the standard 2026 adult owner/adult-collaborator path normalized by ticket 118.

**Status:** completed — bounded 2026 public calculator

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] Artigiano/commerciante paths are distinct where rates/rules differ.
- [x] Minimum/threshold components are itemized.
- [x] Unsupported collaborator/age/regime combinations are explicit rather than guessed.

**Verification:** INPS worked examples/threshold edges and annual reconciliation.

**Progress (2026-10-06):** `src/engines/italy/inps-contributions.ts` consumes `INPS_CONTRIBUTIONS_2026` and exposes the exact source year, provenance, contribution base, selected seniority ceiling and three-line breakdown: official annual minimum contribution, first-band excess and second-band excess. The standard rates remain distinct for artigiani (24%/25%) and commercianti (24.48%/25.48%). Income is handled at exact-cent precision, the contribution base is capped at €93,707 or €122,295 according to the supported seniority choice, and reductions/special collaborator paths are rejected explicitly. The public LOCAL route `/tools/inps-artigiani-commercianti/` is catalog-bound to oracle `cand-256` and fixture family `italy-2026-consumers`; focused route/source tests pass and `.scratch/strumentiutili-expansion-20261005/evidence/italy-131-132-148-149-151-browser.json` records 390px browser acceptance with zero external/non-GET/task-body requests and no horizontal overflow.
