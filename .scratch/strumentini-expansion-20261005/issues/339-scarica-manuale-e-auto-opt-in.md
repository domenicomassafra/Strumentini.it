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

## 2026-10-11 worker-3 — tranche WAV PCM16 locale (implementata; ticket ancora OPEN)

**Sorgente verificata:** `src/components/tools/audio/AudioTimelinePanel231.tsx` produce un WAV PCM16 realmente elaborato nel Worker #231; dopo il completamento i byte vengono riletti con `inspectAudioPcm16Source231`, confrontando numero di frame, sample rate e canali con la ricevuta Worker. Solo allora `createOutputArtifactDescriptor` rende scaricabile `montaggio-pcm16.wav` attraverso `requestBrowserDownload339` e la policy esistente. Nessuna modifica a `src/runtime/browser-download-339.ts` / `download-policy-339.ts` né a engine, PdfTool, immagini, CSV o handoff. Il link precedente è diventato un pulsante manuale semanticamente accessibile; l'anteprima audio resta opzionale quando il browser rifiuta il Blob URL. Messaggi di download riportano solo la **richiesta al browser**, senza affermare che il sistema operativo abbia salvato il file.

**Consenso:** scelta esplicita persistita sotto la policy #339, OFF in assenza di consenso, revocabile e sincronizzata al cambio storage; si applica soltanto a render WAV iniziati dopo il consenso e ancora autorizzati al completamento. L'attivazione su risultato già visibile non innesca scaricamenti retroattivi. Se storage o URL Blob sono negati il fallback manuale resta visibile; il rifiuto è segnalato senza finto successo. Nessuna chiamata upload aggiunta.

**TDD/verifica locale indipendente:** `tests/acceptance-download-wav-339.mjs` prima **RED** per assenza del checkbox; dopo implementazione **PASS** Chromium desktop con viewport 390×844 su server Astro locale (`DOWNLOAD339_WAV_ORIGIN=http://127.0.0.1:4978 node tests/acceptance-download-wav-339.mjs`). File PCM16 di riferimento 800 frame / 8 kHz mono creato dal test: lettura del file scaricato e confronto byte-per-byte esatto con il riferimento, download manuale, OFF default, un solo auto su render successivo, niente retro-download, diniego `URL.createObjectURL`, retry manuale con byte conservati dopo ripristino API, revoca persistente dopo reload, denied `localStorage.setItem` fail closed e fallback manuale, zero richieste HTTP non-GET o fuori origin rilevate. `vitest run tests/download-policy-339.test.ts tests/audio-processing-family-036.test.ts tests/audio-timeline-231.test.ts` **PASS 18/18**. Regressione `AUDIO036_ORIGIN=http://127.0.0.1:4978 AUDIO036_BROWSERS=chromium node tests/audio-processing-036.browser.mjs` **PASS 26 controlli**: float32→PCM16, file 12.842 B riletto e riconosciuto da ffprobe, preview/cancel, Worker 3 creati/3 terminati, zero upload, viewport 390 px. Il gate #036 Firefox/WebKit e build statica nuova restano **NOT_RUN**. `astro check` del repository: **NO_GO globale per 1 errore fuori perimetro**, `tests/gold-source-binding-347.test.ts` importa `assertGoldSearchConsistency347` non esportato dal relativo script, mentre nessuna diagnostica punta al codice WAV #339.

**AC residui non provati (non spuntare gli AC globali):** PDF, PNG, ZIP, formati multipli e policy auto universale **NOT_RUN**; Safari reale, Android e altri device fisici **NOT_RUN**; autorizzazioni popup/download del browser e salvataggio OS effettivo **NOT_PROVABLE** con l'evento browser. Nessuna certificazione Gold, release o deploy; ticket #339 resta OPEN fino alle prove mancanti.

## 2026-10-11 worker-3 follow-up sicurezza — revoca negata, preferenza ancora ON

**Difetto P1 rilevato:** quando `localStorage.removeItem` lancia eccezione, la chiave `strumentini:auto-download:v1=enabled` sopravvive alla revoca; tre checkbox WAV/JSON/CSV usavano `setAutoDownload(written && enabled)` e visualizzavano falsamente OFF, mentre il reload riabilitava il consenso persistito. In più `writeAutoDownload339` poteva scambiare un fallimento di `getItem` per prova di revoca perché la precedente lettura fail-closed restituiva `false`.

