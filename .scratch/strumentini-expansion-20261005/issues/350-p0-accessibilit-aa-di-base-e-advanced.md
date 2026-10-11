# 350 — P0 Accessibilità AA di base e advanced

**What to build:** Input/result/touch/keyboard/screenreader passano floor WCAG 2.2 AA.

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

- [ ] AC-350.1: Input/result/touch/keyboard/screenreader passano floor WCAG 2.2 AA.
- [ ] AC-350.2: Zoom e reduced motion non impediscono lavoro.
- [ ] AC-350.3: On the scoped input and failure cases, verify: Axe e manual keyboard screenreader. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Axe e manual keyboard screenreader; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

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
