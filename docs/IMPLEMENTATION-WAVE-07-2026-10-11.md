# Strumentini.it — wave 07, download CSV revocabile

Prosecuzione da commit locale `e3af0d1`; implementazione source-local del ticket #339 (parziale). Nessun provider produttivo, push, deploy, D1 o Gold. Il file storico untracked `tasks/prompt2prompt/.../001-strumentini-ticket-finalization.response.md` resta invariato.

## Cambiamenti reali

- Nuovo `src/runtime/browser-download-339.ts`: unica implementazione condivisa di richiesta download manuale/auto, riutilizza `planVerifiedDownload339` per verificare byte, nome, MIME e limite; finestra di revoca Blob URL ritardata, e su `createObjectURL` negato non finge il salvataggio OS.
- `StructuredTextResultV2.tsx` refactor senza cambiare permessi o opt-in JSON.
- `CsvTableResultV2.tsx`: controllo esplicito auto-download condiviso, inizialmente disabilitato, persiste solo con consenso browser e si revoca da checkbox o altra scheda. Nessun download retroattivo quando l'utente abilita un output già terminato, auto una sola volta dopo un **nuovo successo verificato**, mantenimento pulsante manuale e messaggi di errore veritieri. Un file CSV non viene caricato in cloud o usato come telemetria.
- Test nuovo `tests/acceptance-download-csv-339.mjs`, esecuzione Chrome 390px: producer reale, bytes scaricati e riletti, opt-in nuovo run solo, denied Blob URL, revoke, storage denial e fallback manuale, zero upload; **PASS**.
- Test JSON preesistente `tests/acceptance-download-optin-339.mjs` rafforzato con attesa idratazione isola Astro/Preact prima di digitare ed eseguire, per evitare un falso passaggio dovuto alla race SSR; regressione JSON **PASS**.

L'operazione non modifica file sorgenti dei producer, archivi privati, account o ricevute e non pretende che un click su link di download equivalga a salvataggio fisico. #339 resta aperto: altre famiglie file e browser popup/OS native devono essere verificate senza azzardare effetti automatici.

## Verifiche integrate

- Chrome locale JSON/CSV: **due acceptance PASS** con salvataggio dei byte verificato tramite rilettura, API rifiutata, storage negato e revoca. Il test JSON ora attende correttamente l'idratazione dell'isola Preact; un tentativo precedente senza quell'attesa aveva prodotto un risultato non valido e non viene conteggiato come PASS.
- Quattro test file mirati (download policy, CSV result v2, output facts e privacy): **24/24 PASS**.
- `npm test -- --maxWorkers=2`: **256/256 file e 1.937/1.937 test PASS**; original-200: 199 verificati, un rifiuto esplicito.
- `npm run check`: **0 errori/0 warning e 22 hints** su 1.995 file.
- `npm run build`: **292 pagine**, inspector PASS, 683 JS assets, 7.915 B JavaScript iniziale e 285 voci sitemap.
- Il dashboard canonico rimane **293 completati / 131 aperti su 424**, nessuna mismatch, 269 strumenti nel catalogo e **0 Gold correnti source-bound**. #339 è ancora aperto e la release resta NO-GO.
