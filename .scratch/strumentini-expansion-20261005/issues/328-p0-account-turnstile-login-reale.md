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

## 2026-10-13 worker-19 — same-origin Chrome390 submission race and obsolete session probe

**Actual browser RED:** Existing local `src/pages/accedi.astro` used
`setBusy()` to disable only the clicked button, but had no pending guard in
the form `submit` handlers. With the **real locally served Astro page** in
installed Google Chrome at **390×844**, a mock Turnstile callback supplied a
synthetic token and the same-origin intercepted `POST /api/auth/login` was
held pending. Calling the real HTML form's `requestSubmit()` twice while its
button was already disabled caused **three simultaneous login POSTs** rather
than one (failing assertion `3 !== 1`); the request could reuse a one-use
Turnstile token. The registration tab was also able to submit independently
while login was in flight, and a delayed initial `GET /api/auth/session`
could render stale signed-in UI after a newer login had returned an error.
These are local concurrent-state issues, not proof of a Cloudflare bypass.

**Scoped fix/reuse:** The page now shares one synchronous `authPending` guard
across email login and registration, checked before either handler clears
errors and set before the asynchronous network request. It keeps the
existing reusable `setBusy()` function, leaves the success navigation
pending until the browser navigates, and releases the guard/restores busy
state on refusal (with the existing Italian focusable alert). It records
when an explicit authentication attempt starts so a session probe launched
earlier cannot supersede that newer user action with a stale response.
Expiry callbacks still clear a challenge token; an expired token cannot
trigger a second request during the outstanding flight. No API, worker,
provider, or auth-client code was modified.

**GREEN proof:** New local-only
`tests/turnstile-328-20261013-submission-race.browser.mjs` stages delayed
same-origin auth/session replies, a mocked Turnstile vendor loader, actual
Chrome 390 form submissions including disabled-button `requestSubmit()`,
cross-panel registration, expiry while in flight, and an obsolete session
response. It verifies a single POST, zero simultaneous account creation,
unchanged focusable login rejection, hidden stale connected panel and **no
offsite/provider calls**; the before-fix duplicate-POST assertion was RED.
Existing `tests/account-page-turnstile-328-329.browser.mjs` passed **35
assertions** covering login/registration success, callback, expiry, timeout,
error focus and light/dark contrast. Existing
`tests/turnstile-login-wave20-328.browser.mjs` passed the two-session logout
and failed-acknowledgement Chrome 390 regression. Whole-project
`./node_modules/.bin/tsc --noEmit`, `node --check` and scoped diff
whitespace checks passed. No real provider secrets or Cloudflare Siteverify,
no live D1/session, deployment or production mutation were involved.

**Residual:** This completes only the local race correction, not the
original acceptance gates. **AC-328.1–3 remain OPEN** pending genuine
staging Siteverify, independent two-session staging/login/logout and device
evidence. Production/Gold remains **NO_GO**.

## 2026-10-14 worker-3 — cookie-bound login/registration confirmation RED → GREEN (OPEN)

**Fresh source-bound RED (real installed Chrome, local origin only):** actual `/accedi/` accepted a locally mocked `POST /api/auth/login` **200** (similarly registration **201**) with a valid-looking `{user}` response but **no `Set-Cookie`**, and navigated to `/preferiti/` even though `GET /api/auth/session` would return `user:null`. Dedicated test initially failed with `False authenticated redirect: chromium login/no-cookie`, actual `'/preferiti/'` instead of expected `'/accedi/'`. Earlier 35-check vendor/mock journey likewise sent success JSON without a cookie; its artificial success was not evidence that login established a browser session. This is distinct from the earlier same-token concurrent POST race, Turnstile callback/timeout, logout acknowledgement and #329 account focus work.

**Scoped change/reuse:** `src/components/account/auth-client.ts` now treats a valid-looking login/registration POST as provisional. It independently calls its existing same-origin cookie-bound `GET /api/auth/session` with `credentials:'same-origin'` and **`cache:'no-store'`**, and requires a nonempty authenticated user whose email matches both the submitted identity and the POST's user before returning success to the unmodified page redirect logic. Inability to confirm a session, including HTTP 503, null or different identity, yields a focused, accessible Italian retry error; the form's existing Turnstile reset and pending lock remain in force, with **no automatic credential resubmission**. The real Worker already emits `Cache-Control: no-store` for these endpoints; adding request-side cache bypass prevents reusing a stale session confirmation. Historical `tests/account-page-turnstile-328-329.browser.mjs` fixture now issues a **local-only HttpOnly `su_session` cookie** for its simulated successful login/registration and independently answers subsequent session probes based on the cookie. No auth provider, Worker logic, production secret, D1 state or account data changed.

**Real-browser GREEN:** new `tests/turnstile-328-20261014-cookie-session.browser.mjs` serves the actual Astro access UI through a separate **127.0.0.1 HTTP proxy** with disposable API/cookie responses (real `Set-Cookie` bytes, not a simulated Playwright cookie injected out of band), while preventing external requests and replacing the Turnstile vendor JS in the browser. Installed headless **Google Chrome and Playwright WebKit × login/register × four outcomes = 16/16 scenarios PASS**: HTTP 200/201 without cookie, 200/201 plus wrong-account session, 200/201 with real cookie but session verification 503 all **refuse navigation** and show focusable retry; authenticated `su_session` observed by the **server** on an uncached session GET is the only successful navigation. Each test dispatched exactly **one** controlled auth POST. Browser follow-up requests carried `Cache-Control: no-cache` under the `cache:'no-store'` request mode; real sessions were never claimed. **No unexpected offsite request or uncaught page error.** Existing mock journey `tests/account-page-turnstile-328-329.browser.mjs` **35 checks PASS** after aligning its cookie fixture; `tests/turnstile-328-20261013-submission-race.browser.mjs` PASS; isolated Worker auth/Turnstile/Google fixtures **21/21 Vitest PASS**, `node --check` and scoped diff whitespace PASS.

**Remaining AC / release gates:** all original **AC-328.1–3 remain unchecked**, `ready-for-agent` status preserved. Browser-fixture cookie proof is **not** real Cloudflare Siteverify verification, account/Turnstile staging with independent real sessions, physical iOS/Android authentication, real provider credentials, Gold or production proof; these remain **NOT_RUN / NO_GO**. No Git stage/commit/push, PR, merge or deployment by this worker pending the prime's exclusive writer lease and review; only account client, one existing account browser fixture, new cookie-regression test and this dated issue appendix belong to this tranche.
