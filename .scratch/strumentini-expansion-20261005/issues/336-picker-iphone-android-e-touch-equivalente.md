# 336 — Picker iPhone Android e touch equivalente

**What to build:** Photos/Files raggiungono tool e risultato.

**Traces to:** OWN-06 OWN-07; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 333

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-336.1: Photos/Files raggiungono tool e risultato.
- [ ] AC-336.2: Permessi negati/ritorno dall'app non perdono il lavoro.
- [ ] AC-336.3: On the scoped input and failure cases, verify: Receipt fisica iOS Safari e Android Chrome. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Receipt fisica iOS Safari e Android Chrome; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

Separate native image/* Photos and generic Files pickers; 44 px control targets; cancel/read-denied/app-return preserves previous valid selection, no capture/upload/autostart. `tests/acceptance-mobile-picker-336.mjs` Chromium iPhone-like and Pixel-like emulation 320..1440 PASS incl real filechooser, Photos image result and Files PDF path. Physical iOS Safari/Android Chrome picker/permissions AC-336.3 remain NOT_RUN, HEIC detection unsupported.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.
