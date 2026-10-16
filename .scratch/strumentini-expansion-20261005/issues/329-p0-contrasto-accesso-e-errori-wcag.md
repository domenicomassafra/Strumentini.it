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

## 2026-10-12 wave27 — authenticated header dropdown/logout error, browser-only GREEN; #329 OPEN

**Source bound:** clean published baseline `e7891bc516f3cbcfe7c1b80ad557126bce709850`, worker29 exclusively owned `src/components/shell/SiteHeader.astro` and NEW `tests/header-reflow-329-wave27.browser.mjs`; no `account.css`, shared account JS, framework, mobile device or production changes. The current revision had already corrected the historic global header's overall width at 320 CSS px, and a different defect was found: the account dropdown with the `hidden` attribute still computed `display:grid` while supposedly closed and remained in the keyboard tree. In the authenticated signed-in failure flow, the HTTP 503 logout alert protruded **4px left of a 320px viewport** and had no visible focus outline. The test first reproduced this RED against the real built header (not injected CSS) in the Chrome/WebKit narrow matrix.

**GREEN verified twice, including independently by prime:** 14 CSS-only added lines enforce `[data-account-dropdown][hidden] { display:none }` inside the header, bound the failed-logout alert width to the viewport and set visible focus outline. `node tests/header-reflow-329-wave27.browser.mjs` **PASS** against locally built real shared header and account chip in installed Google Chrome and Playwright WebKit, 320/390 CSS px × light/dark (8 variants) with mock-only signed-in HTTP session and mocked logout 503. Before fix hidden panel computed `grid`; after fix its bounding box 0/display none and no hidden child can receive Tab; actual keyboard traversal reaches menu toggle and has visible focus, Enter opens mobile navigation, Escape restores it. At 320px the focused logout alert now measures **left 16px/right 252px** (previously −4px); at 390px **left 42px/right 322px**, outlined 2–3px in both engines, with no horizontal document scrolling, no real authentication/provider POST or offsite scripts. Worker independently reran the existing #350 Chrome header browser test PASS and a source build **292 pages PASS**. `npm run check` 2,038 files/0 errors/0 warnings and `git diff --check` PASS.

**Residual:** Only desktop browser simulated authentication and 320/390px CSS-width/400%-equivalent reflow; **NOT_RUN**: physical iPhone/Android, real native zoom shortcut, VoiceOver/TalkBack, real authenticated provider. AC-329.1/2 remain unchecked across the full requested matrix; this is a scoped fix, not global WCAG certification, ticket closure, Gold or deploy. AC-329.3's existing narrowly sourced browser verification remains unchanged.

## 2026-10-12 bounded account lane — valid identity reflow RED → GREEN (OPEN)

Scope: dispatched worker `task_7458032eefa9` / `ctx_44591e96d95d`, exclusively `src/components/account/account.css`, new `tests/account-329-20261012*.mjs`, and this original issue; integrator retains commit/push/review authority. Local `tasks/index.md` is absent; this issue supplies the repository-local scoped acceptance and chronological evidence. Preserve all prior proofs and unchecked AC-329.1/2.

