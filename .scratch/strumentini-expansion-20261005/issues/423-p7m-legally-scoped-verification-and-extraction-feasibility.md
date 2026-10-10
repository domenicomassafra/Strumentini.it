# 423 — P7M legally scoped verification and extraction feasibility

**What to build:** Evaluate CMS/P7M valid signed payload and verify vs merely extract contents.

**Traces to:** OWN-11 OWN-14; refusal antecedent #150 remains administratively completed NOT shipped.

**Constraints:** Retain historical refusal; only ship on confirmed license, security, mobile and independent output proof; no release or source code in this planning phase.

**Blocked by:** 366,407

**Status:** blocked

**Suggested skills:** research-primary-sources → code-architecture-review → security-audit → code-tdd → qa-browser

**Level:** feasibility

**Priority:** P2, recovery for explicit unshipped historical capability.

**Current evidence:** Explicit REFUSED original issue (2026-10-10 baseline); no proof this capability is currently available.

**Donor / reuse decision:** First inspect current libraries and legal rights; compare maintained donor/native/paid approval and measure browser compatibility before any implementation.

## Acceptance criteria

- [ ] AC-423.1: Evaluate CMS/P7M valid signed payload and verify vs merely extract contents.
- [ ] AC-423.2: Unverified signature or untrusted certificate cannot be labeled authentic.
- [ ] AC-423.3: On the scoped input and failure cases, verify: Signed/CMS corpus with expiration revocation and offline limits. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Signed/CMS corpus with expiration revocation and offline limits. Test malformed, hostile, huge, cancellation and device limitations.

**Failure / resource / cancel / recovery:** Fail closed, no unknown password bypass, no auto-run embedded content, no undeclared off-device transfer; recover previous valid inputs.

**External gate:** License, security reviewer, primary source, device and owner purchase remain unresolved until separately proved.

**Rollback:** Preserve refusal/history, keep old route disabled or bounded until independently accepted.

**Out of scope:** Reclassifying the parent as shipped merely because this ticket was created.

**Execution routing:** Refer to EXECUTION-PROMPTS.md.
