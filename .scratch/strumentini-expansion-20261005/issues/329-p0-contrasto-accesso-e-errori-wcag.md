# 329 — P0 Contrasto accesso e errori WCAG

**What to build:** Etichette/errori account superano contrasto AA.

**Traces to:** OWN-06 OWN-16; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P0; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/states.json; measured computed secondary account text 3.508:1 versus 4.5:1 normal-text WCAG floor. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-329.1: Etichette/errori account superano contrasto AA.
- [ ] AC-329.2: Zoom, tema scuro, focus non perdono testo.
- [x] AC-329.3: On the scoped input and failure cases, verify: Contrast computed/keyboard a 320 e 390. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Contrast computed/keyboard a 320 e 390; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Chromium contrast light 6.08:1, dark 8.35:1; keyboard focus and invalid-field/error tested in account page; physical phone/screen reader matrix NOT_RUN. Original AC remains open.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 wave 04 — additional source-bound Chrome matrix (not physical)

`tests/acceptance-account-aa-329.mjs` adds 308 real Chrome 154 assertions at 320/390 px on account login/register/errors in both explicitly chosen light/dark themes, minimum measured normal-text ratio 4.588:1 across 64 samples, keyboard focus-visible, label/error association, 503 authentication failure without false login, and equivalent 200/400% reflow without clipping. Existing #328/#329 Turnstile browser regression remains 35 PASS. Native Chrome zoom shortcut, VoiceOver/TalkBack and physical iOS/Android NOT_RUN; original ticket stays open rather than converting simulated responsiveness into screenreader or device certification. No source CSS/token change or deployment.

## 2026-10-11 worker-10 — real settings contrast RED → GREEN

**Source bound:** `6153eca3` plus uncommitted, account-only patch `src/components/account/account.css` SHA-256 `7a2da35a529a66271478f3e6b21774f4edc1b50ca0f40739467802b97cdfc76c`; actual `/impostazioni/` route SHA-256 `7e3592dfc2a4070c1a89b8259ca3fc5853d60386f27c7e670e352b837cdeb78a`. Test `tests/wcag-329-settings-contrast.browser.mjs` SHA-256 `f624797e1b6dc74a3894bf48c6c228223b6896d94395ff2d01b23e87363361c6`. Tested Chrome `154.0.8037.99` against local Astro source; no commit/push/deploy.

**RED, browser computed:** `/impostazioni/` at 320px/light, selected `Profilo` navigation label `14px / 600` used `rgb(11,108,253)` on `rgb(235,243,255)`: **4.106:1**, below WCAG AA normal text 4.5:1; assertion failed on the actual rendered route. Existing `--text-faint` was independently recalculated and does *not* reproduce the historical deficiency in the current token revision. **Fix:** the existing theme `--brand-active` token for selected/hover settings navigation and login tab hover, confined to account.css.

**GREEN, independently rerun:** `ACCOUNT329_ORIGIN=http://127.0.0.1:19570 node tests/wcag-329-settings-contrast.browser.mjs` **100/100 PASS**, Chrome 154 at 320/390px with light/dark; selected and hover settings tab contrast **6.518:1 light, 7.485:1 dark**; keyboard roving navigation/focus-visible ring, panel reflow, signed-out 503 state with no false authentication, no unexpected egress and no auth-mutating calls. `ACCOUNT329_ORIGIN=http://127.0.0.1:19570 node tests/acceptance-account-aa-329.mjs` **308/308 PASS** on `/accedi/` login/register label/error states, keyboard focus, backend denied 503 with recovery, 200/400% *equivalent width* reflow and no browser errors; 64 text contrast samples minimum 4.588:1. `node --check` of new browser test and `git diff --check` passed.

**Scope and limits:** AC-329.3 is checked for the named source-bound viewport, contrast, keyboard and denied-failure cases with the above receipts. AC-329.1/2 remain open for the full account/device matrix. Native browser zoom shortcut, VoiceOver/TalkBack, and physical iOS/Android are **NOT_RUN**; this is not a mobile/assistive-tech certification. The separate earlier `tests/account-page-turnstile-328-329.browser.mjs` run did **not** pass on this checkpoint: its register-widget wait timed out at line 182 against the shared server; no claim of fresh 35 PASS (historical wave04 result only). Original ticket remains OPEN, production release blocked independently.

