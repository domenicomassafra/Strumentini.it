# Strumentini.it — donor-first safety + official-source release, 2026-10-10

## Identità e promozione effettiva

- **Codice source distribuito**: `0452b35de3da19c69f59c7af55b6ff7c7b9f86cd`, due commit selettivi sopra GitHub `77fc859`: `509b2d6` e `0452b35`.
- **GitHub**: push normale `origin/main` riuscito, `git ls-remote origin refs/heads/main` uguale a `0452b35`, divergenza `0 0` al momento del rilascio. Un eventuale successivo commit solo documentale non è nuovo sorgente di produzione.
- **Cloudflare Worker `strumentini`**: nuova versione `d66c79f7-1d56-4ba1-af1a-cbfbf9dab381`, tag `git-0452b35`, versione precedente `cc62911c-dcc7-4500-ae49-b9a4d48d4d42` (git `8555c07`); `wrangler versions upload --strict` ha caricato 722 asset, 919 già caricati. Promozione autorizzata con `wrangler versions deploy d66c79f7-1d56-4ba1-af1a-cbfbf9dab381@100 --name strumentini --yes`, risultato SUCCESS e `wrangler deployments status`: **(100%) nuova versione**.
- Rollback NON esercitato: la versione precedente immediata rimane `cc62911c-dcc7-4500-ae49-b9a4d48d4d42`. Non utilizzare rollout percentuale 90/10 con asset multipli OCR senza sticky routing, perché era già stato dimostrato che provoca 404 incrociati. Nessuna modifica a D1, auth, secrets o triggers.

## Cambiamenti reali e limiti di accettazione

- **#218 PDF**: JPEG con EXIF/ICC/Adobe APP metadata non vengono ricompressi impropriamente dal decoder browser, che potrebbe cambiare orientamento/colore del PDF; rifiuto per singola immagine e originale preservato. Operazioni native decode/encode/Blob interruptible mediante race AbortSignal con chiusura di bitmap tardiva e rilascio canvas. Test genuinamente RED con JPEG EXIF orientamento 6, poi **21/21 GREEN** fra source, maschere e compositing. Ticket ancora OPEN: nessuna prova arbitraria di fedeltà PDF o dispositivo fisico.
- **#117 IVA**: due PDF ufficiali MEF/DEF `DPR 633/1972` congelati SHA256 e letti integralmente da PDF.js, 13 pagine integrali Tabella A e 1 pagina Articolo 16. Fonte integrale porta esplicitamente `in vigore 13/12/2025–01/01/2027`, perciò il motore limita al **13–31 dicembre 2025** quattro categorie esatte condizionatamente dichiarate dall'utente (22/4/5/10%) e delega l'aritmetica in centesimi al vero #126; non inferisce alcuna classe o operazione imponibile. Nuovi test **7/7 PASS**, ma #117/#126 annuale OPEN senza fonte completa per 01/01–12/12/2025, presupposti legali e INPS.
- **#115 ISTAT**: 4 snapshot ufficiali SITUAS report 51/50/61 con codici catastali esatti alle date **1900-01-01 (8.262), 1940-01-01 (7.336), 2025-01-01 (7.896), 2026-01-01 (7.896)**, relativi metadata/provenienza e SHA256 deterministico. Offline lookup rifiuta tutte le altre date anziché dedurre intervalli storici. Generator `node scripts/build-italy-geography-115-date-exact-20261010.mjs --check` PASS (`f467624127e62e2ffc3e99b24001757e5d7f815de22c59ee77a2b6a97755a373`), nuovi test **5/5 PASS**. Rimangono 15 identità municipali storiche non risolte e 23 codici esteri; #115 e figli restano OPEN. Dataset pinned in repository, non automaticamente distribuito nel catalogo pubblico.

## QA fonte isolata e reale produzione

- Checkout detached clean dal sorgente esatto `0452b35` in `/Users/domenico/Code/Strumentini-prime-cleanqa-20261009`, indipendente dai 3 WIP immagini esistenti sul branch principale.
- `npm run check`: **1.893 file, 0 errori, 0 warning, 21 hint storici**; `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **218/218 suite, 1.718/1.718 test PASS**.
- `npm run build`: **291 pagine**, 655 asset JS e 7.144 B JavaScript initial route; validator statico/sitemap PASS. `npm run deploy:check`: portable PASS, Cloudflare Wrangler `--dry-run` PASS con D1 AUTH_DB e ASSETS, 1.938 asset elencati.
- `npm run acceptance:pdf-image-aware`: PASS su Chromium con operazioni PDF reali e rendering indipendente via PDF.js; è prova desktop/browser, NON certificazione di dispositivo mobile fisico.
- HTTPS live dopo rollout: **200** su `/`, `/strumenti/`, `/tools/pdf-compression-lite/`, `/tools/pdf-split/`, `/tools/xml-formatter-validator/`, `/tools/ocr-italiano-locale-246/`, `/api/auth/session`, `/sitemap.xml`, `/ocr-246/lang/ita.traineddata.gz`, `/ocr-246/vendor/worker.min.js`; `/api/auth/session` ha restituito `{"user":null}`. OCR sperimentale mostra robots `noindex,nofollow`. Sicura redazione grafica PDF e firma visuale unsafe restano assenti **404** intenzionale.
- Test OCR vero su `https://strumentini.it` **PASS**: fixture PNG SHA-pinned, risultato italiano esatto `Fattura numero 12345 - Totale euro 678,90`, worker/WASM/ITA assets same-origin caricati lazy, TXT vero scaricato e riletto, nessuna richiesta HTTP offsite/JS errori, viewport desktop 390px. Log `/tmp/str-0452b35-ocr-live-browser.log`.

## Dichiarazioni di chiusura e blocchi veri

- `npm run tickets:check` ha confermato **327 totale, 262 completed, 65 OPEN**, **zero status mismatch**. Queste tranche non sono state spacciate per chiusure: #115/#117/#218 sono ancora aperti per AC non provati.
- `scripts/validate-release.ts --no-write-receipt` lascia stato **BLOCKED** con 0 errori strutturali e **8 blocker certificativi** (Gold receipts/source browser stale, due prove device fisici mancanti, rollback non esercitato, worktree QA con `node_modules` symlink untracked). Deployment manuale autorizzato e tecnicamente smoke-tested non significa Gold/certificatore verde.
- Tre WIP non nostri restano **modificati ma intatti/non-staged/non-committati**: `src/components/tools/image-visual/ImageResultV2.tsx`, `src/components/tools/image-visual/ImageVisualTool.tsx`, `src/engines/image/visual-tools.ts`. Non sovrascrivere/reset/committare.
