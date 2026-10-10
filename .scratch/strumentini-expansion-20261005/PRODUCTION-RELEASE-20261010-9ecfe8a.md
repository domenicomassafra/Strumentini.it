# Strumentini.it — produzione 2026-10-10, sorgente `9ecfe8a`

## Deploy verificato

- GitHub `main` pubblicato a `9ecfe8a` prima della build; versione applicativa Cloudflare `064725ef-923c-40ad-ae80-be44c99dba4c`, tag `git-9ecfe8a`.
- Cloudflare Worker `strumentini` su `https://strumentini.it`: `wrangler versions deploy 064725ef-923c-40ad-ae80-be44c99dba4c@100 --name strumentini --yes` SUCCESS, `wrangler deployments status` conferma **100%** sulla nuova versione.
- Rollback candidate immediatamente precedente: `27bc07e0-1037-4ae8-a0fd-e0241406b318` (`git-1206a60`). Rileggere sempre lo stato attuale prima di un eventuale rollback.
- Upload versione immutabile: 970 file nuovi, 708 già presenti; 52,58 KiB codice Worker (gzip 12,10 KiB), build assets `1975` file. Nessun canary 10% per evitare mix versioni con asset OCR non sticky.

## Source QA isolata e gate

- Checkout detached `/Users/domenico/Code/Strumentini-prime-cleanqa-20261009` al commit esatto `9ecfe8a`; collegamento `node_modules` escluso dal source. Fonte piena checkout separata dal WIP e dai tre file immagine dirty di altri.
- `npm run check`: **1925 file, 0 errori, 0 warnings**, 21 hint non bloccanti.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **225/225 suite, 1748/1748 test PASS**, dashboard `327 totali / 279 completati / 48 aperti`, 0 mismatch, audit originale `200/200` final (199 verificati e uno rifiutato esplicitamente).
- `npm run build`: **291 pagine**, 672 asset JS, `build inspection PASS` (290 pagine metadata uniche, 284 URL in sitemap).
- `npm run deploy:check`: Cloudflare Wrangler dry-run **PASS** su 1975 asset, binding `AUTH_DB` e `ASSETS` invariati.
- Log: `/tmp/str-9ecfe8a-check.log`, `-tests.log`, `-build.log`, `-deploycheck.log`, `-upload.log`, `-deploy.log`.
- Certificazione: 257 **ricevute Gold storiche**, solo **255 Gold release-eligible**. #320 password PDF e `audio-generator` #036 rimangono `GOLD` storico ma releaseGate `BLOCKED` per `RECEIPT_MANIFEST_IDENTITY_STALE`; nessun Gold o prova fisica inventati.

## Verifiche browser **direttamente su produzione**

- `PDF33_ORIGIN=https://strumentini.it node tests/pdf-productivity-family-33.browser.mjs`: Chromium 390×844 **20/20 PASS**, nove route canoniche collegate; nessun offsite, errore JS o overflow.
- `PDF57_ORIGIN=https://strumentini.it node tests/pdf-docx-57.browser.mjs`: Chromium/Firefox/WebKit **3/3 PASS**, tre DOCX reali scaricati e riaperti via `python-docx`, tre marcatori di pagina e sorgente/provenienza, invalidazione risultato stale; nessuna richiesta offsite.
- `VIDEO306_ORIGIN=https://strumentini.it VIDEO306_SOURCE=mp4 node tests/video-gif-306.browser.mjs`: reale MP4→GIF **26 verifiche PASS**, GIF **1788 byte** letto da Pillow, 15 frame / 1500 ms, cambiamento pixel verificato, Worker 3 creati/3 terminati, offsite assente.
- `VIDEO38_BASE=https://strumentini.it node tests/video-transform-family-38.browser.mjs`: **61/61 PASS**, tre MP4 reali H.264+AAC scaricati e verificati indipendentemente con FFprobe: MP4 27463→8824 byte, WebM 24465→11714 byte, A/V durata 1.578667s per trim richiesto 1.5s, sincronizzazione stream ±180ms, Worker 5/5 terminati, nessun offsite, errore JS o overflow.
- `HEAD https://strumentini.it/tools/video-inspector/` HTTP **200**; `GET https://strumentini.it/api/auth/session` HTTP **200** e `{\"user\":null}`; Cloudflare status Worker **100%**. I check della precedente release `1206a60` avevano inoltre provato live 14/14 route/metodi e PDF AES256 e PDF→PPTX, ma non vanno confusi con una ripetizione completa di quelle operazioni su `9ecfe8a`.
- Queste sono prove browser desktop con viewport mobile; **non** prove hardware fisiche iOS/Android né certificazione Gold per codice appena cambiato.

## Ticket chiusi nel presente rilascio

- Nuove chiusure funzionali **#033** PDF productivity, **#036** audio WAV locale, **#038** compressione/conversione video bounded, **#057** PDF→DOCX/MD/tabelle XLSX/PPTX, **#306** video→GIF: da 53 a **48 OPEN**, completati da 274 a **279**, partenza del ciclo 65 OPEN / 262 DONE. L'implementazione #241 della firma visiva PDF rimane **OPEN**, solo candidata privata non pubblicata, per controlli di sicurezza/dispositivo e iscrizione route; non è stata nascosta nel catalogo pubblico.
- #058 PDF↔immagini rimane **BLOCKED**: sintetico HEIC 811 byte è verificato browser, ma manca evidenza HEIC autentico da iPhone, memoria/orientamento fisici e gate #268/#212; non chiamare production-approved il codec né inventare nuova chiusura.
- `src/components/tools/image-visual/{ImageResultV2.tsx,ImageVisualTool.tsx}` e `src/engines/image/visual-tools.ts` restano **WIP di un altro worker e non sono stati committati o distribuiti** da questo rilascio.
