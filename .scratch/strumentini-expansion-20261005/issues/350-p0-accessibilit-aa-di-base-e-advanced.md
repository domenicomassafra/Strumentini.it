# 350 — P0 Accessibilità AA di base e advanced

**What to build:** Verificare input, menu e risultati con Axe automatico, zoom e navigazione da tastiera.

**Decisione owner 2026-10-16:** i test automatici (Axe, zoom e tastiera) sono i criteri di prova per #350. Le precedenti richieste di VoiceOver, lettori di schermo manuali e iPhone fisico sono superate; i resoconti storici sottostanti restano documentazione, non gate attivi.

**Traces to:** OWN-06 OWN-16; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** cross-cutting

**Priority:** P0; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-350.1: Input, menu e risultati superano i controlli Axe e tastiera nell'ambito del ticket.
- [ ] AC-350.2: Zoom e reduced motion non impediscono lavoro.
- [ ] AC-350.3: On the scoped input and failure cases, verify: Axe automatico, zoom e tastiera. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Axe automatico, zoom e tastiera; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source, consent and security requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

`tests/acceptance-wcag-floor-350.mjs` local Chromium Chrome 154 116 assertions: four pages /,/accedi/,/preferiti/,/tools/rate-converter at 320/390 and 200/400%-equivalent reflow, keyboard/focus, reduced-motion, live status, 44px controls and computed light/dark contrast. `src/styles/global.css` fixed measured `--text-faint` text AA contrast light ~3.35:1 to safer #59667a. Axe not installed/NOT_RUN, actual VoiceOver/TalkBack, physical devices and native browser zoom NOT_RUN, no blanket WCAG certification.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 14 — signed-in global header 320 CSS-px reflow (worker-14)

**Exclusive ownership:** only src/components/shell/SiteHeader.astro, NEW tests/site-header-reflow-350.browser.mjs and this #350 issue. No account.css (#329), global.css, generated catalog/metadata, #396/#397/#404 or other agents' files edited. No new route, Gold/receipt promotion, commit, push or deploy.

**RED reproduced in real installed Google Chrome:** On an already-built static /accedi/ page, synthetic same-origin /api/auth/session response authenticated a fixture user (no real account). At 320 CSS px with light theme, the initial DOM layout reported documentElement.clientWidth=320, documentElement.scrollWidth=354; .site-actions and .site-menu-button extended right to 353.90625 px, clipping the 44 px menu control. The authenticated .account-chip consumed 111 px because the signed-out .account-login anchor's authored .btn display overrode the user-agent [hidden] rule, leaving a redundant 44 px control alongside the signed-in trigger (67 px, 36 px high). Thus a real signed-in state failed the reflow/target floor despite the earlier signed-out #350 smoke passing.

**Minimal GREEN fix in header's own scoped CSS only:** enforce display:none on [data-account-login][hidden] inside the site actions; retain 44 px minimum-height touch targets for both login and signed-in account trigger across the <1060 px mobile-navigation breakpoint; collapse only the *visible brand text* at <=360 px while retaining the visible SVG mark and the Strumentini.it home accessible label. Navigation links, account JS/auth, mobile menu behavior, focus styling, global tokens and nonmobile brand text were unchanged. No overflow:hidden masking, x-scroll escape hatch or click target shrinking.

**Independent browser acceptance:** node tests/site-header-reflow-350.browser.mjs — **PASS, exit 0** using the real installed Google Chrome and a self-owned local HTTP static server from the newly built dist. Tested /accedi/ at CSS widths 320, 390 and 640; both light/dark themes and authenticated/unauthenticated fixtures; additionally tested signed-in /preferiti/ at 320 px. Assertions inspect actual document scrollWidth, header/actions/menu/account bounding rects, account login visibility in signed-in state, 44 px targets, and keyboard Tab focus with visible outline, Enter opening mobile navigation, Tab+Enter reaching and revealing the actual /strumenti/ link, Escape closing and restoring toggle focus, plus authenticated account dropdown and outside-click closure. All pages fit without horizontal overflow; no account mutations, no unexpected offsite traffic and no JavaScript page errors. The 320 px layout also stands in for **400%-equivalent reflow** on a 1280 CSS-px desktop viewport; 640 px stands in for 200%-equivalent reflow — **not a claim of native Chrome zoom test**.

