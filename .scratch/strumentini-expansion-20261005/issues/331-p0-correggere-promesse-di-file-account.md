# 331 — P0 Correggere promesse di file/account

**What to build:** Copy distingue output di sessione e preferiti sincronizzati.

**Traces to:** OWN-09 OWN-10 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P0; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/extra.json; UI copy and history/file retention diverged from observed local behavior. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-331.1: Copy distingue output di sessione e preferiti sincronizzati.
- [x] AC-331.2: Anonimo e API assente non promettono cloud file.
- [x] AC-331.3: On the scoped input and failure cases, verify: Verifica testi con storage e API bloccati. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Verifica testi con storage e API bloccati; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Privacy/account/results copy corrected in risorse.astro, impostazioni.astro and accesso: no remote document archive claim, honest local vs server favorite handling. Full copy/source audit and live account still pending.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 wave 04 — complete scoped acceptance and real local reset

- **Source truth:** `src/pages/risorse.astro` / `src/pages/impostazioni.astro` now explicitly distinguish temporary in-tab results, ID-only recently used tools, optional account/server favorites and the separate voluntary `strumentini-optin-pdf-341` browser database (five PDFs, 24 MiB). No account or remote archive promise. Clearing browser data is not represented as server account deletion.
- **Actual deletion:** `src/components/account/workbench-store.ts` now attempts deletion of the *separate* saved-PDF IndexedDB as part of explicit "Cancella i dati locali". If a tab/browser refuses deletion, it returns a failure and never claims that the PDF bytes were erased; workbench, web storage and PDF deletion are all attempted independently.
- **Real browser evidence:** `COPY331_ORIGIN=http://127.0.0.1:4977 node tests/acceptance-local-storage-truth-331.mjs` **PASS** in local Chromium at 390 px: server account/session returns anonymous 401; FAQ/privacy copy visibly distinguishes local opt-in archive from account data; actual PDF Merge result is saved deliberately; the two-click local clear deletes the PDF database; simulated browser denial preserves archive and triggers explicit incomplete-deletion message. No result bytes sent by POST, no JS page errors. API logged-in staging and physical browser/device matrix NOT_RUN (not required for anonymous/api-missing copy correctness).
- **Scope:** no new Gold, real site deployment, external provider or account session proof. This closes copy/account scope only, not broader PDF privacy, gold freshness, or browser portability tickets.
