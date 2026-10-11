# 337 — Typed handoff per catene di tool

**What to build:** Output passa al tool compatibile senza download/reupload.

**Traces to:** OWN-08; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-337.1: Output passa al tool compatibile senza download/reupload.
- [ ] AC-337.2: Blob scaduto e limite 64MiB gestiti in modo esplicito.
- [ ] AC-337.3: On the scoped input and failure cases, verify: PDF→pages e PNG→compress e CSV→export. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** PDF→pages e PNG→compress e CSV→export; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 02 — narrow PDF handoff

`src/runtime/ephemeral-file-handoff-337.ts` and `src/components/tools/pdf/PdfTool.tsx` now provide one real explicit user-triggered flow: locally verified <=64 MiB PDF result → same-origin popup `/tools/pdf-to-images/`, 30 s sender/receiver expiry, UUID fragment capability, origin+Window source validation, one-shot ACK, native destination File via `setFiles` without reselect, no network transfer/persistence or automatic execution. Existing PDF manifest does not claim generic input handoff; source/destination are narrowly audited and bounded. Focused tests 19/19 PASS. Isolated Chromium `pdf-merge` produced verified merged.pdf 1.9 KiB, recipient populated without picker; zero outbound POST / JS page errors. Browser harness had unrelated dev GET 404 and exited nonzero, so no clean full browser acceptance claim.

**Residual:** generalized PDF/PNG/CSV typed chains and adversarial expiry browser corpus still unproven. No Gold/release promotion or remote provider claim.

## 2026-10-11 implementation wave 03 — PNG → image compression

Premessa ricontrollata sul codice locale: PDF→pages era già operativo nel runtime/consumer PDF; PNG→compress mancava. Lo stesso runtime `src/runtime/ephemeral-file-handoff-337.ts` ora espone un adapter tipizzato `image/png` verso `/tools/image-compression/`, usando soltanto artifact locali verificati, bytes reali e File nativo. `ImageResultV2` offre il pulsante quando il risultato è un singolo PNG verificato e il tool sorgente non è già la compressione; `ImageVisualTool` riceve il File nello stato del compressore, presenta un messaggio accessibile e lascia all'utilizzatore l'avvio esplicito. Nessun download/reupload/upload, autostart o scrittura persistente nel protocollo.

Controlli effettivi: preflight su kind, MIME, verifica/download ready, firma/header/trailer PNG, estensione, dimensione reale fino a **64 MiB**; capability UUID v4 nel fragment URL, origin e Window opener vincolati, targetId/format tipizzati, expiry sender+receiver **30 s**, un solo payload e un ACK solo dopo il consumo sincrono. Se consumer rifiuta, è occupato o lancia errore, invia `rejected` e il mittente mostra l'errore, senza falso `received`. Popup bloccato, payload non valido, scadenza e opener indisponibile hanno comportamento esplicito; l'originale rimane disponibile in sorgente. Tutte le altre catene sono escluse dai nuovi adapter.

**Prove corrente (2026-10-11, Mac Studio):** `vitest run tests/ephemeral-file-handoff-337.test.ts tests/binary-handoff.test.ts` **17/17 PASS**, compresi payload falsificati e wrong-origin/window, consumi one-use, expiry, dimensione reale 64 MiB+1, popup bloccato, false ACK e ricezione invalid; `tsc --noEmit --pretty false` **PASS**. `node tests/acceptance-ephemeral-file-handoff-337.browser.mjs` **3/3 browser PASS** (Chromium, Firefox, WebKit): risultato PNG verificato nella vera UI `ImageResultV2` → apertura popup compressione → `ImageVisualTool` con file già ricevuto e nessuna auto-elaborazione → click manuale → risultato scaricato, riaperto da decoder Sharp indipendente (PNG 144×96, tre pixel confrontati con valori attesi calcolati indipendentemente); popup bloccato con errore visibile, nessuna richiesta off-origin e nessun errore JS. `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --check` **PASS** (zero mismatch, status canonico `ready-for-agent` mantenuto per ticket aperto). La fixture genera il risultato immagine in browser e verifica il passaggio via componenti reali, senza rivendicare un test da ogni possibile tool sorgente o un dispositivo mobile fisico.

**Resta OPEN:** AC-337.1 e AC-337.3 non sono integralmente soddisfatti finché **CSV→export** non viene implementato e provato nello scope autorizzato da chi possiede i componenti CSV shared. Nessuna modifica CSV condivisa, PdfTool, ticket #339/#341/#347, DAG/dashboard/docs, nessun deploy/commit/Gold. Il precedente handoff PDF mantiene test regression passati; nessuna nuova certificazione browser PDF è stata effettuata in questa wave.

## 2026-10-11 implementation wave 04 — CSV Cleaner → CSV Dedupe → export

