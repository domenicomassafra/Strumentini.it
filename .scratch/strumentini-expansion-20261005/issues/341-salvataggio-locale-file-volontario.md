# 341 — Salvataggio locale file volontario

**What to build:** Save opt-in sopravvive reload dove supportato.

**Traces to:** OWN-09; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 338

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-341.1: Save opt-in sopravvive reload dove supportato.
- [ ] AC-341.2: Storage denied/eviction offre fallback download.
- [ ] AC-341.3: On the scoped input and failure cases, verify: Opt-in→reload→reopen. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Opt-in→reload→reopen; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

NEW `src/workbench/saved-pdf-341.ts` separate bounded IndexedDB: explicit verified PDF save only, <=8MiB each, <=5 files, <=24MiB total, SHA-256 byte readback on open, no over-quota eviction, exact-item confirmed deletion, no server/network/account sync. PdfTool UI lists persisted PDF on reload and can reopen as native input/download again, denied storage falls back to existing manual output download. `tests/saved-pdf-341.test.ts` 3/3 and real Chromium `tests/acceptance-saved-pdf-341.mjs` PASS producer merge→save→reload→reopen/download→five-file quota→sixth denied with five intact→scoped delete→denied IndexedDB fallback. Other PDF output families/multi-artifacts, PNG/CSV opt-in and physical Safari NOT_RUN.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.
