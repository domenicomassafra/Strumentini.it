# STR-280 — lane web Android simulata

La lane prova il **consumer Astro compilato** usando un contesto Playwright Chromium
con descriptor Pixel 7. **Non avvia Android OS / Android Emulator e non misura hardware
fisico**. I receipt riportano `PLAYWRIGHT_BROWSER_EMULATION`, `NOT_OBSERVED` per
hardware e `physicalPromotion: NO_GO` nel gate storico STR-206.

## Esecuzione

Da checkout con dipendenze installate e browser Playwright Chromium disponibile:

```sh
npx vitest run tests/regroom-str-280.test.ts --maxWorkers=1
npm run check && npm run build
npm run acceptance:android-heavy:simulated
```

Il runner avvia solo un server temporaneo su loopback per `dist/`, esegue cinque
**route reali** nel browser mobile simulato e interrompe ogni richiesta esterna.
Ogni caso registra hash SHA-256/byte del file selezionato, browser/versione,
revision/build, route, classe input, stato progress/cancel/retry, eventuali limiti,
download e riapertura indipendente. Il receipt JSON è scritto in
`.astro/acceptance/str-280-android-simulated.json` (cartella generata/ignorata),
quindi riletto e rivalidato. Per archiviarlo usa un percorso scelto esplicitamente:

```sh
STR280_RECEIPT=.astro/acceptance/str-280-review.json npm run acceptance:android-heavy:simulated
```

| Classe | Route | Download ricontrollato |
| --- | --- | --- |
| Immagini | `/tools/image-resize/` | JPEG/WebP decodificato da Sharp |
| PDF | `/tools/pdf-merge/` | PDF riaperto con `pdfjs-dist` |
| Office | `/documenti-markdown/` | DOCX ZIP/OOXML riaperto con `fflate` |
| OCR | `/tools/ocr-italiano-locale-246/` | TXT UTF-8 decodificato e confrontato col testo atteso |
| Video/media | `/tools/video-inspector/` | PNG di un fotogramma decodificato da Sharp |

Il browser deve osservare almeno una cancellazione recuperabile e un retry.
Una prova controllata del preflight rifiuta worker/WASM mancanti e working set
oltre il limite, poi accetta un secondo tentativo valido: **non è un OOM del
processo Android**. La ricevuta include campioni reali della heap JS Chromium
prima/dopo e la durata del job, senza spacciarli per picco RSS/native/WASM/GPU.
Un `SIMULATED_PASS` attesta solo quanto osservato dalla lane web e non cambia
Gold, promozione heavy locale, release o test fisici Android/iOS.

Riusi: [Playwright](https://github.com/microsoft/playwright) (Apache-2.0),
`scripts/acceptance-image-resize.mjs`, `scripts/acceptance-pdf.mjs`,
`tests/ocr-247-local-browser.acceptance.mjs`,
`src/runtime/heavy-preflight.ts`; valutato [Appium](https://github.com/appium/appium)
(Apache-2.0), non introdotto perché SDK/emulatore Android non erano configurati.