**Build integrity:** direct ./node_modules/.bin/astro build && ./node_modules/.bin/tsx scripts/inspect-build.ts **PASS: 292 pages**, original public route set, metadata/discovery and historical baseline retained; node --check browser test and git diff --check on owned source both PASS.

**Disposition:** Original cross-cutting AC-350.1–3 stay **unchecked / OPEN**: this is a measured header reflow and keyboard/focus repair, not exhaustive Axe, native browser zoom, VoiceOver/TalkBack, physical iOS/Android, input/result accessibility or complete WCAG 2.2 AA assurance. Those are explicitly NOT_RUN.

## 2026-10-12 wave 20 — focus escaping full-screen mobile navigation

**New defect (distinct from prior first-Tab, focus outline, Escape and horizontal reflow):** With the mobile menu already open at 320 CSS px, keyboard focus on its last visible action, “Accedi o registrati”, followed by **Tab** moved to the underlying page's `<a href="/">Home</a>`, while `aria-expanded="true"` and the opaque full-screen menu remained open. Actual installed Chrome + current built static `dist`, `node tests/site-accessibility-350-wave20.browser.mjs` RED: `inPanel=false, isToggle=false, active=<a href="/">Home</a>, panelOpen=true`. Focus therefore continued onto content obscured by the navigation sheet, even though previous tests proved entry, Escape and reflow. No account/provider/user data was involved.

**Scoped repair in `src/components/shell/SiteHeader.astro`:** while the actual mobile panel is open/visible, bound Tab traversal to the menu trigger and currently visible, focusable actions. Forward Tab from the final mobile link returns to the trigger; reverse Tab from the trigger returns to the final visible action. Hidden children of collapsed `<details>` are not inserted into the loop; Escape still closes the menu and returns focus, and closing the panel releases normal page Tab order. This is no change to routes, nav labeling, account auth, global tokens or mobile sizing.

**RED→GREEN independent receipts:** Fresh `astro build` **PASS (292 pages)**, then `node tests/site-accessibility-350-wave20.browser.mjs` **PASS** real installed Chrome + Playwright WebKit, each at 320 (400%-equivalent layout) and 390 CSS px. The test checks real forward/reverse keyboard boundary and round-trip, visible panel/trigger focus, Escape restoration, no trapping after close, horizontal reflow, reduced-motion preference and zero write requests or uncaught exceptions. Existing `node tests/site-header-reflow-350.browser.mjs` **PASS** on rebuilt static output, including signed-in/out state fixtures, light/dark, focus outline, first-Tab and Escape. These tests **do not** claim real desktop browser zoom, a physical phone, automated axe, manual VoiceOver/TalkBack, or complete AA conformance: original AC-350.1–3 and ticket remain **OPEN/NO-GO** for missing broad independent evidence. No commit/push/deploy in this worker wave.


## 2026-10-13 native Chat On Steroids wave — responsive mobile-menu state

**Independent RED:** on the existing built `/strumenti/` site, Google Chrome and WebKit at 390 CSS px can open the menu with keyboard Enter; changing the actual viewport to 1280 px hides the panel and toggle via CSS but leaves `body.site-mobile-open` (computed `overflow: hidden`), `aria-expanded=true` and `panel.hidden=false`. Keyboard focus remains in the hidden mobile trigger. This is different from prior wave14 hidden login CSS and wave20 in-menu Tab loop.

**Smallest scoped change:** `src/components/shell/SiteHeader.astro` listens for the existing 1060 px desktop breakpoint. On entry into desktop width with the sheet actually open, closes it using its existing `setOpen(false)` (scroll lock/hidden/aria stay synchronized); transfers focus to the visible brand link only if focus was inside the now-hidden menu or its trigger. No new dependencies, CSS vocabulary, API calls or changes to other account or global components.

**GREEN:** `tests/site-header-350-20261013-responsive.browser.mjs` on a fresh isolated 292-page Astro build passed real local Chrome and WebKit at 390→1280→390 px: true mobile keyboard opening, desktop scroll unlock, `aria-expanded=false`, `hidden` and brand focus restoration, no surprise reopening, no outside-origin writes or page errors. Earlier source build was independently RED on both engines. Existing wave20 browser focus-trap/reduced-motion 320/390 and wave14 signed-in/out reflow/light/dark 320/390/640 were rerun on that isolated output and PASS. Worker removed its own scratch build and temporary test copies afterward; `node --check` and `git diff --check` PASS.

