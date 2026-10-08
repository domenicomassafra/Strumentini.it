# Strumentini.it — handoff dello sprint 2026-10-09, 264 strumenti

Repository Mac Studio: `/Users/domenico/Code/Strumentini.it`; controllare sempre `git status --short --branch`, `git rev-parse HEAD`, `git ls-remote origin refs/heads/main`, dashboard generata e `npm run certification:check`. Nessun deploy in produzione autorizzato da questo documento.

## Baseline e backlog

Baseline all'avvio: `19f4f3ad36655bdc40bdaefccd128980fdc6be1a` su main e origin/main, pulito; 327 ticket, 253 completati (18 per rifiuto, non implementati), **74 aperti**; catalogo 263 tool, 257 Gold storico, 2 Partial, 4 IMPLEMENTED_UNVERIFIED.

Dopo tre corsie indipendenti, **#266**, **#240** e **#68** hanno i criteri funzionali verificati e status `completed`. Dashboard derivata: **256 completati, 71 aperti**, di cui 18 rifiuti storici, 16 ready-for-agent, 47 dipendenze, 2 fonti ufficiali, 5 device fisici, 1 capability. I 71 non sono sinonimo di funzioni obbligatoriamente implementabili ora. Il release finale resta NO-GO finché i blocker non vengono realmente chiusi.

## #266 — Analisi dimensioni Office e media (Prime)

Commit `6a34a63`: `src/engines/file-privacy/size-adapters.ts` + analizzatore esistente. File Office DOCX/PPTX/XLSX veramente riconosciuti dalla firma ZIP + parser OOXML + concordanza nome/tipo; conti compressi/espansi per XML/media/font/altro, ZIP overhead, parti più pesanti. WAV solo PCM lineare RIFF sicuro; header/campioni validati per durata, sample rate, canali e bitrate teorico dichiarato. MP4 solo bounded local moov inspector già approvato #232: container bitrate se provato, audio/video FourCC e track count, FPS e bitrate per stream sconosciuti; MP4 frammentato durata non dimostrata. `estimatedSavingsBytes=null` sempre, nessuna offerta di compressione video/audio non approvata. `sourceSha256` e sorgente immutata. `tests/file-size-adapters-266.test.ts` 8/8 PASS, `tests/file-privacy-engine.test.ts` 16/16 PASS, TypeScript noEmit PASS, public Chromium route `tests/file-size-266.browser.mjs` **21/21 PASS** con Office, MP4, frammentato e assenza POST/offsite. Gold storico conservato, nessuna nuova receipt fabbricata.

## #240 — Visual crop e normalize PDF (Worker4)

Commit da worktree isolata `6d5bf26`, integrato su main `1d9b725`: UI `/tools/pdf-crop-normalize/` e engine `crop-normalize.ts`; crop cambia il CropBox e NASCONDE i byte fuori bordo (non cancella, non è redazione!), normalizzazione `contain` scala+centra o `center` senza scala se il box entra interamente, A4/Letter/custom, rotazioni e CropBox traslati, range stretti e geometrie verificate. Originali Contents byte-identici. 10/10 Vitest PASS, browser vero Chromium 390x844 PDF scaricato e re-render PDF.js PASS con pagina non selezionata invariata, nessun offsite. Oracle append-only `cand-264`, **IMPLEMENTED_UNVERIFIED**; Gold/physical/native PDF complexity separati.

## #68 — Compressione Office completa per il perimetro bounded (Worker3)

Commit da worktree isolata `b13bb01`, integrato su main `e546b26`. Riusa `/tools/ooxml-media-compression/` e core #264; presenta statistiche ZIP media/XML/fonts/altro prima/dopo e net %. Profili conservativo, bilanciato e compatto con opt-in separati JPEG/WebP lossy e resize. Source Office XML/rels/chart/stili/parti non-media invariati byte per byte; animazioni/codec non verificati skip/fail-closed. Corpus DOCX/PPTX/XLSX veri con immagini, chart, tabelle, font styling e hyperlink. Chromium UI **67/67 PASS**, 3 output reali scaricati e riaperti indipendentemente con Python; Vitest focalizzati **29/29 PASS**. Riduzioni su esempi: DOCX 201209→87929 bytes, PPTX 198595→76226, XLSX 171698→25863. Browser desktop viewport mobile e CDP JSHeapUsed campionato; NON è peak RAM iPhone/Android, né certificazione visual di Microsoft Office/LibreOffice. Questi gate restano non provati, indipendenti dalla chiusura delle quattro AC funzionali.

