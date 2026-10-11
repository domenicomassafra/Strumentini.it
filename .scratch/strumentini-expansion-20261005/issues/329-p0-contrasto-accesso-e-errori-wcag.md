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
