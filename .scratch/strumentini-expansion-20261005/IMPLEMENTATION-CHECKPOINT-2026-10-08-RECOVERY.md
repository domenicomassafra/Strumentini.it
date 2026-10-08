# Strumentini.it — certificazioni ripristinate, prove video/PDF e limiti di release

Data: 2026-10-08. Questo documento è un handoff di engineering, **non** una certificazione di distribuzione in produzione. Non cancellare le worktree o gli artefatti di prova senza coordinamento.

## Interventi realmente implementati

- `26e6d38` — certificazione: `src/quality/oracle-append-only.ts` ricostruisce l'autorità con **259** voci a partire da quella attuale con **260**, togliendo soltanto voci finali, decrementando `entry_count`, richiedendo SHA-256 byte-identico con l'hash della ricevuta, e verificando che tutti gli oracle referenziati dalla ricevuta siano già presenti nello storico. Il digest storico `62dd5a3bfcc7f7b35282396110c3123c3b43be5430fd9e0ef3168c178059ebe7` è stato riprodotto esattamente. Controprove su manomissione oracle/metadati/hash/candidato nuovo rifiutano il rebind. Non sono state create né modificate le vecchie ricevute Gold.
- `7d20131` — video #232: corpus MP4 reale sintetico con sette file verificati mediante FFprobe, casi VFR, due tracce video + audio, rotazioni e durata di un'ora, skip di `mdat` virtualmente grande e rifiuto del `moov` oltre il limite. L'interfaccia espone la sola constanza/variabilità dei delta **decode-time STTS**, senza inferire FPS o CFR/VFR di presentazione. `tests/video-corpus-232.test.ts`; 49/49 test video mirati comunicati dal worker.
- `5c636f3` — PDF #218: aggiunta modalità opt-in, solo locale e limitata, di ricodifica immagini JPEG XObject `DCTDecode`, RGB 8-bit senza maschere e con un solo filtro. Confronta spazio, conserva struttura di pagina e contenuti testo/vettoriali, segnala images touched/skipped, motivo del salto e dimensioni prima/dopo. La modalità strutturale precedente resta di default. **Non** supporta tutti i JPEG, immagini CMYK/ICC, PNG/JBIG2, downsample né OCR. `tests/pdf-image-aware-218.test.ts`; 11/11 test mirati indicati dal worker.

## Stato corrente delle certificazioni

L'indice `quality/receipts/expanded-catalog-certification.json` rigenerato con autorità verificate riporta **260 strumenti**, **257 GOLD storici ora release-eligible** per il rispettivo gate, **2 PARTIAL** (`image-resize`, `microphone-recorder`) e **1 IMPLEMENTED_UNVERIFIED** (`video-inspector`). Gli ultimi tre restano BLOCKED: non possono ereditare Gold per effetto della prova crittografica dei 259 precedenti. Il gate di release globale e le evidenze fisiche rimangono indipendenti dalle ricevute storiche.

La prova di rebind riguarda il **solo append** del registro oracle: un qualsiasi cambiamento all'autorità preesistente non produce l'impronta SHA storica e torna `RECEIPT_ORACLE_IDENTITY_STALE`. Restano vincolanti il fingerprint manifest, le identità delle fixture e tutte le altre verifiche già previste dal motore di certificazione.

## Risultati e limiti di QA

- **Suite globale integrata finale** `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **1.215/1.215 PASS, 156/156 file** dopo integrazione PDF/video e test caching delle letture immutabili di certificazione (`/tmp/str-final-serial-test.log`). Il primo tentativo concorrente aveva 9 timeout ambientali, non PASS; il secondo ha rieseguito **tutta** la suite. Indice certificazioni rigenerato PASS, audit Original 200 PASS; nuovi test puri anti-tampering `2/2` PASS; quattro file mirati `21/21` PASS.
- Worker video: sette fixture indipendenti FFprobe, `49/49` mirati PASS; su worktree isolata **Astro build 280 pagine PASS** e **Chromium 390 px 28 browser checks PASS**. Su `main`, dopo la correzione TypeScript, **Astro check 0 errori/0 warning** (1700 file) e **build 280 pagine + inspection PASS**; log `/tmp/str-go2-check.log` e `/tmp/str-go2-build.log`.
- Worker PDF: `11/11` mirati PASS con shim reale di codifica JPEG, più `3/3` su `main` nel bundle mirato 21/21. Il test iniziale su Astro **dev** non ha ottenuto un PDF scaricabile ed è NOT PASS. Rifatta la prova sulla **build statica**, `npm run acceptance:pdf-image-aware` è **PASS** (`/tmp/str-go-pdf-browser.log`): Chromium desktop 390x844, PDF 108865 → 25082 byte; JPEG 108030 → 24263 byte; immagini ricodificate=1, saltate=0; testo e geometria invariati, differenza media per canale dei pixel decodificati 21,46; modalità predefinita conserva JPEG byte-identico; zero richieste offsite. Non è Gold o prova fisica/mobile reale.
- Il test di certificazione precedente è incappato in timeout ambientali durante altre esecuzioni simultanee sulla macchina; questi sono stati esplicitamente considerati non-PASS. L'indice successivo e i 21 test mirati sono PASS; non riutilizzare i log dei timeout come evidenza.

## Backlog non eludibile

I ticket #218/#232 restano aperti per i casi non testati; #236 richiede evidenze memoria su dispositivi fisici; #059 manca un ottimizzatore SVG indipendente. La catena fiscale #117 (fonte ufficiale) blocca #127/#128/#130 e dipendenti; la famiglia #053 necessita capacità di decrypt effettivamente supportata, non un rifiuto travestito da funzione. L'audit Original 200 conta 199 verificati e un rifiuto esplicito: non convertire il rifiuto in successo.

**Nessun deploy in produzione, nessuna promozione Gold per il nuovo inspector, nessuna prova fisica inventata.** Lo stato di `main` su GitHub va sempre verificato dopo il push, non inferito dai commit locali.
