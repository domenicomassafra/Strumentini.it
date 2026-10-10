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
