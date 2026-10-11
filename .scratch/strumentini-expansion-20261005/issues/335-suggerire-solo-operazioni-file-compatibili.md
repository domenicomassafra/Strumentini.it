# 335 — Suggerire solo operazioni file compatibili

**What to build:** Manifest verificato produce lista operazioni pertinente.

**Traces to:** OWN-07 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 333

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-335.1: Manifest verificato produce lista operazioni pertinente.
- [ ] AC-335.2: Input sconosciuto non mostra azioni finte.
- [ ] AC-335.3: On the scoped input and failure cases, verify: Matrice PDF/PNG/CSV e tool registry. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Matrice PDF/PNG/CSV e tool registry; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 02 — bounded local evidence

Current manifest+pinned published Astro route suggestions, bounded by detected file format and exact MIME/network-forbidden LOCAL engine/route. `tests/file-suggestions-335.test.ts` 8/8 PASS, real Chromium 320/390/768/1024/1440 file picker/drop PDF/PNG/GIF/ZIP, explicit zero approved CSV and Office route, no network or auto-run. End-user file is still not forwarded from home to destination; separate #337 scope.

**Disposition:** implementation slice demonstrated locally only; do not infer original AC closure, Gold promotion, deployed feature or physical-device pass.
