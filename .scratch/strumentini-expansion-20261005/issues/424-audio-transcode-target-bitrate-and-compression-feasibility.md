# 424 — Audio transcode target bitrate and compression feasibility

**What to build:** Compare browser native/installed/donor codecs and device acceptable size/quality.

**Traces to:** OWN-04 OWN-06; refusal antecedent #230 remains administratively completed NOT shipped.

**Constraints:** Retain historical refusal; only ship on confirmed license, security, mobile and independent output proof; no release or source code in this planning phase.

**Blocked by:** 363

**Status:** blocked

**Suggested skills:** research-primary-sources → code-architecture-review → security-audit → code-tdd → qa-browser

**Level:** feasibility

**Priority:** P2, recovery for explicit unshipped historical capability.

**Current evidence:** Explicit REFUSED original issue (2026-10-10 baseline); no proof this capability is currently available.

**Donor / reuse decision:** First inspect current libraries and legal rights; compare maintained donor/native/paid approval and measure browser compatibility before any implementation.

## Acceptance criteria

- [ ] AC-424.1: Compare browser native/installed/donor codecs and device acceptable size/quality.
- [ ] AC-424.2: Unsupported encoder/codec on Safari refuses rather than fake output.
- [ ] AC-424.3: On the scoped input and failure cases, verify: Audio signal fidelity bitrate/container independent playback. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Audio signal fidelity bitrate/container independent playback. Test malformed, hostile, huge, cancellation and device limitations.

**Failure / resource / cancel / recovery:** Fail closed, no unknown password bypass, no auto-run embedded content, no undeclared off-device transfer; recover previous valid inputs.

**External gate:** License, security reviewer, primary source, device and owner purchase remain unresolved until separately proved.

**Rollback:** Preserve refusal/history, keep old route disabled or bounded until independently accepted.

**Out of scope:** Reclassifying the parent as shipped merely because this ticket was created.

**Execution routing:** Refer to EXECUTION-PROMPTS.md.