New independently reproduced failure: the real `/impostazioni/` route with mock signed-in email `ufficio.amministrazione.contabilita.fornitori@example.test` expands account content past a 320px viewport; Chromium document width 438px, WebKit 569px, email right edge about 417px. The address passes native email syntax and is below the existing 254-character server limit. Reuse decision: installed Playwright 1.63.0 and existing account browser network-fixture patterns; native `overflow-wrap:anywhere`, already used by `.ac-device-key` in this stylesheet, reduces text intrinsic minimum width while retaining the full address/name. No donor package or implementation framework is needed; only the identity block lacks that existing native behavior. Official rationale: [MDN overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap), [WCAG 2.2 reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

**Source and ownership:** baseline local HEAD and actual remote `refs/heads/main` both `04fa3d1872102f23ca120b8edf5cfa0794ee4ad0`; branch `fix/047-329-bounded-acceptance-20261012` has no remote ref at worker readback. Account stylesheet after-change SHA-256 `81fa530848dfb421558637f45bd29926b330284c4695b3db7f7eee55ba63bd0b`; new regression SHA-256 `b28b686d2f5f69ec90de2c2ba7adc7138a6495bfb26c858a6b170cfb089bb6d8`. No commit, push, PR or deployment by this worker. Concurrent #47 issue/test work is untouched; no stash or extra worktree was present.

**RED:** Before source mutation, `ACCOUNT329_ORIGIN=http://127.0.0.1:19632 node tests/account-329-20261012-identity-reflow.browser.mjs` exited 1 on Chromium's actual account form: `documentWidth:438` vs `viewport:320`, email/form/name-input/save-button right edge `417.125px`. Independently inspected unmodified WebKit route measured `documentWidth:569` and the same email overflow. Test loads the real Astro route, not synthetic DOM or injected faulty CSS; fixtures only supply session/account API responses.

**Minimal fix / GREEN:** One declaration, `overflow-wrap:anywhere` on existing `.ac-identity`, fixes the shared intrinsic sizing cause for both name and email. The unchanged dedicated test passes **48/48 variants**: Playwright Chromium **153.0.8010.12** and WebKit **26.6**, 320/390/640/1280px, light/dark, ordinary identity, 56-character valid email, and 80-character unbroken name plus long email. Actual text Range fragments remain within the viewport, full text remains intact, and all form/control bounds fit. Each variant uses real Tab (Option+Tab on WebKit) and Enter to submit the real profile form; **48 locally intercepted PATCH responses return 503**, with bounded alert text/controls, preserved prior identity and an enabled recovery button. Zero unexpected offsite requests or browser errors; no real account/provider changes.

**Existing proof freshly rerun:** same source/server: `tests/account-contrast-329-wave23.browser.mjs` **PASS**, 32 login/register inline/503 states across both engines, 456 computed text samples, minimum normal-text contrast **4.587532647833024:1**, focused registration alerts at top 80px and unoccluded in all eight variants. `tests/wcag-329-account-expanded.browser.mjs` **PASS**, installed Chrome **154.0.8037.99**, 988 computed account text samples with zero violations at applicable normal/large-text thresholds, eight native-file keyboard focus checks, zero global overflow, zero auth mutations/errors; eight attempted Turnstile bootstrap requests aborted before egress. `node --check` on the new regression and `git diff --check` **PASS**. No existing CSS fixes or historical evidence rewritten.

**Residual / integration handoff:** Native browser zoom, physical iPhone/Android, VoiceOver/TalkBack, real authenticated provider and approved public Worker preview **NOT_RUN** in this desktop local-fixture lane. Narrow CSS widths are equivalent reflow evidence only. AC-329.1/2 remain unchecked and #329 OPEN; this is neither global WCAG certification nor Gold/release acceptance. Serial integrator must review the exact diff, integrate the standalone regression into its relevant checks, push/read back the short-lived branch and handle PR/source-preview gates separately.

**Handoff checks:** `npm run tickets:check` **PASS** (424 tickets, 124 open, zero stored-status mismatches). Worker-owned temporary Astro server `127.0.0.1:19632` stopped after tests. No staging/commit/push; the three owned deliverables remain reviewable local WIP. Final observed `git status --porcelain` (the #47 paths belong to the parallel lane):

```text
 M .scratch/strumentini-expansion-20261005/issues/329-p0-contrasto-accesso-e-errori-wcag.md
 M .scratch/strumentini-expansion-20261005/issues/47-jpeg-png-webp-svg-compression-engines.md
 M src/components/account/account.css
 M src/engines/image/compression-donor-047.ts
?? .vitest/
?? tests/account-329-20261012-identity-reflow.browser.mjs
?? tests/image-compression-047-20261012-riff.browser.mjs
```

The untracked `.vitest/` appeared during concurrent shared-checkout work; this worker did not run Vitest or create/remove that directory.

## 2026-10-14 worker-3 — keyboard recovery after denied profile save (new bounded RED → GREEN; OPEN)

**Distinct real-user regression, independent of earlier contrast/reflow fixes:** on the real `/impostazioni/` route, a signed-in fixture user used **Tab, Tab, Enter** to submit a valid profile name from the focused **Salva modifiche** button. `setBusy` disabled that button while a locally intercepted `PATCH /api/auth/profile` returned HTTP **503**. Chrome at **320 CSS px, light theme** rendered the error and re-enabled the button, but the keyboard focus was lost to the document body: `activeSubmit=false`, `focusVisible=false`, `outline=none`; the dedicated new browser test exited **1 (RED)** before editing the page. Existing #329 matrices covered error contrast, profile identity reflow, and an enabled recovery button, but had not asserted keyboard focus continuity after async **profile** submission.

**Scoped fix:** `src/pages/impostazioni.astro` records whether the real submit button had visible keyboard focus before disabling it. When the asynchronous update resolves, the original button is enabled again and receives focus **only if** focus has fallen to `document.body`. If the user moves to a different control while the request is pending, no focus change occurs. The existing failure message, confirmed original name/email, validation and account API behavior are preserved; no CSS colors/tokens, source provider endpoints, authentication policies or other account workflows changed. New regression: `tests/account-329-20261014-retry-focus.browser.mjs`, with local-only mock session and all account PATCH calls intercepted as 503.

**GREEN from actual local browser:** installed Google Chrome (`channel=chrome`) and Playwright WebKit at **320/390 px × light/dark**, **8/8** states, real keyboard submit and restored visible ≥2px outline, bounded document and controls, existing identity unchanged. Computed error text contrast **5.073:1 light** and **6.147:1 dark** (AA ≥4.5:1 normal text). **9** locally intercepted profile PATCH 503 responses total, including one delayed pending request in which keyboard focus moves away and is **not** stolen upon completion. **Zero** unintended offsite requests or page JavaScript errors, zero provider/live-account writes. Existing `tests/acceptance-account-aa-329.mjs` separately passed **308/308** source-bound Chrome checks; `node --check` and `git diff --check` passed; ticket dashboard read-only `npm run tickets:check` passed with **0** stored-status mismatches. Broad `astro check` on the concurrently edited shared tree still returned **1 error in another lane** (PDF test `Buffer`/`BlobPart` compatibility), so no claim of a globally green typecheck.

**Scope/limits:** local browser fixture evidence only, at CSS widths approximating reflow; actual browser native zoom, physical Android/iPhone, VoiceOver/TalkBack, full manual WCAG 2.2 AA audit, real authenticated provider, production preview and deployment **NOT_RUN**. Original **AC-329.1 and AC-329.2 remain unchecked**, existing narrow **AC-329.3** unchanged; ticket status remains `ready-for-agent` / **OPEN**. No Gold or complete AA certification is inferred. This worker authored only the scoped source, new browser regression and this dated original-issue appendix; no shared dashboard mutation, Git stage/commit/push, PR or deploy. Publication awaits the prime's exclusive Git writer lease after the concurrent #407 integration.
