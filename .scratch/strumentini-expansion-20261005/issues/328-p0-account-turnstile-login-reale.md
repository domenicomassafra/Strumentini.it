# 328 — P0 Account Turnstile login reale

**What to build:** Registrazione/login con challenge funzionante.

**Traces to:** OWN-03 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P0; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/extra.json + auth-blocked-390.png; src/pages/accedi.astro Turnstile async/defer bootstrap failure on controlled 2026-10-10 snapshot. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-328.1: Registrazione/login con challenge funzionante.
- [ ] AC-328.2: API assente, challenge negata o timeout non danno falso login.
- [ ] AC-328.3: On the scoped input and failure cases, verify: Browser staging 2 sessioni e prova di logout. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Browser staging 2 sessioni e prova di logout; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Turnstile callback bootstrap, error/expired/timeout recovery and token fail-closed implemented in src/pages/accedi.astro; browser Chromium mocked vendor/API 35 checks PASS jointly with #329; local Worker+D1 auth acceptance 130 PASS. Real Cloudflare Siteverify staging NOT_RUN; original AC remains open.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.
