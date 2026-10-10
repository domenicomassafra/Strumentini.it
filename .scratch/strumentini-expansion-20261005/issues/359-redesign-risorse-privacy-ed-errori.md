# 359 — Redesign risorse privacy ed errori

**What to build:** Stati vuoto/loading/cancel/error/success spiegano verità del runtime.

**Traces to:** OWN-10 OWN-16; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 352,353

**Status:** blocked

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** advanced

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-359.1: Stati vuoto/loading/cancel/error/success spiegano verità del runtime.
- [ ] AC-359.2: Offline/unsupported non mostrano successo finto.
- [ ] AC-359.3: On the scoped input and failure cases, verify: State matrix 5 viewport. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** State matrix 5 viewport; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Visual choice #352, hardware receipt #362, privacy/server approval #348 or licensing/security where applicable. None of these are approved by planning.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.