**Correzione locale:** `src/runtime/download-policy-339.ts` richiede ora il **readback raw** per confermare la scrittura e restituisce via `changeAutoDownload339` sia `saved` sia `persistedEnabled` (`null` se non leggibile). Tutti e tre i chiamanti (`AudioTimelinePanel231`, `StructuredTextResultV2`, `CsvTableResultV2`) usano lo stato persistito effettivo: se `removeItem` viene negato e `enabled` permane, checkbox ON + avviso esplicito «Impossibile revocare … ancora attivo», senza dichiarare revoca riuscita. Se la lettura stessa è negata, lo stato sessione resta disabilitato con messaggio di revoca non confermabile. Ogni pannello rilegge inoltre la preferenza dopo l'idratazione client, senza attivare download retroattivi di risultati già visibili.

**Prove e limiti del follow-up:** `vitest run tests/download-policy-339.test.ts tests/audio-timeline-231.test.ts tests/audio-processing-family-036.test.ts` **PASS 20/20**, incluse eccezione `removeItem` con chiave ancora enabled e impossibilità di certificare la revoca quando il readback è negato. Regressione browser JSON #339 **PASS** contro Astro locale :19463. Aggiunta a `tests/acceptance-download-wav-339.mjs` prova Chromium con `removeItem` negato, checkbox ON, avviso e reload; prima della sincronizzazione client il browser test ha identificato il checkbox errato OFF **nonostante key enabled al reload**. Correzione hydration applicata successivamente, ma per cutoff di integrazione il **test WAV rivisto dopo questa ultima correzione resta NOT_RUN** e va rieseguito prima di dichiarare GREEN. Browser CSV su server dev condiviso **INCONCLUSIVE**, timeout di idratazione isola `CsvDedupeTool`, senza risultato attestabile. Ticket #339 resta **OPEN** e nessun file PDF/PNG, Gold o release è stato modificato per questa tranche.

**2026-10-11 prime recheck successivo al cutoff:** individuato il vero mismatch SSR/hydration: inizializzare `useState` dalla preferenza browser faceva divergere lo stato client iniziale dall'HTML SSR che mostrava OFF; il mount effect tentava di scrivere lo stesso valore logico e il checkbox DOM restava erroneamente OFF. Le tre superfici ora iniziano da `useState(false)` coerente con SSR e rileggono il consenso dopo il mount, causando un vero aggiornamento di stato DOM. Rilanciato **dopo questa correzione** `node tests/acceptance-download-wav-339.mjs` su Astro locale: **PASS** Chromium reale a 390px, controllo byte WAV, consenso OFF predefinito, download manuale/auto solo dopo nuovo job, diniego Blob, `removeItem` negato mantiene checkbox ON e avviso, reload mantiene ON, successiva revoca spegne davvero la chiave, zero upload. La nota precedente `NOT_RUN` descrive il checkpoint del worker, non l'esito successivo. Il CSV browser dopo la modifica rimane da verificare indipendentemente; issue ancora aperta.

## 2026-10-11 worker-3 — tranche PDF singolo verificato, senza estensione PNG

**Implementato in `src/components/tools/pdf/PdfTool.tsx`:** controllo esplicito `data-download-pdf339` (SSR iniziale OFF e rilettura del consenso post-hydration), scelta persistente revocabile con `changeAutoDownload339`, errore onesto se la revoca fallisce e `enabled` rimane in storage. All'avvio di una nuova elaborazione si fotografa il consenso attivo; soltanto al completamento, se **ancora autorizzato**, viene richiesta al browser una singola copia dell'**unico** artifact con `kind: pdf` e MIME `application/pdf`, già verificato in `preparePdfResult` mediante firma e riapertura nel parser PDF. `requestBrowserDownload339` applica inoltre piano di download, verifica coerenza byte e limite 64 MiB. Il controllo non attiva download retroattivi; esclude output multipli, ZIP, PNG, altri tipi di file, job falliti o annullati. Il download manuale di `PdfResultV2` resta disponibile e invariato. Nessun invio di file in rete e nessuna conferma inventata di salvataggio su OS; nessuna modifica a trasformazioni PDF, PNG handoff #337, runtime #339 condivisi o CSV.

