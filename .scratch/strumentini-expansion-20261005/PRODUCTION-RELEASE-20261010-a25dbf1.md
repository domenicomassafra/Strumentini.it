# Strumentini.it — rilascio Cloudflare 2026-10-10 `a25dbf1`

## Deploy e rollback

- Repository GitHub `domenicomassafra/strumentini-it`, `main` al commit `a25dbf1` (sorgente esatta della build in checkout detached).
- URL: `https://strumentini.it`. Worker Cloudflare `strumentini`, versione `32956b26-6c3c-4a22-92c5-ae29be8e7f65`, tag `git-a25dbf1`.
- Upload `wrangler versions upload --strict` riuscito: 553 asset nuovi, 1134 riutilizzati. Deploy `wrangler versions deploy 32956b26-6c3c-4a22-92c5-ae29be8e7f65@100` riuscito; interrogazione indipendente `wrangler deployments status --name strumentini` conferma **100%** su una sola versione.
- Versione immediatamente precedente al deploy: `f492f02d-2c12-4997-a857-fedb1da8084f` (`git-5b011df`). **Non è stato effettuato alcun rollback**. Rileggere sempre Wrangler prima di un rollback successivo.

## Gate riproducibili sul checkout pulito

- `npm run check`: Astro **1941 file**, 0 errori, 0 warning, 22 hint non bloccanti; catalogo generato **269 tool**.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **230/230 suite, 1774/1774 test PASS**.
- `npm run build`: **291 pagine statiche**, `build inspection PASS`, 677 asset JS e route/catalogo invariati in cardinalità.
- `npm run deploy:check`: Wrangler dry-run **PASS** su **1984 file asset**, binding `AUTH_DB` D1 e `ASSETS`.
- `npm run tickets:check`: **327 totali, 284 completed, 43 OPEN, 0 mismatch**. L'inizio del ciclo era **262 completed / 65 OPEN**; sono stati chiusi **22** ticket in totale. `completedWithRefusal=17` rimane esplicito.
- Audit originale funzionale `npm run audit:original-200:final`: 200/200, 199 verificati e 1 rifiuto documentato.
- Copertura formati `npm run format:coverage:check`: 63 righe, 41 implementate, 16 bloccate, 6 rifiutate; HEIC sperimentale sintetico **non release-eligible**.
- Certificazione: 257 ricevute Gold **storiche**, ma **255 release-eligible**: PDF password e audio generator hanno ricevute manifest precedenti stale, restano bloccati alla ri-certificazione.
- Output logs `/tmp/str-a25dbf1-{check,tests,build,deploycheck,upload,deploy}.log` sulla workstation QA.

## Verifiche sul dominio Cloudflare reale dopo il deploy

- `wrangler deployments status`: tag `git-a25dbf1`, Worker versione `32956b26-6c3c-4a22-92c5-ae29be8e7f65`, traffico **100%**.
- HTTP 200 su `/`, `/strumenti/`, `/cerca/`, `/tools/pdf-watermark/`, `/tools/pdf-text-extraction/`, `/tools/video-inspector/` e `/tools/pdf-to-markdown/`.
- `GET /api/auth/session`: HTTP 200, `{"user":null}` senza login.
- `/tools/pdf-scansionato-ocr-247/`: HTTP **404** intenzionale: il candidato #247 è **solo development**, route Astro dinamica `getStaticPaths` ritorna zero percorsi in produzione e non aggiunge una pagina catalogo.
- `JOB45_ORIGIN=https://strumentini.it node scripts/acceptance-job-routes-45.mjs`: **PASS** Chromium 390 e 1280 px: quattro topic e quattro percorsi canonici reali, 269 tool contati dal catalogo, motore EXIF trovato, paginazione, anchor reale firma visiva, nessun overflow.
- `PDF241_PUBLIC_ORIGIN=https://strumentini.it PDF241_BROWSER={chromium,firefox,webkit} npx tsx tests/pdf-visual-signature-ui-241.browser.ts`: **51/51 PASS** in ciascuno, **153/153 in totale**. Tre viewport 320/390/1440; PDF di tre pagine reale, originali e risultati riaperti/pixel PDF.js, PNG/testo/disegno, rifiuto PDF firmati e con moduli, zero offsite e nessun errore browser. Questo è **desktop browser con viewport**, non hardware fisico iPhone/Android.
- La regression originale della pagina watermark `npx tsx tests/pdf-watermark-239.browser.ts` ha riaperto i PDF e verificato stream/testo e pixel, **PASS** contro lo statico compilato dello stesso cambiamento.

## Scope e integrità

- Nuove chiusure di questo segmento: #241 firma **grafica visiva, NON digitale** su PDF semplici; #66 audit originali 200; #45 ricerca/percorsi catalogo; #65 matrice formati con prova binaria. Le chiusure precedenti del ciclo includono #33/#36/#38/#53/#57/#306 e altri tranci verificati nei rapporti anteriori.
- #247 OCR PDF ricercabile è una implementazione di laboratorio, **ticket ancora OPEN** per #246/#271 e prove fisiche/scala/orientamento/memoria. Nessuna promozione pubblica o Gold.
- 3 file altrui dirty **NON committati e NON distribuiti**: `src/components/tools/image-visual/ImageResultV2.tsx`, `src/components/tools/image-visual/ImageVisualTool.tsx`, `src/engines/image/visual-tools.ts`.
- Non sono stati creati nuovi ticket; nessun reclamo di funzionalità universale, rilascio Gold non provato o verifica hardware inesistente.