**Scope/limits:** this is a measured browser viewport transition, **not** native pinch zoom, physical iOS/Android, Axe, manual VoiceOver/TalkBack, full result/input a11y or production preview. AC-350.1–3 remain unchecked and original ticket stays OPEN. Review, source checks, PR, source fingerprint and deploy are independent integrator/release gates; do not promote Gold or call this full WCAG 2.2 AA acceptance.

## 2026-10-13 — PR #12 reviewer P2 follow-up: focus handoff assertion hardened

**Review gap addressed without a source change:** the original responsive test accepted `!focusInHiddenMobileMenu`; a browser that automatically blurred the hidden toggle/link to `BODY` could satisfy that check without an accessible handoff. `tests/site-header-350-20261013-responsive.browser.mjs` now asserts `document.activeElement === .site-brand` separately after keyboard focus on the open mobile trigger at the exact **1059→1060 CSS-px** desktop breakpoint and after focus on a real visible `/preferiti/` mobile panel link at **390→1280 CSS px**. It additionally checks that a deliberately focused, visible external search trigger keeps focus after the menu closes, while scroll lock, ARIA expansion, `hidden`, breakpoint visibility and no stale reopen still pass.

**Independent RED negative control:** on the real browser page the test's opt-in `SITE_HEADER_350_NEGATIVE_CONTROL=toggle|link` replaces only the live brand element's `focus()` method with a no-op; it does not edit the compiled JavaScript or app source. Both installed Google Chrome and Playwright WebKit then report `focusOnBrand=false, focusOnBody=true` with **exit 1**, independently for the trigger-focus and link-focus cases. Thus the new assertions reject the concrete false-positive. **GREEN:** fresh isolated Astro build of integration HEAD **e95cae42**, 292 pages / exit 0, then `SITE_HEADER_350_DIST=.scratch/worker3-350-focus-20261013-dist node tests/site-header-350-20261013-responsive.browser.mjs` **exit 0**, all six positive scenarios across Chrome and WebKit: visible brand correctly focused for both hidden mobile origins, visible external search focus preserved. Older wave20 Chrome/WebKit 320/390 menu focus/reduced-motion regression and wave14 Chrome 320/390/640 signed-in/out reflow regression also **PASS** on the same isolated build. `SiteHeader.astro` was unchanged because actual implementation was GREEN.

**Limits unchanged:** viewport resizing is not native zoom; no physical iOS/Android, VoiceOver/TalkBack, axe, production preview or full WCAG AA assurance. Original ticket AC-350.1–3 remain OPEN; PR #12 integration, CI and preview acceptance belong to the prime.

## 2026-10-14 worker-2 — desktop dropdown Escape focus recovery (RED → GREEN; OPEN)

**Reproduced real keyboard defect:** With desktop navigation visible at 1060 CSS px in installed Google Chrome, focus on a dropdown `<summary>`, press Enter, then Tab to a real submenu `<a>` and press Escape. The source handler closed the `<details>`, but `document.activeElement` stayed on the now-hidden submenu anchor (`activeIsHiddenLink=true`, `triggerFocused=false`, `:focus-visible=false`). The next keyboard action no longer had a visible focus reference; prior #350 header regressions covered the mobile overlay and breakpoint handoff, not this desktop focus path. New browser regression `tests/site-header-350-20261014-desktop-escape.browser.mjs` failed RED with that measured DOM/computed-style state against real source before mutation.

**Narrow correction:** Only `src/components/shell/SiteHeader.astro` desktop Escape handler changes. For any open native desktop dropdown, it records whether the active element is inside before closing; if so it returns focus to its visible `<summary>` with `preventScroll`. When focus is on an unrelated visible control, Escape still closes open menus without stealing focus. No account/OCR/PDF/Office engine, global CSS, theme tokens, navigation contract, vendor source or state management changed.