**Test browser concreto:** `DOWNLOAD339_PDF_ORIGIN=http://127.0.0.1:4987 node tests/download-pdf-png-339.browser.mjs` **PASS** Chromium reale 390×844 su Astro locale (server condiviso di altro worker, non riavviato): input `quality/fixtures/pdf-gold/simple-3page.pdf`, rotazione pagina 1 a 90° nel vero motore PDF, download manuale e automatico riletto dai byte tramite `pdfjs-dist` indipendente: intestazione `%PDF-`, 3 pagine, rotazione 90°. Default OFF, nessuno scaricamento della precedente elaborazione quando l'utente abilita l'opt-in, precisamente un automatico al job successivo, browser `URL.createObjectURL` negato selettivamente alla funzione di download #339, fallback manuale, `Storage.removeItem` negato mantiene ON + messaggio + ON dopo reload, revoca successiva normale persiste OFF, storage `setItem` negato non abilita il consenso e zero upload/network write rilevato. **Rieseguito anche con `window.open` negato** e server Astro locale gestito dal test: **PASS**, download manuali/auto ancora funzionanti e server di test chiuso. `vitest run tests/pdf-result-v2.test.ts tests/download-policy-339.test.ts tests/artifact-verifier.test.ts` **PASS 17/17**, diff check **PASS**.

**Limiti espliciti:** l'AC download **PDF singolo** è coperto da questa tranche; non è dimostrata un'auto policy per PDF multipli o ZIP, né per output immagine/PNG prodotti da tool PDF; famiglia PNG ImageResultV2 non modificata. Test su Firefox, WebKit, Safari/iOS/Android fisici, popup policy specifiche e salvataggio finale del sistema operativo **NOT_RUN/NOT_PROVABLE** dal solo browser Chromium. Nessun deploy, gold gate o release: issue #339 resta **OPEN**.

### 2026-10-11 review consenso cross-family #339 — UI PDF esplicita

La chiave persistente `strumentini:auto-download:v1` in `download-policy-339.ts` è **unica e globale** per gli strumenti che supportano il download automatico: WAV, JSON, CSV e ora PDF singolo verificato. Il consenso dato in WAV/JSON/CSV rende quindi il PDF già opt-in alla visita successiva, senza nuovo toggle PDF; e il consenso dato in PDF abilita anche le altre famiglie supportate. Non esiste isolamento per formato. La label PDF e la nota sempre visibile `data-download-pdf339-scope` lo dichiarano **prima dell'elaborazione**, indicando che la disattivazione dal PDF revoca globalmente il consenso; anche i messaggi di attivazione, revoca e revoca fallita sono esplicitamente condivisi. Restano i limiti PDF-only sui byte prodotti (solo PDF singolo, verificato), no auto su ZIP/multi/PNG, no retro-download e no salvataggio OS inventato.

**Regressione:** `tests/download-pdf-png-339.browser.mjs` ora verifica label e avvertenza globale, preimposta `enabled` come se il consenso provenisse da un altro strumento, ricarica la pagina PDF, verifica checkbox ON e nessun download al solo caricamento, quindi rimuove la chiave e verifica OFF prima di continuare l'intero flusso. `DOWNLOAD339_PDF_ORIGIN=http://127.0.0.1:51116 node tests/download-pdf-png-339.browser.mjs` **PASS** Chromium 390px su server Astro già esistente, con le precedenti prove byte/reopen, popup/API/storage denial, revoca e zero upload. `vitest run tests/download-policy-339.test.ts tests/pdf-result-v2.test.ts` **PASS 12/12**. Nessun codice runtime/policy condiviso modificato in questo follow-up.

**Scelta futura non compresa nello scope:** un eventuale consenso *per-formato* richiederebbe chiavi distinte, migrazione/invalidazione coerente della vecchia chiave globale e allineamento testato di **tutti** i chiamanti WAV/JSON/CSV/PDF; non è stato introdotto né simulato. Il ticket rimane OPEN per gli altri AC e prove fisiche.
