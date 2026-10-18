MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 422 — EPUB offline reader and text export safety

**What to build:** Read EPUB chapters/text offline with encoding and navigation.

**Traces to:** OWN-03 OWN-04; refusal antecedent #263 remains administratively completed NOT shipped.

**Constraints:** Retain historical refusal; only ship on confirmed license, security, mobile and independent output proof; no release or source code in this planning phase.

**Blocked by:** 407

**Status:** blocked

**Suggested skills:** research-primary-sources → code-architecture-review → security-audit → code-tdd → qa-browser

**Level:** base

**Priority:** P2, recovery for explicit unshipped historical capability.

**Current evidence:** Explicit REFUSED original issue (2026-10-10 baseline); no proof this capability is currently available.

**Donor / reuse decision:** First inspect current libraries and legal rights; compare maintained donor/native/paid approval and measure browser compatibility before any implementation.

## Acceptance criteria

- [ ] AC-422.1: Read EPUB chapters/text offline with encoding and navigation.
- [ ] AC-422.2: Scripted SVG remote resources/zip bombs do not execute or fetch.
- [ ] AC-422.3: On the scoped input and failure cases, verify: EPUB3 packaged corpus, text extraction and no network. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** EPUB3 packaged corpus, text extraction and no network. Test malformed, hostile, huge, cancellation and device limitations.

**Failure / resource / cancel / recovery:** Fail closed, no unknown password bypass, no auto-run embedded content, no undeclared off-device transfer; recover previous valid inputs.

**External gate:** License, security reviewer, primary source, device and owner purchase remain unresolved until separately proved.

**Rollback:** Preserve refusal/history, keep old route disabled or bounded until independently accepted.

**Out of scope:** Reclassifying the parent as shipped merely because this ticket was created.

**Execution routing:** Refer to EXECUTION-PROMPTS.md.
