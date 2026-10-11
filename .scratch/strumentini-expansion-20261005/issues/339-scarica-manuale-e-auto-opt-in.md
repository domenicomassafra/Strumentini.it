# 339 — Scarica manuale e auto opt-in

**What to build:** Download manuale accessibile e auto revocabile.

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

- [ ] AC-339.1: Download manuale accessibile e auto revocabile.
- [ ] AC-339.2: Auto OFF default e popup denial gestiti.
- [ ] AC-339.3: On the scoped input and failure cases, verify: Browser download bytes+prefs. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Browser download bytes+prefs; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

`src/runtime/download-policy-339.ts` and `StructuredTextResultV2` JSON result UI: opt-in auto-download OFF by default, never re-download already-completed output when enabled, revocable/persistent, manual remains accessible; invalid/oversize/unverified refusal and storage denial fail closed. `tests/download-policy-339.test.ts` 3/3 and real Chromium `tests/acceptance-download-optin-339.mjs` PASS actual JSON bytes, later automatic download exactly once, simulated browser API denial, storage denial, revoke/reload. Only shared structured JSON-result surface integrated: all file formats/UI surfaces not yet audited.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 07 — opt-in/download ampliato a CSV reale, ticket ancora OPEN

Refactor sicuro dell'unica funzione di download browser in `src/runtime/browser-download-339.ts`: tutti i chiamanti usano `planVerifiedDownload339` su output verificato, byte budget, nome/MIME sicuri, Blob URL revocato solo dopo finestra di lettura; il risultato del click non viene scambiato per salvataggio del sistema operativo. `StructuredTextResultV2` JSON conserva il contratto precedente; `CsvTableResultV2` ora aggiunge lo stesso checkbox di consenso condiviso (default OFF, memoria locale solo su consenso) e il download manuale resta sempre disponibile. La preferenza esplicita si applica alle **prossime** produzioni valide, mai al CSV già mostrato al momento dell'attivazione; revoca, errore API browser, storage negato e risulta output nulla restituiscono fallback/refusal, non falsi successi.

`tests/acceptance-download-csv-339.mjs` Chrome 390px su producer vero CSV Dedupe **PASS**: risultato CSV riletto da file scaricato, OFF default, click ON senza re-download, nuova esecuzione produce 1 solo download esatto, API Blob negata → messaggio + nessun download, opt-out → successivo risultato non scaricato, localStorage.setItem negato → checkbox OFF e download manuale funziona, zero file egress. Regressione JSON `DOWNLOAD339_ORIGIN=http://127.0.0.1:4932 node tests/acceptance-download-optin-339.mjs` **PASS** dopo l'aggiunta della necessaria attesa di idratazione della vera isola Preact al test, senza modifiche al producer. Le 24 unit focalizzate CSV/facts/privacy/download PASS.

**Ancora OPEN:** l'AC originale include "manuale e auto" su più formati, e ora solo due famiglie condivise JSON e CSV sono state dimostrate; download manuale dei PDF/PNG/WAV/ZIP e politica auto universale, popup policy OS/physical Safari/Android, esiti diversi da click browser e altri output multipli richiedono audit e prove. Questa tranche non autorizza download impliciti, deploy o Gold.