## 2026-10-11 worker-17 — extended real Chrome contrast/reflow RED → GREEN

**Source-bound scope:** base HEAD `39e0782713b23e67e5deecdc1565d777f9ef431b`; exclusively edited `src/components/account/account.css` (after-change SHA-256 `8af2aae1c69cf3abebf3dc01c6efbb007d0e7da1d649495571bd005cbadb3d23`) and added `tests/wcag-329-account-expanded.browser.mjs` (SHA-256 `87e075721c3bc8f29090d4f65b9294b700dfc3bc7393ccbea9a36fad68420237`). Test loads the real `/accedi/` and `/impostazioni/` routes from an Astro dev server, in Chrome 154.0.8037.99, with all account APIs intercepted by fixture and all third-party requests aborted before egress; no credential or provider traffic.

**First RED — reflow/focus:** At 320px, light, HTTP 503 signed-out, the `/impostazioni/` Privacy panel caused document width **380px** versus viewport **320px**. The native `#device-config-import` file chooser retained an intrinsic minimum width that forced its grid block past the screen. Scoped CSS now sets `display:block;box-sizing:border-box;width:100%;min-width:0` on `.ac-shell input[type="file"]`. The same browser matrix verifies the chooser remains inside the viewport with a keyboard `:focus-visible` ring in **8/8** width/theme/session variants.

**Second RED — normal-text contrast:** The previous navigation-only Chrome matrix omitted selected weekday and theme labels and blue pills in settings. Chrome computed `rgb(11,108,253)` foreground against `rgb(235,243,255)` background on the actual controls, **4.106:1** at 13–15px, short of **4.5:1 WCAG AA**. Scoped CSS makes `.ac-shell .pill-brand` and checked segmented/weekday labels use the existing `--brand-active` ink, giving **6.518:1 light / 7.485:1 dark** against `--brand-soft`, with selected semantics intact.

**GREEN:** `ACCOUNT329_ORIGIN=http://127.0.0.1:19573 node tests/wcag-329-account-expanded.browser.mjs` passed on **988 computed visible-text samples**, 320/390px, light/dark, mocked signed-in and 503 denied session, both routes and all settings tabs, with **zero contrast violations** under the applicable 4.5:1 normal / 3:1 large-text thresholds; 8 file-chooser keyboard focus assertions, zero auth mutations and zero uncaught browser errors. The only eight external Turnstile bootstrap requests were blocked by the browser fixture. Independently rerun existing `tests/wcag-329-settings-contrast.browser.mjs` **100/100 PASS**, `tests/acceptance-account-aa-329.mjs` **308/308 PASS**, and `AUTH_PAGE_ORIGIN=http://127.0.0.1:19573 node tests/account-page-turnstile-328-329.browser.mjs` **35/35 PASS** (registration, errors and challenge lifecycle) against the same current source. This fresh 35 PASS supersedes only the previous runner timeout, not any physical-device gate. The 200/400% evidence remains equivalent-width reflow, not a native browser zoom command.

**Static validation:** `node --check tests/wcag-329-account-expanded.browser.mjs`, `git diff --check` on owned tracked paths, and `./node_modules/.bin/astro check` **PASS** (2,019 files, 0 errors, 0 warnings, 23 informational hints in unrelated test files).

**Residual independent blocker:** The authenticated *global header* at 320px makes **document scrollWidth 354px** on both `/accedi/` and `/impostazioni/`, in light and dark: `.site-actions` and `.site-menu-button` extend past the viewport; the account-owned panels and file import are now within bounds. This header belongs outside the agreed `account.css` source lane and was not changed. Global full-page reflow therefore remains unproven. Native Chrome zoom shortcut, physical mobile Safari/Chrome, VoiceOver and TalkBack are **NOT_RUN**. Preserve AC-329.1/2 **unchecked** pending full source/device matrix and header remediation; AC-329.3 remains limited to its explicitly scoped evidence. No commit, push, deploy, Gold certification or ticket closure.

