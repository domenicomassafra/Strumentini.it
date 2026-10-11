# 346 — P0 Eventi telemetria privacy-safe

**What to build:** Success/error tecnico misurato senza file o fingerprint personali.

**Traces to:** OWN-03 OWN-13; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** cross-cutting

**Priority:** P0; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-346.1: Success/error tecnico misurato senza file o fingerprint personali.
- [x] AC-346.2: D7 e retention non dedotti senza prove longitudinali.
- [x] AC-346.3: On the scoped input and failure cases, verify: Payload/network/opt-out audit. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Payload/network/opt-out audit; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Telemetry opt-in OFF by default and revoked via local clear; denied storage fail-closed; D7/D30 maturation and repeated actual tool use corrected in reporting.ts, focused tests PASS. Real longitudinal cohort/production endpoint unobserved.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 wave 05 — local opt-in privacy telemetry closure

Browser adapter in `src/telemetry/privacy-events-346.ts`, `browser.ts`, `schema.ts`, `index.ts` is OFF by default, gated on disclosed opt-in **and** fresh same-origin authenticated session for every actual success/error event, with a second opt-in/active check after async authorization to close revoke races. The only emitted `validation_operation_result` consists of UTC-day timestamp and coarse categorical outcome, family, duration/error group; no file bytes, names, values, tool ID, subject or user IDs, session fingerprint, cookies or user identifier are sent. `tests/privacy-events-346.test.ts` 6 PASS, existing telemetry/consent 22 PASS, `tests/acceptance-privacy-events-346.mjs` live Chromium with isolated loopback sink **PASS**: default OFF, explicit disclosed grant, unauthenticated denial, signed-in success/error POST payload inspection, revoke/logout/denied-storage rejection, zero production requests. Reporting still has **cohortSize=0/measurable=false**; no D7, D30, retention or production cohort claim exists. Real longitudinal production monitoring, deployment, physical devices and release remain NOT_RUN/NO-GO; scope closure certifies non-fabrication and local browser contract only.