**Scoped GREEN:** Actual local Astro dev source, installed Google Chrome and Playwright WebKit, at 1060 and 1280 CSS px in light/dark with reduced motion, eight real browser cases. Assert real keyboard Enter/Escape, a visible focused submenu link before Escape, closed details afterward, `summary === document.activeElement`, computed `:focus-visible`, CSS outline width at least 2 px, and subsequent Tab to a visible target; also verify focus outside the menu remains on the existing control when Escape closes it. WebKit/macOS control-only Tab behavior required explicit focus on the genuinely visible link before the physical Escape key, so full WebKit Tab traversal was not inferred. Requests are local GET/HEAD only, and JS exceptions fail the regression. This is desktop CSS-width testing, not native zoom or a physical mobile/device assertion.

**Original AC and delivery:** AC-350.1–3 remain **OPEN** pending broader axe/AT manual keyboard, screenreader VoiceOver/TalkBack, physical iOS/Android and native zoom. The focused source fix does not certify complete WCAG 2.2 AA or count as release/deployment acceptance; all existing proof and public gates remain separate.

## 2026-10-14 — real Axe WCAG slice on compiled public consumer (RED → GREEN; OPEN)

**Bounded source:** independent clean clone of canonical `main` `9906d6a6`, fresh Astro static build of **293 pages**. Exact Chrome `155.0.8059.40` and genuine `axe-core@4.14.0` executed against four real built routes (`/`, `/accedi/`, `/preferiti/`, `/tools/rate-converter/`) at **320/390 CSS px × light/dark** with reduced motion and keyboard checks; repeated Axe after invalid file, invalid login, invalid tool and successful result states. This produced **32 actual browser scans**. Local-only API 503 fixtures and blocked off-origin traffic; never observed physical/mobile or screenreader use. Axe core is **MPL-2.0**, not MIT: installed **temporarily inside the isolated clone** without a new tracked product dependency or vendor changes. Runner `tests/axe-350-20261014-built.browser.mjs` requires the ephemeral browser bundle installed with `npm install --prefix .axe-350-tool --no-save --package-lock=false --ignore-scripts axe-core@4.14.0` after normal project dependency installation.