## 2026-10-12 worker-17 wave23 — focused WebKit registration failure RED → GREEN (OPEN)

**Starting revision:** clean main `895b7132d3b1d822efebefae235542cf8f51bcba`. Exclusively changed `src/components/account/account.css`, added `tests/account-contrast-329-wave23.browser.mjs`, and recorded this original ticket. All test traffic used a temporary 127.0.0.1 Astro server. Browser fixtures intercepted authentication and the Turnstile script; no real user, provider, credential, database, release or external HTTP request was used.

**Distinct RED:** The actual `/accedi/` registration workflow, submitted with valid mock-only fields/Turnstile followed by an intercepted HTTP 503, focused `[data-access-error]` correctly at DOM level, **but WebKit desktop at 390px light/dark left the whole alert ABOVE the visible viewport:** `getBoundingClientRect()` **top −177.9375px, bottom −108.5625px**, persisting 250 ms after failure. At 320px, its top **0.4375px** clipped the 2px focus outline. This is distinct from prior Chrome-only computed contrast changes and inline-error checks, and from the global authenticated-header overflow. Chrome's same error was previously on-screen. Reproduced with a real Playwright WebKit page and computed actual element geometry. The dedicated regression went RED on the clipped 320px WebKit alert; after a first `scroll-margin-block`-only CSS attempt, 320 improved but **390 still failed**, demonstrating that margin alone did not solve the browser scroll behavior.

**Scoped GREEN:** `.ac-access [data-access-error]:focus` now uses `position:sticky`, `top:calc(var(--nav-height) + var(--space-3))`, `z-index:1` and existing `scroll-margin-block:var(--space-8)`. The alert only sticks while focused and sits below the 68px sticky site header. Independent browser hit testing (`document.elementFromPoint`) proves the alert itself is not occluded by the header. On rerun, focused registration HTTP 503 alert top **80px** in **all eight** engine/width/theme variants (Chromium and WebKit; 320/390px; light/dark), with a computed solid outline ≥2px and bounded right/bottom; login HTTP 503 and validation focus remain intact. The test exercises actual Tab on Chrome, Option+Tab in macOS WebKit (Safari keyboard preference for buttons) and End for the tablist; **it does not claim VoiceOver or a physical iPhone**.

**Measured QA:** Dedicated 32-state current-source matrix over both login/register, inline-validation errors and mocked 503 failures, Chrome + Playwright WebKit, both widths/themes: **456 computed visible text samples**, minimum normal-text ratio **4.587532647833024:1**, no WCAG AA 4.5:1 normal / 3:1 large text failures, no password-reveal icon contrast below 3:1, no horizontal account overflow, no uncaught browser errors or unexpected remote requests. Exactly **16 authentication submissions** were intercepted and returned HTTP 503 locally; there were **zero real provider calls**. Test terminal assertions strictly reject color or viewport failures rather than merely logging them. Optional test-only `ACCOUNT329_WAVE23_FAULT=contrast` injects deficient `.ac-support` ink exclusively into the local browser: the suite **fails RED** on the independently computed AA assertion, proving the negative gate, without altering source CSS. Normal rerun after removing the fault completed **PASS**. Legacy Chrome `tests/acceptance-account-aa-329.mjs` **308/308 PASS** and expanded source audit `tests/wcag-329-account-expanded.browser.mjs` **988 computed text samples, PASS**. No native browser zoom or keyboard shortcuts for zoom; **320px is a 400%-equivalent width-only reflow**, not physical or native zoom proof.

**Residual:** Full WCAG/device scope remains unverified; native Safari/iOS hardware, Android, VoiceOver, TalkBack and native zoom **NOT_RUN**. Do **not** mark original AC-329.1/2 checked or close #329; the source-bound local browser tranche is not an accessibility certification, Gold promotion or deploy. The preexisting authenticated global header width issue remains outside this account-only CSS ownership. No commit/push/deploy.
