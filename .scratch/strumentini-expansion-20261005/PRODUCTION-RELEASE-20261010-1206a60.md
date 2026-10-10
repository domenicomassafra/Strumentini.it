# Strumentini.it — produzione 2026-10-10, sorgente `1206a60`

## Identità del rilascio e rollback

- Produzione verificata: `https://strumentini.it`, Cloudflare Worker `strumentini`, versione `27bc07e0-1037-4ae8-a0fd-e0241406b318`, tag `git-1206a60`, traffico **100%** verificato con `wrangler deployments status` dopo il deploy.
- Versione immediatamente precedente (rollback *non* eseguito): `0f1329c5-d1ab-4418-85b7-f5c254128944`, tag `git-cdb6bb8`. Non assumere che sia sempre la precedente dopo altri rilasci; ricontrollare Wrangler.
- `wrangler versions upload --strict --tag git-1206a60` ha caricato 998 asset nuovi (664 già presenti), senza spostare il traffico. Il successivo `wrangler versions deploy 27bc07e0-1037-4ae8-a0fd-e0241406b318@100 --name strumentini --yes` è terminato con `SUCCESS`.
- Nessun canary 10%: il precedente canary aveva causato 404 asset OCR fra versioni non sticky; la promozione di questo set multi-asset è stata direttamente al 100% dopo i gate.

## QA sorgente e correzione del test

- Build dal checkout pulito e detached `1206a60`, 291 pagine, check di ispezione della build `PASS`, 664 asset JS, controllo portable static di 1.662 file `PASS`, Cloudflare dry-run 1.959 file `PASS` con `AUTH_DB`/`ASSETS`.
- Prima suite sullo stesso commit: 219/220 suite e 1727/1728 test PASS, **uno fallito** per l'aspettativa storica `releaseEligibleGoldCount=257`, non per malfunzionamento runtime.
- Il nuovo PDF password-supplied #320 ha reso stale il precedente Gold di `pdf-password-check-remove`; il certificatore **correttamente** conserva 257 ricevute storiche ma autorizza **256** strumenti e blocca `pdf-password-check-remove` per `RECEIPT_MANIFEST_IDENTITY_STALE`. La regressione è stata corretta con asserzioni esplicite in `tests/certification-index.test.ts`, commit selettivo e push GitHub `f84f106`.
- Differenza `1206a60...f84f106`: **solo quel test**, nessuna modifica a runtime, asset o manifest. Seconda suite eseguita dal checkout pulito detached `f84f106`: **220/220 suite, 1728/1728 test PASS** (log `/tmp/str-f84f106-tests.log`). `certification:check`, `tickets:check` e `git diff --check` PASS sul progetto principale. Gold ri-certificazione PDF #320 **non** dichiarata, physical iOS/Android **NOT RUN**.
- `npm run check` sullo stesso checkout `f84f106`: **1911 file, 0 errori, 0 warning, 21 hint non bloccanti**, exit `0` (log `/tmp/str-f84f106-check.log`).
- Log di prova: `/tmp/str-1206a60-build-direct.log`, `/tmp/str-1206a60-deploycheck-direct.log`, `/tmp/str-1206a60-upload.log`, `/tmp/str-f84f106-deploy.log`, `/tmp/str-f84f106-tests.log`.

## Smoke su dominio reale

- Controllo HTTP con `HEAD` 200 su 13 URL: `/`, `/strumenti/`, `/tools/pdf-password-check-remove/`, `/tools/pdf-to-images/`, `/tools/video-inspector/`, `/tools/audio-generator/`, `/tools/xml-formatter-validator/`, `/tools/ocr-italiano-locale-246/`, `/tools/pdf-compression-lite/`, `/tools/pdf-split/`, `/sitemap.xml`, `/ocr-246/lang/ita.traineddata.gz`, `/ocr-246/vendor/worker.min.js`.
- `GET /api/auth/session` via curl restituisce **200** e `{"user":null}`, perciò **14/14** sui metodi corretti. `HEAD` su questa sola rotta restituisce `405` perché non è il metodo supportato. Un client Python urllib ha ricevuto 403, mentre curl con e senza browser-like headers ha ricevuto 200; non attribuire la differenza al Worker senza indagine del gateway/WAF.
- Eseguito sul dominio reale, Chromium 390×844, `PDF320_BROWSER_ORIGIN=https://strumentini.it node scripts/acceptance-pdf-password-320.browser.mjs`: AES256 utente corretto → PDF senza cifratura realmente scaricato e riaperto in PDF.js con 2 pagine; password errata rifiutata, input password svuotato, qpdf WASM same-origin, 2 Worker aperti/chiusi, 0 richieste offsite, 0 JS error e 0 overflow. Log `/tmp/str-1206a60-password-live.log`. Queste sono prove desktop browser, non physical mobile.

## Dashboard al momento del deploy e lavoro successivo

- `npm run tickets:check`: **327 totali / 274 completed / 53 OPEN**, 0 mismatch, `completedWithRefusal=17`. Partenza precedente **65 OPEN**; 12 chiusure effettive prima del deploy odierno, nessuna nuova chiusura attribuita ai quattro worker ancora in esecuzione.
- Worker indipendenti in corso dopo questo rilascio: #57 PDF→DOCX/strutturato, #306 Video→GIF, #241 firma **visiva, non crittografica**, #36 audio. Questo deploy **non** include i loro file dirty o le loro modifiche future.
- Tre file immagine originali dirty preservati integralmente, non staged: `src/components/tools/image-visual/ImageResultV2.tsx`, `src/components/tools/image-visual/ImageVisualTool.tsx`, `src/engines/image/visual-tools.ts`.
