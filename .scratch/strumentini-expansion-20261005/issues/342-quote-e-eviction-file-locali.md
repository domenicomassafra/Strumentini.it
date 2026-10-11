# 342 — Quote e eviction file locali

**What to build:** UI cancella e distingue file conservati da transienti.

**Traces to:** OWN-09; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 341

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-342.1: UI cancella e distingue file conservati da transienti.
- [x] AC-342.2: Quota piena non elimina indiscriminatamente altri file.
- [x] AC-342.3: On the scoped input and failure cases, verify: Storage denial/eviction e orphan audit. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Storage denial/eviction e orphan audit; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## Acceptance indipendente — 2026-10-11, Chromium static preview

**Source audit:** `src/workbench/saved-pdf-341.ts` conserva solo PDF esplicitamente verificati nell'IndexedDB separato `strumentini-optin-pdf-341` (max 8 MiB per file, max 5 file e 24 MiB globali). `savePdf341` verifica count e somma byte nella medesima transazione IDB, abortendo anziché fare eviction; `deleteSavedPdf341` elimina soltanto l'ID scelto. `inspectSavedPdfs341` legge al massimo sei record per controllare overflow, segnala quelli corrotti senza cancellarli e verifica SHA-256 individualmente. `src/components/tools/pdf/PdfTool.tsx` distingue risultato transiente da elenco «PDF conservati su questo dispositivo», conserva solo su click e richiede conferma per la cancellazione selettiva. Nessuna modifica a tali sorgenti per #342: il comportamento attuale è stato verificato dall'esterno.

**Prova reale:** nuovo test indipendente `tests/acceptance-local-quota-342.browser.mjs` eseguito su **anteprima statica già compilata** (non server dev), URL locale `http://127.0.0.1:19541/tools/pdf-merge/`, Chromium Playwright **390×844**, comando `PDF342_ORIGIN=http://127.0.0.1:19541 ./node_modules/.bin/tsx tests/acceptance-local-quota-342.browser.mjs` → **PASS / exit 0**. Artefatti PDF generati realmente dall'operazione Unisci PDF; download originale e PDF persistito confrontati byte per byte. Inizialmente l'output è esclusivamente transiente e la lista persistente è vuota; solo «Conserva volontariamente» inserisce il file in IDB; dopo reload sparisce l'output dell'operazione, ma i file conservati sono riaperti/scaricabili. La conferma di eliminazione negata non cambia nessun record; eliminare esplicitamente un solo elemento mantiene ID, digest e byte degli altri.

**Quote e negativo:** cinque salvataggi espliciti riescono, il sesto è rifiutato senza alterare la lista persistita e senza togliere il download manuale transiente; il readback raw IDB prima/dopo e dopo reload è identico. Tre fixture IDB da 8 MiB ciascuna (marcate nel test come fixture sintetiche, SHA-256 e schema coerenti; **non** output generati dal motore PDF) portano il totale a **24 MiB** e il successivo salvataggio di un PDF reale è rifiutato senza eviction. Un record con schemaVersion non supportata diventa illeggibile nella lista, ma rimane fisicamente presente in IDB; il salvataggio successivo fallisce senza eliminare **né il record orfano né quello sano**. Nessuna migrazione automatica è stata introdotta o dichiarata riuscita.

**Storage failure:** un contesto browser con IndexedDB negato visualizza l'indisponibilità e mantiene il download manuale corretto; `indexedDB.deleteDatabase` dopo il salvataggio esplicito simula la perdita/eviction dati, non causa download automatici, permette il download del risultato transiente finché la pagina resta aperta e al reload mostra archivio vuoto senza simulare un recupero. **Zero richieste non-GET/HEAD** osservate nella prova, **zero pageerror**. Test eseguito su browser reale locale senza build, deploy o account.

**Limiti espliciti:** un contesto Chromium desktop a viewport mobile non è un dispositivo fisico. **Safari fisico, altri dispositivi, eviction spontanea del sistema operativo e prova WebKit sono NOT_RUN**; il test dimostra gli scenari di denial/eviction controllati con IDB reale nel browser, non predice quando il sistema rimuoverà i dati. Il deliverable non approva un deploy. Test #341 preesistente non modificato; nessun altro issue, generatore PDF o Worker toccato.