**Independent RED:** the original compiled source had Axe WCAG A/AA findings in **all 32 scans**, **84 violated-rule instances** touching **98 elements**. Four distinct rule IDs were `link-name` (icon-only `Accedi` link at narrow widths), `label-content-name-mismatch` (footer brand's accessible name excluded visible subtitle), `color-contrast` (light `section-link` measured 4.37:1 against #f6faff; blue `pill-brand` about 4.10:1 against #ebf3ff, selected personal-area navigation), and `aria-prohibited-attr` (ARIA labels on plain Turnstile placeholder divs). The test exits nonzero for a violation; its prior RED and post-fix GREEN were recorded on rebuilt consumer, not DOM color injections.

**Minimal GREEN in isolated source:** `AccountChip.astro` gives the icon-only account link an accessible name; `SiteFooter.astro` lets its visible text name the footer link; `accedi.astro` removes invalid `aria-label` from both noninteractive Turnstile mount divs while preserving the adjacent announced status; `global.css` and `preferiti.astro` reuse existing `--brand-active` ink for affected normal-text links, badge and selected navigation. After rebuild, **32/32 Axe scans have 0 violations**, with the same local workflows and state matrix. Axe still reports `incomplete` color contrast checks for complex backgrounds and some Turnstile placeholder states, so zero automated violations is not proof of full AA. Existing `tests/acceptance-wcag-floor-350.mjs` **116/116 PASS**, focused design/style/#348 source-transport suites **33/33 PASS**, `astro check` **2110 files / 0 errors / 0 warnings**. The #348 full-byte browser-transport hashes were reviewed and updated for the `AccountChip.astro` and `preferiti.astro` source-only markup/color changes: the former preserves GET session and POST logout/204 rules, the latter preserves exactly one GET session. Tests deliberately reject injected uploads and route drift.

**Unproven original gates:** AC-350.1 remains unchecked across untested tool families, actual touch and manual screenreaders; AC-350.2 remains unchecked for native zoom (the equivalent layout reflow and reduced motion are proved only in scoped browser states); AC-350.3 remains unchecked because manual VoiceOver/TalkBack was NOT_RUN and automated Axe cannot replace that assessment. No full WCAG 2.2 AA, physical-device, Gold, preview, deployment or original-ticket DONE claim. The independently owned worker patch awaits tracked branch review and integration; any concurrent original-ticket notes must be reconciled rather than overwritten.

## 2026-10-15 — CoS source-bound **native Chromium zoom** on four compiled routes (OPEN)

The lane 1 CoS prime added `tests/wcag-350-20261015-native-zoom.browser.mjs` in this exclusive #350 branch, without changing app code, Axe dependency, provider state or any unrelated worker WIP. A temporary local-only Chromium extension uses actual `chrome.tabs.setZoomSettings({mode:'automatic',scope:'per-origin'})`, `setZoom` and `getZoom` after each route navigation. Two native OS-size sessions at 1280 and 1560 desktop px, themes light/dark, 100/200/400% zoom and four already built pages (`/`, `/accedi/`, `/preferiti/`, `/tools/rate-converter/`) returned **48/48 PASS** (24 per native desktop width) in bundled Chromium **153.0.8010.12**, with real CSS 320/390 px widths at 400%, devicePixelRatio 4 and visualViewport.scale 1 (not viewport/CSS emulation). Every state checked same-origin loaded main heading, no global x overflow, skip-link keyboard focus-visible, prefers-reduced-motion, and when mobile, real Enter/Escape mobile-menu focus restoration and minimum 44px control. No page errors, unexpected mutating requests or off-origin egress; Turnstile bootstrap requests were aborted by the local fixture. `ZOOM350_FAULT=navigation-reset` forces per-tab zoom and the browser test correctly fails (exit 1) at its native `getZoom` continuity assertion. `node --check` and `git diff --check` PASS.

**Two-axis proportional review:** Standards — isolated ephemeral profile/extension, no dependency or secret change, scoped real browser API and strong negative control; Spec — directly closes the *previously untested native zoom evidence gap on these four routes* while neither broad touch/AT nor all input/result tools are covered. **Not a full ticket completion:** original AC-350.1–3 remain unchecked, actual VoiceOver/TalkBack/manual assistive-tech, physical iOS/Android, all 269 tool families, native WebKit Safari zoom and independent WCAG 2.2 AA certification remain **NOT_RUN**. Existing Axe 32/32 GREEN evidence remains source-bound to this pre-integration branch and release stays NO_GO.

## 2026-10-16 — WIP350 reconciliation on existing PR #181 (scoped proof; OPEN)

The two previously unmerged original #350 commits (`5cac93d9` Axe implementation and `6dd06f8e` native zoom test) were reconciled with the independent desktop Escape focus commit (`66163d14`) on the existing `fix/350-desktop-nav-escape-focus-20261014` branch. The only overlapping ticket-note conflict was resolved by retaining both historical evidence sections. The original `AC-350.1–3` remain unchecked and no production release is authorized.

The Axe test's old `.axe-350-tool` temporary node_modules path was a nonreproducible clean-checkout requirement. The test now resolves the pinned `axe-core@4.14.0` **MPL-2.0 devDependency** from regular `node_modules` after `npm ci`, with `package-lock.json` updated; no browser production bundle, upload or new runtime import uses Axe. The preexisting #348 reviewed full-byte browser transport pins for `AccountChip.astro` and `preferiti.astro` were preserved and its 15 focused tests passed.

**Integrated source-bound verification:** Fresh 293-page Astro build and build inspection PASS; real installed Chrome `155.0.8059.84` ran Axe `4.14.0` against the compiled `dist` on `/`, `/accedi/`, `/preferiti/`, `/tools/rate-converter/` at 320/390 CSS px, light/dark, and selected invalid input/error/result states: **32 browser scans, zero violations**, exit 0. Axe still yielded some `incomplete` color-contrast/ARIA checks; zero detected violations is not WCAG certification. The same integrated compiled pages passed **48/48 true native Chromium `153.0.8010.12` tab-zoom scenarios** at 1280 and 1560 desktop sizes, 100/200/400%, four routes and two themes, with `chrome.tabs.getZoom` readback; zero unexpected page exceptions or writes. Focused #348 and table/chart tests passed **17/17**, while desktop Escape had already passed Chrome+WebKit **8/8** and the broader Chrome browser-floor script **116/116** before combining these WIP commits. These latter two should be rerun after the integration as appropriate.

**Residual:** Native VoiceOver/TalkBack screenreader usage, real physical iOS/Android touch and wider tool-specific coverage have not been proved; the source preview/public deployed fingerprint and final CI/review also remain distinct gates. Keep ticket OPEN/NO-GO until the original acceptance outcomes are independently supported; do not promote Gold or deploy based on these scoped technical tests.
