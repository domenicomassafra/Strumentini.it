# 386 — Image editor mobile memory QA

**What to build:** Touch pan zoom e export iPhone Android con budget misurato

**Traces to:** OWN-06; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** 363,385

**Status:** blocked

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** advanced

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-386.1: Touch pan zoom e export iPhone Android con budget misurato.
- [ ] AC-386.2: OOM/background e denied save hanno recovery.
- [ ] AC-386.3: On the scoped input and failure cases, verify: Physical device memory cancel traces. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Physical device memory cancel traces. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.
