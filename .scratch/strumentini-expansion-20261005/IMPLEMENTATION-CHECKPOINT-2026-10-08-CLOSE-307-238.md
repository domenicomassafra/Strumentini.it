# Strumentini.it — sprint chiusura #307, #238 e #313 (2026-10-08)

Repository Mac `/Users/domenico/Code/Strumentini.it`. Non è stato eseguito alcun deploy in produzione. Per lo stato Git esatto usare `git status --short --branch`, `git rev-parse HEAD` e `git ls-remote origin refs/heads/main`, non lo snapshot di questo handoff.

## Chiusure formali implementate

- **#307 completato — audio LUFS locale**: commits `fd799de` e `bbe96d1`. Analizzatore offline ITU-R BS.1770-5 48 kHz, mono/stereo, K weighting e doppio gate EBU Tech 3341 su blocchi 400 ms con hop 100 ms. Integrati/momentary/short-term, sample peak dBFS (NON true peak), limiti 0,4–60 s, 20 MiB e nessuna conformità broadcast certificata. UI nel tool audio esistente; no route inventate, input resta locale. **5/5 Vitest**, `npm run acceptance:audio-loudness` **PASS Chromium, Firefox, WebKit** usando WAV reale generato a 997 Hz -20 dBFS: i tre browser misurano **-23,01 LUFS**, zero richieste esterne, viewport 390×844. Issue marcato completed con checklist e fonte/limiti dichiarati.
- **#238 completato — numerazione pagine PDF**: commits `be0bcc9` e `b1e577b` (cherry-picked dai worker `2379e6c` e `f4df5d9`). Nuovo strumento `/tools/pdf-page-numbers/` via manifest con cand-261 senza Gold receipt. Numerazione e anteprima geometrica reale basata sulle miniature PDF.js; supporto range validi, start/offset, 6 posizioni, 3 font standard e margini. Originali PDF `/Contents` byte-identici e pagine/count/geometry verificati. **18/18 test del motore**, browser Chromium 390px su static build PASS: quattro pagine, 2/3 numerate, pagina 1 = **0 pixel modificati**, pagina 2 **120 pixel modificati** vicino al margine in basso a destra, pagina 3 **124 pixel** in stessa area, seconda prova **top-center 120 pixel** in area corretta. Output reale scaricato, riaperto e renderizzato con PDF.js, zero offsite. **NO nuovo Gold/physical-device**, closure significa le tre acceptance funzionali, non release globale.

## Terzo ticket completato nel sottoinsieme dichiarato

- **#313 completed — conversione SVG statico sicuro in raster/PDF**, commits `36ea1ff` (worker3 `cf12316`) e `8bfd416` (worker3 `1e4aa2f`). Sanitizzatore XML restrittivo, no script/entità/style/external URI/foreignObject, massimi 1 MiB/1000 nodi/16 livelli/16 milioni pixel, output locali PNG/JPEG/WebP oppure PDF **raster-backed JPEG** (non PDF vettoriale). Modalità nello strumento image-format-conversion, espressamente *non Gold* nonostante il Gold storico del genitore. **Chromium 44/44, Firefox 44/44, WebKit 44/44 verifiche del comportamento atteso PASS**: Chromium/Firefox scaricano 4 formati reali; WebKit scarica PNG/JPEG/PDF ma **rifiuta WebP** correttamente perché il suo encoder canvas produce PNG, senza file fasullo. In ciascun motore 13 SVG malevoli respinti e zero offsite; screenshot e receipt SHA256 in `tests/svg-313-receipts`. Checklist v1 chiusa solo per **sottoinsieme statico e capability-gated**: restano fuori CSS/gradients/font esterni, WebP WebKit, dispositivi fisici e Gold.

## Indice e DAG aggiornati

