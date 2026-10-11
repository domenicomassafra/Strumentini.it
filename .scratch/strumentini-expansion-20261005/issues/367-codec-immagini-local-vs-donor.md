# 367 — Codec immagini local vs donor

**What to build:** Confronto jSquash installed native per JPEG WebP PNG AVIF SVG

**Traces to:** OWN-04 OWN-15; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** feasibility

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-367.1: Confronto jSquash installed native per JPEG WebP PNG AVIF SVG.
- [x] AC-367.2: Alpha/exif/CSP/perf non provati impediscono migrazione.
- [ ] AC-367.3: On the scoped input and failure cases, verify: Browser fixtures e benchmark memory device. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Browser fixtures e benchmark memory device. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

**Feasibility execution 2026-10-11:** Evidence and `NO_ADOPT / NO_GO` decision in `docs/donor-codecs-367-2026-10-11.md`. Isolated harness `scripts/donor-codecs-367.ts --browser`: Chromium, Firefox, WebKit real source output + Sharp/libvips byte/pixel re-open; focused `tests/donor-codecs-367.test.ts` 4/4 PASS. No @jsquash modules installed or measured. WebKit WebP MIME fallback correctly refused; native AVIF experimental 2×2 encode on WebKit only; EXIF retained/added on certain existing paths. AC-367.1 retains missing jSquash apples-to-apples codec benchmark/licensing; AC-367.3 retains real mobile peak memory, larger source corpus and production CSP. **Blocked on physical-device acceptance and rights/asset/provenance proofs. Do not close or migrate.**