**Codice esaminato su HEAD `bd919ac3`:** `src/runtime/handoff.ts` supporta già un protocollo `table/csv` a **stringa UTF-8** per alcuni tool compatibili, ma con limite 2 MiB, senza consegna di File nativo e senza ACK di consumo. Non è stato sostituito o alterato: il nuovo adapter `CSV_EXPORT_HANDOFF_TARGET_337` riusa esclusivamente il runtime effimero #337 già adottato per PDF/PNG e indirizza `/tools/csv-dedupe/`, dichiarato compatibile con input `table/csv` fino a 10 MiB. Le due superfici restano distinte.

**Percorso reale:** risultato completo e localmente riverificato di `CsvCleanerTool` → pulsante esplicito nell'istanza CSV di `CsvTableResultV2` → `startCsvExportHandoff337` con byte CSV UTF-8 (non la preview tronca) → nuova scheda stesso origin → `receiveCsvExportHandoff337` in `CsvDedupeTool` che conserva il `File` nativo nello stato del componente prima dell'ACK → lettura separata con errore esplicito se fallisce → pulsante manuale «Rimuovi duplicati» → `CsvTableResultV2` della destinazione → download manuale `deduped.csv`. Nessun avvio, scaricamento o caricamento remoto impliciti. La policy #339 e il suo opt-in sono stati **preservati**, non modificati.

**Limiti e difese verificati:** capacità monouso UUIDv4 nel fragment, origin+Window opener+token+targetID vincolati, 30 s, copia dei byte, firma logica type=file/format=csv/MIME=CSV/estensione `.csv`, UTF-8 strict e parser CSV locale, limite 10 MiB del consumer (più stretto del limite globale 64 MiB). Input/schede falsificati, payload scaduti/corrotti, dimensioni superiori, popup bloccati, rifiuto di consumer occupato e replay sono coperti da test del protocollo; il rifiuto autenticato conclude e libera subito la sessione senza falso ACK.

**Prove indipendenti:** test protocollo #337 e test CSV/#339 mirati; test Playwright `tests/acceptance-csv-export-handoff-337.browser.mjs` su **vere pagine Astro** `/tools/csv-cleaner/` e `/tools/csv-dedupe/` in Chromium, Firefox e WebKit **3/3 PASS**. File `records.csv` con duplicato passato davvero come byte, nessun file ripreselezionato, nessun risultato prima del click manuale, opt-in #339 OFF, `deduped.csv` scaricato e riletto da Python stdlib `csv.reader`: esattamente intestazione `name,amount`, righe `Marta,12` e `Luca,9`; zero richieste off-origin ed errori JS. Test browser negativo Chromium: lettura del File staged negata intenzionalmente tramite `File.stream`, errore esplicito e nessuna elaborazione/esportazione automatica. Nessuna pretesa di test mobile fisico.

**Status:** `ready-for-agent` e checkbox generali conservati in sospeso: il sotto-percorso CSV→export è concretamente provato, ma la vecchia prova PDF→pages era una verifica Chromium parziale con harness nonzero e non è stata ripetuta su tutte le condizioni #337 in questa tranche. Non segnare AC globali integralmente chiusi finché la matrice PDF, PNG e CSV con failure/expiration non è provata senza lacune. Nessun file PdfTool, image, video, download-policy, Gold, dashboard/index generati o docs condivisi editato per questa tranche; nessun commit/deploy.

**Revisione P1 e verifica finale:** dopo review indipendente il receiver `CsvDedupeTool` ora conserva il `File` nativo nello stato `receivedFile337` *prima* di emettere l'ACK, mentre la lettura/validazione avviene in un effect separato; un errore di `File.stream` appare nell'interfaccia, senza successiva elaborazione o download. Modifiche alla modalità deduplica o alle colonne chiave invalidano subito il risultato precedente e incrementano `revision`, impedendo che un'elaborazione avviata con opzioni precedenti venga pubblicata come corrente o registrata nei Recenti. Il mittente comunica soltanto che il file è **staged in memoria**, non che sia stato già parsato. Test finali: **55/55 PASS** in 7 suite Vitest mirate (#337, CSV e #339); browser su vere pagine Astro **Chromium/Firefox/WebKit 3/3 PASS** anche con invalidazione risultato per modalità/chiavi; caso negativo Chromium di lettura File negata **PASS**; Python `csv.reader` rilegge l'output; `ticket_dashboard.py --check` **PASS** (0 mismatch), `git diff --check` **PASS**. Non è stata eseguita nuova verifica TypeScript verde di repo completo: l'ultima esecuzione segnalava `TS6133 readdir` in test Gold #347 non modificabile in questo write-set. Stato e checkbox generali rimangono OPEN.
