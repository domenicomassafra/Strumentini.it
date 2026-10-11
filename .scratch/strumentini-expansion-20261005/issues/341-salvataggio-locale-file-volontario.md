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

- [x] AC-341.1: Save opt-in sopravvive reload dove supportato. Chromium locale verificato il 2026-10-11; Safari fisico NOT_RUN.
- [x] AC-341.2: Storage denied/eviction offre fallback download. Chromium: rifiuto IndexedDB, simulazione eviction e quota raggiunta preservano il download manuale del risultato ancora presente; Safari fisico NOT_RUN.
- [x] AC-341.3: On the scoped input and failure cases, verify: Opt-in→reload→reopen. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent. Chromium verificato il 2026-10-11; Safari fisico NOT_RUN.

**Verification:** Opt-in→reload→reopen; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

NEW `src/workbench/saved-pdf-341.ts` separate bounded IndexedDB: explicit verified PDF save only, <=8MiB each, <=5 files, <=24MiB total, SHA-256 byte readback on open, no over-quota eviction, exact-item confirmed deletion, no server/network/account sync. PdfTool UI lists persisted PDF on reload and can reopen as native input/download again, denied storage falls back to existing manual output download. `tests/saved-pdf-341.test.ts` 3/3 and real Chromium `tests/acceptance-saved-pdf-341.mjs` PASS producer merge→save→reload→reopen/download→five-file quota→sixth denied with five intact→scoped delete→denied IndexedDB fallback. Other PDF output families/multi-artifacts, PNG/CSV opt-in and physical Safari NOT_RUN.

**Wave 03 disposition (storico):** verified implementation slice only; AC originariamente non spuntati, limiti capability/device/provider ancora da provare. Stato aggiornato qui sotto dalla successiva wave worker 8, senza autorità di pubblicazione, acquisto, credenziali o release.

## 2026-10-11 worker 8 — riproduzione RED → GREEN e recupero locale

**Scope verificato:** `src/workbench/saved-pdf-341.ts`, sezione PDF conservati di `src/components/tools/pdf/PdfTool.tsx`, `tests/saved-pdf-341.test.ts` e `tests/acceptance-saved-pdf-341.mjs`. Una voce IndexedDB malformata bloccava `getAll` e nascondeva i PDF sani (RED Chromium: `page.waitForFunction` timeout aspettando i tre record validi). Ora ogni voce è convalidata singolarmente (struttura, MIME, dimensione, `SHA-256`) e l'interfaccia mostra quelle integre, segnala il numero di voci illeggibili e non elimina automaticamente alcun record. Ispezione limitata a 5 record più una sentinella per overflow, hashing seriale massimo 24 MiB, con avviso di elenco parziale se il DB supera i limiti.

**Esito:** `./node_modules/.bin/vitest run tests/saved-pdf-341.test.ts` 3/3 PASS. Chromium locale reale con server Astro separato `--ignore-lock` e comando `PDF341_ORIGIN=http://127.0.0.1:19441 node --import tsx tests/acceptance-saved-pdf-341.mjs` PASS: PDF sorgente scaricato identico byte-per-byte al PDF volontariamente conservato e scaricato dopo reload; riapertura come input manuale; quota 5 file rifiuta il sesto senza espulsioni; due record alterati (hash e dimensione) lasciano i tre validi riapribili/scaricabili e cinque record fisici immutati; overflow artificiale di sei record viene segnalato con lavoro limitato; eliminazione esplicita di un record lascia gli altri; IndexedDB negato e cancellazione simulata dell'archivio dopo l'opt-in mantengono scaricabile il risultato corrente; nessun POST e nessun download retroattivo. Il browser non garantisce la sopravvivenza alla vera eviction né il recupero di byte già cancellati: serve una copia scaricata per i file importanti.

**Gate esterni:** Safari fisico NOT_RUN; altri produttori/formati oltre al singolo PDF verificato NOT_RUN. `astro check` eseguito sull'intero worktree condiviso: exit 1 soltanto per errore TypeScript in `tests/metadata-forensic-394.test.ts:65` (modifiche concorrenti ticket #394), nessun diagnostico #341. Nessun commit, push o deploy da questo worker. Le tre caselle qui sopra si riferiscono al percorso Chromium e ai guasti simulati documentati, non a certificazione cross-browser o release.