- La correzione necessaria `quality/oracles/registry.json` aggiorna `entry_count` da **260 a 261** quando è stato aggiunto `cand-261`, senza modificare alcuna voce precedente. `npm run certification:build` e check PASS, con la prova di successione crittografica delle autorità precedenti già presente in `src/quality/oracle-append-only.ts`.
- Catalogo **261 strumenti**: **257 Gold storici idonei** sui rispettivi gate, **2 Partial**, **2 IMPLEMENTED_UNVERIFIED** (`video-inspector`, `pdf-page-numbers`), quattro strumenti blocked come da `quality/receipts/expanded-catalog-certification.json`; non sono state emesse nuove ricevute Gold.
- Dashboard generata: **327 ticket: 249 completed (18 esplicitamente refused), 78 OPEN; 17 ready-for-agent, 53 in attesa dipendenze, 2 fonte, 5 device, 1 capability, 0 mismatch**. `npm run tickets:sync` e `tickets:check` eseguiti. La catena fiscale resta bloccata dalla fonte ufficiale #117, e i test fisici Android/iOS non sono stati inventati.

## QA principale

- `npm run check` dopo catalogo 261: **0 errori, 0 warning, 17 hint su 1713 file** (`/tmp/str-261-check.log`).
- `npm run build` dopo catalogo 261: **281 pagine PASS** e build-inspection PASS (`/tmp/str-261-build.log`).
- `node node_modules/tsx/dist/cli.mjs tests/pdf-page-numbers-238.browser.ts`: **PASS** anche dopo integrazione su `main` (`/tmp/str-261-pdf-browser.log`).
- Browser SVG Chromium dopo cherry-pick `36ea1ff`: **44 PASS** su build 280 (`/tmp/str-svg-main-browser.log`) e `npm run check` 0 errori.
- `npm run acceptance:audio-loudness`: **3 desktop browser PASS** (`/tmp/str307-matrix.log`).
- **Ultimo QA sul catalogo 261 dopo tutte le integrazioni:** `npm run check` **0 errori, 0 warning, 17 hints su 1713 file** (`/tmp/str-261-complete-check.log`), `npm run build` **281 pagine + build inspection PASS** (`/tmp/str-261-complete-build.log`). Sulla build finale nuova: SVG browser sequenziali **Chromium 44/44, Firefox 44/44, WebKit 44/44 PASS** (`/tmp/str-261-svg-{chromium,firefox,webkit}.log`), dove WebKit WebP è espressamente una capability **non disponibile/rifiutata**, non conversione; audio Chromium+Firefox+WebKit WAV a −23,01 LUFS PASS (`/tmp/str-261-audio-browser.log`); PDF page numbering con download/rerender reale PASS (`/tmp/str-261-pdf-browser-final.log`). Firefox può produrre PNG byte-differenti su riesecuzioni nonostante firma, pixel semantici, dimensioni ed esito corretti: preservare lo SHA per singola sessione invece di presumere byte-determinismo fra sessioni.
- La prima suite globale post-merge catalogo 261 ha rilevato quattro asserzioni vecchie che aspettavano 260 tool/Gold per tutte le route PDF. Non erano errori del motore ma la suite è stata **FAIL**. Corrette le asserzioni per 261 e due unverified con Gold fail-closed; quattro file mirati **12/12 PASS** (`/tmp/str-261-retest2.log`). La seconda suite globale **npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000** è **PASS 1.241/1.241 test, 159/159 file** (`/tmp/str-261-full-final.log`), eseguita dopo l'integrazione dello SVG multi-browser e della nuova route PDF, senza togliere alcun test.

## Lavoro ulteriore

Per #313 supporto SVG complesso/web fonts e certificazione modalità. Per #238 Gold/physical-device/mixed-document corpus separati dalla closure delle tre acceptance funzionali. Per #218 compressione PDF misti/scan e prova su dispositivi. Per #232 MP4 HEVC/fragmented/videos camera reali, full capture, Gold. Per tutti gli altri ticket usare DAG/dashboard aggiornati, non vecchi snapshot.

Nessuna promozione di produzione, nessun certificato Gold fabbricato, nessun push di branch worktree; conservare i loro link e dipendenze non tracciate.
