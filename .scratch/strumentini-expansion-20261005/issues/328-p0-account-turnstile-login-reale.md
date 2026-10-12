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

## 2026-10-12 wave20 — logout acknowledgement and independent-session browser regression

Baseline clean main `f6afe2d6`, one-source change in `src/components/account/AccountChip.astro`: before the fix, the header's "Esci" handler redirected to `/` unconditionally in `finally`, even when the authenticated `POST /api/auth/logout` failed with HTTP 503, a static-route fallback returned HTML 200, or the browser fetch rejected. This was a **real Chrome390 RED**: the page navigated after mocked 503 while the fixture's cookie-backed session remained authenticated. The logout Worker (`worker/index.ts`) responds with HTTP **204** only after removing that session and setting an expired cookie. The header now redirects only for 204, displays an Italian keyboard-focusable `role="alert"` stating that the user is still signed in for all other results, and allows retry. A synchronous pending/disabled guard prevents duplicate logout requests without changing the Worker or the other account session.

New `tests/turnstile-login-wave20-328.browser.mjs` runs against an actual locally rendered Astro page in installed headless Google Chrome at **390×844** with two **independent fake-session cookie contexts A and B** and a disposable per-request auth API fixture. It exercises consecutive 503/200 HTML fallback/network failure without false sign-out, no credential/provider traffic, an accessible error and retry, a double-click during delayed HTTP 204 producing exactly one request, session A revocation with cookie clearing on 204 and preservation of session B after independent reload. **2 consecutive GREEN executions** after a failing RED; zero offsite requests and zero uncaught page errors. The server/browser fixture is local only and uses synthetic email/cookie values, not real authentication or a real Cloudflare challenge. Ancillary `tests/turnstile-worker.test.ts`, `tests/auth-worker.test.ts` and `tests/google-auth-worker.test.ts` total **21/21 PASS**. Existing `tests/account-page-turnstile-328-329.browser.mjs` passes **35 local mock-vendor assertions** (callback, expiry, timeout, unavailable vendor, controls and color contrast). `node --check` and scoped `git diff --check` pass.

**Remaining gates:** No real Cloudflare Turnstile Siteverify staging, provider credentials, production D1, cross-browser or physical iOS/Android login/logout were exercised. The separate #328 challenge acceptance and original AC-328.1–3 remain **OPEN / NOT_RUN for live-provider proof**, notwithstanding the independently reproduced local logout fix. This is not a live authentication or Gold/deployment receipt; no commit/push/deploy by this worker.
