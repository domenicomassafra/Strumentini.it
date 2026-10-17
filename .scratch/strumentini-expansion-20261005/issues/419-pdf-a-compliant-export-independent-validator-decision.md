MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 419 — PDF/A compliant export independent validator decision

**What to build:** Evaluate PDF/A profile and candidate exporter with full validator before offering route.

**Traces to:** OWN-05 OWN-14; refusal antecedent #245 remains administratively completed NOT shipped.

**Constraints:** Retain historical refusal; only ship on confirmed license, security, mobile and independent output proof; no release or source code in this planning phase.

**Blocked by:** 369

**Status:** blocked

**Suggested skills:** research-primary-sources → code-architecture-review → security-audit → code-tdd → qa-browser

**Level:** feasibility

**Priority:** P2, recovery for explicit unshipped historical capability.

**Current evidence:** Explicit REFUSED original issue (2026-10-10 baseline); no proof this capability is currently available.

**Donor / reuse decision:** First inspect current libraries and legal rights; compare maintained donor/native/paid approval and measure browser compatibility before any implementation.

## Acceptance criteria

- [ ] AC-419.1: Evaluate PDF/A profile and candidate exporter with full validator before offering route.
- [ ] AC-419.2: Invalid fonts/ICC/XMP/attachments must not be labeled PDF/A.
- [ ] AC-419.3: On the scoped input and failure cases, verify: veraPDF or other independent profile validator. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** veraPDF or other independent profile validator. Test malformed, hostile, huge, cancellation and device limitations.

**Failure / resource / cancel / recovery:** Fail closed, no unknown password bypass, no auto-run embedded content, no undeclared off-device transfer; recover previous valid inputs.

**External gate:** License, security reviewer, primary source, device and owner purchase remain unresolved until separately proved.

**Rollback:** Preserve refusal/history, keep old route disabled or bounded until independently accepted.

**Out of scope:** Reclassifying the parent as shipped merely because this ticket was created.

**Execution routing:** Refer to EXECUTION-PROMPTS.md.
