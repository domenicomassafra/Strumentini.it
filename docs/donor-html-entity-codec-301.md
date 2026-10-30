# STR-301 — `html-entity-codec` donor e rollback

## Provenienza e licenze

- **Adottato:** [`mathiasbynens/he`](https://github.com/mathiasbynens/he), tag [`v2.0.0`](https://github.com/mathiasbynens/he/releases/tag/v2.0.0), commit `e5658eccfecf6dfccee8797ca5126a3f22855609` (tag object `23433c0d2b3b0945bbc17ad43ef0895cb1fd8f0c`). Pubblicato su npm il 4 ottobre 2026. Licenza **MIT** (`LICENSE-MIT.txt` nel tarball).
- **Pacchetto runtime:** `he@2.0.0` versione esatta in `package.json` e `package-lock.json`; tarball `https://registry.npmjs.org/he/-/he-2.0.0.tgz`; integrity npm `sha512-0jE+JPv08nhXWmI1dULybzqNt34RbkH6Ul6V4cmDONpjYx1SfyObKF38FJLaJ1K7WWD93LWL9lewzk4E1Ria4A==`.
- **Notice MIT distribuito:** `public/licenses/he-301-MIT.txt` è una copia byte-identica di `node_modules/he/LICENSE-MIT.txt` (SHA-256 `483acb265f182907d1caf6cff9c16c96f31325ed23792832cc5d8b12d5f88c8a`). Il registro `scripts/donor-notices-366.ts` vincola i byte, l’attribuzione `Mathias Bynens` e la presenza finale in `dist/licenses/` tramite `scripts/inspect-build.ts`; la licenza resta quella del donor MIT. Nessun notice transitive per `he@2.0.0`, perché nessuna dependency runtime.
- **Dependencies runtime/transitive per `he@2.0.0`:** nessuna. Asset esterni, font, WASM e file caricati a runtime dal donor: **nessuno**; la tabella di entità è inclusa nel pacchetto. `@types/he@1.2.3` è solo una dipendenza di sviluppo per i tipi. La precedente versione `he@1.2.0` continua come dipendenza interna di `node-html-parser`, senza sostituirla. Il gate generale di provenance/licenze **#126 rimane valido**, non è una dichiarazione Gold o ammissione al deploy.
- **Alternative:** [`html-entities@2.6.0`](https://github.com/mdevils/html-entities) (MIT; ultimo npm 2025-03-30, codice upstream aggiornato al 2025-04-06, 686★ alla verifica 19/10/2026) offre HTML4/HTML5, ma `he@2.0.0` è più recente ed è già selezionato nella mappa `reuse-str-testo.md`, con semantica di tokenizzazione WHATWG documentata (ambiguous ampersands e riferimenti senza `;`). `html` di Python è un oracle distinto, non una dipendenza browser.

## Semantica conservata e migliorata

L'API `runDeveloperWebTool("html-entity-codec", …)` mantiene `mode`, `numeric`, `valid`, `value`, `warning` e `engineVersion`. Import dinamico di `he` solo alla prima conversione, nella stessa origine, senza chiamate a servizi esterni. `encode` usa i nomi HTML canonici quando disponibili; la modalità numerica usa riferimenti **decimali** (come il percorso precedente). Il decode usa le regole **WHATWG in contesto testo**: copre i nomi completi, le entità multi-codepoint, ampersand ambigui e il mapping legacy dei controlli C1 (es. `&#x80;` → `€`). Gli input HTML restano **testo**: la decodifica non è una sanificazione.

Il vecchio codec HTML locale (`legacyHtmlEntityOperation`, `encodeHtmlEntities`, `decodeHtmlEntities`) è stato rimosso con #522: nessuna route runtime lo utilizzava. `htmlEntityOperation` usa il solo decoder/encoder mantenuto `he`; gli input e le risposte pubbliche conservano la stessa interfaccia. I controlli locali mantengono il limite **1.000.000 caratteri**, l'errore tipizzato `INVALID_HTML_ENTITY` per Unicode non rappresentabile (surrogate non appaiati e punti numerici fuori intervallo/surrogati), `INPUT_TOO_LARGE`, `AbortError` e l'envelope precedente.

Differenze previste e coperte da test: la codifica named include anche caratteri Unicode prima lasciati verbatim (`©` → `&copy;`), gli apostrofi diventano `&apos;` in named (`&#39;` in numeric), i riferimenti HTML5 mancanti nella tabella locale ora si risolvono, e i code point numerici WHATWG di controllo C1 sono normalizzati. Le fixture canoniche e un oracle Python HTML5 indipendente verificano il comportamento attivo: `tests/html-entity-codec-301.test.ts`; gold esistente: `tests/developer-web-engine.test.ts`.

## Prove ripetibili

```sh
npx vitest run tests/developer-web-engine.test.ts tests/html-entity-codec-301.test.ts tests/html-entity-codec-301-regression.test.ts tests/donor-notices-366.test.ts --maxWorkers=1
npx tsx scripts/benchmark-html-entity-301.ts
npm run build
node scripts/acceptance-html-entity-301.browser.mjs
```

Il benchmark Node misura ora solo `he`: mediane, p95 e **campioni di memoria heap/RSS dopo ogni chiamata**, non un vero high-water mark nativo durante l'esecuzione. A titolo storico, il confronto prima della rimozione sul Mac Studio (Node 24.18.0, 19/10/2026), 12 esecuzioni per input brevi e 3 per 1M caratteri: encode 57.344 caratteri mediana `0,862 ms` legacy / `4,077 ms` donor; decode 66.000 caratteri `1,664 ms` / `1,912 ms`; decode 999.996 caratteri `163,066 ms` / `179,617 ms`. RSS post-call massimo campionato sul caso 1M: `190,86 MiB` legacy / `227,20 MiB` donor. Questi sono valori di processo influenzati da warmup/GC, non budget di memoria dei browser; confrontarli come indicatori di overhead e non come benchmark deterministico.

I browser Chromium, Firefox e WebKit vengono provati sulla **pagina pubblica compilata** `/tools/html-entity-codec/` servita soltanto su loopback con `script-src 'self'` più hash SHA-256 degli script Astro inline. Il layout comune interroga `/api/auth/session`: il server isolato restituisce una sessione anonima deterministica e `connect-src` autorizza esclusivamente quell'URL sulla stessa origine. Il codec non usa API: il test rifiuta ogni altra richiesta `fetch`/XHR e ogni destinazione esterna, verifica output scaricato, import lazy di `he`, warning e assenza di errori JS. Non usa chiavi, upload o deploy di produzione. Le emulazioni browser non attestano un dispositivo iOS/Android fisico.

Il test delle regressioni usa inoltre `html.unescape` della libreria standard Python come oracle indipendente per named HTML5, controlli C1, null numerico e forme malformed. La prova browser osserva anche un rifiuto Unicode invalido nella UI, l’assenza di download dopo il rifiuto e l’header CSP effettivo restituito dal server locale.

La prova browser produce `quality/receipts/developer-web/html-entity-codec-301.browser.json` solo dopo l'esecuzione di tutti i motori richiesti: vi registra revision Git, SHA-256 della route HTML realmente compilata, SHA-256 del chunk `he` realmente richiesto da ogni browser, versioni dei browser, controllo CSP, conversioni scaricate in JSON e assenza di richieste esterne/errori. La receipt è `PASS` soltanto quando vengono verificati tutti e tre i motori; le esecuzioni con `STR301_BROWSERS` ridotto sono esplicitamente `PARTIAL`. Gli hash identificano gli asset provati e non costituiscono un'ammissione alla release.

Ricognizione 22/10/2026: MiniPC Linux con Playwright WebKit 26.6 ha aperto correttamente una pagina `data:text/html` nell'ambiente headless (smoke infrastrutturale, distinto dall'acceptance del codec). Sullo stesso host passano **39/39** test mirati `developer-web-engine`, `html-entity-codec-301`, regressioni e donor notices. Il notice MIT pubblico `https://strumentini.it/licenses/he-301-MIT.txt` risponde ancora **HTTP 404**: il consumer di produzione resta `NO_GO` finché una release ammessa lo distribuisce e una nuova verifica attesta HTTP 200.