## QA integrata e release boundary

- Registro `quality/oracles/registry.json` ora 264 entry contigue con `entry_count=264`. Catalogo **264** tool. Devono restare **257 Gold storiche release-eligible**, 2 Partial e **5 IMPLEMENTED_UNVERIFIED** (`video-inspector`, `pdf-page-numbers`, `pdf-watermark`, `ooxml-media-compression`, `pdf-crop-normalize`); totale 7 release-blocked e physicalDevicePassCount=0. Nessuna modifica alle receipt Gold storiche. Compatibilità SHA append-only ricostruita crittograficamente col test aggiornato a 264.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000` **1308/1308 PASS, 166/166 file** in `/tmp/str-go-264-full-confirm.log`; prima run ha individuato solo vecchio count hardcoded `263` nel test oracle lineage, aggiornato con 2/2 PASS e poi full suite verde.
- `npm run check`: **1741 file, 0 errors, 0 warnings, 17 hints** da `/tmp/str-go-264-check.log`.
- `npm run build` e browser su build integrata: verificare log prima di proclamare PASS. Browser standalone worker #240/#68 e prime #266 descritti sopra sono già PASS su rispettive build.
- Nuovi gate reali (browser multipli, iOS/Android fisici, font/media/memory) restano unverified. **Non promuovere Gold né deploy.**

## Prossime dipendenze ad alto rendimento

#218 sblocca #219/#249/#265; #212 sblocca #049/#235; #234 sblocca #306 e ramo #038; #246 sblocca #247/#031; #250 sblocca #251/#033; #256 sblocca #056/#033; #047 e #059 consolidano immagini e formato-gates. Per produttività usare le due worktree preservate `/Users/domenico/Code/Strumentini-wt-218` PDF e `/Users/domenico/Code/Strumentini-wt-232` Office, controllando che i commit vecchi siano già cherry-picked in main; mai cancellare `node_modules`, `.vitest`, altri untracked non propri. No full-suite concorrente in worker.

## Integrazione finale riproducibile

Astro `npm run build` **284 pages PASS**, `build inspection PASS` (619 asset JS, initial route JS 7144 B), log `/tmp/str-go-264-build.log`. `npm run check`: **0 errors / 0 warnings / 17 hints** su 1741 file, log `/tmp/str-go-264-check.log`. `npm run certification:check`: **264 tools, 257 Gold eleggibili nei rispettivi gate, 2 Partial, 5 IMPLEMENTED_UNVERIFIED, 7 release blocked**. `npm run tickets:check` PASS, 327 = 256 completed (18 refused) + 71 open.

Playwright su **stessa build integrata finale** dopo cherry-pick: `node tests/file-size-266.browser.mjs` **21 PASS** (log `/tmp/str-go-264-files-browser.log`); `npx tsx tests/pdf-crop-normalize-240.browser.ts` **PASS**, overlay crop/normalization PDF re-render e unchanged content streams, zero offsite (`/tmp/str-go-264-pdf-browser.log`); `node tests/ooxml-68.browser.mjs` **67 PASS**, DOCX/PPTX/XLSX scaricati e riaperti, no-op conservativo veritiero e zero offsite (`/tmp/str-go-264-ooxml-browser.log`). La prova PDF mostra normalizzazione indipendente senza differenze pixel del contenuto sorgente visibile ed errore medio di raster crop campione inferiore a 2/255.

**Full suite integrata** `/tmp/str-go-264-full-confirm.log`: **1.308/1.308 PASS in 166/166 file** con serializzazione dei file e 2 worker, incluso test oracle crypto 264 dopo correzione di una sola vecchia expected-count. Nessun esito generico Gold o physical-device attribuito alla prova desktop Chromium viewport 390. Nessun push/deploy deve essere dichiarato senza ispezionare gli SHA remoti dopo il commit.
