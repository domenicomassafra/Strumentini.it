# STR-293 — Turndown HTML → Markdown (19 ottobre 2026)

## Riuso, licenze e pin

Adottato [Turndown](https://github.com/mixmark-io/turndown) **7.2.4**, MIT, release `v7.2.4` del **2026-04-03**, tag annotato `241fd8eae20793f79846662ff3ea39815e17ac1a` → commit `fb7a865ef5eba4081dfd4e20a894a61ef7a2edca`. Repository e metadata npm verificati il 2026-10-19. Ultima release riscontrata v7.2.4; progetto attivo e con storico verificabile. Il converter manuale esistente resta solo come sorgente di normalizzazione e sanitizzazione, non come output del tool browser in questa modalità. `marked` risolve Markdown → HTML (direzione inversa) e non sostituisce il donor.

| Dipendenza | Uso | Licenza | Integrità npm (`package-lock.json`) |
| --- | --- | --- | --- |
| `turndown@7.2.4` | produzione, caricamento lazy | MIT | `sha512-I8yFsfRzmzK0WV1pNNOA4A7y4RDfFxPRxb3t+e3ui14qSGOxGtiSP6GjeX+Y6CHb7HYaFj7ECUD7VE5kQMZWGQ==` |
| `@mixmark-io/domino@2.2.0` | transitiva Turndown | BSD-2-Clause | `sha512-Y28PR25bHXUg88kCV7nivXrP2Nj2RueZ3/l/jdx6J9f8J4nsEGcgX0Qe6lt7Pa+J79+kPiJU3LguR6O/6zrLOw==` |
| `@types/turndown@5.0.6` | soli tipi, sviluppo | MIT | `sha512-ru00MoyeeouE5BX4gRL+6m/BsDfbRayOskWqUvh7CLGW+UXxHQItqALa38kKnOiZPqJrtzJUgAC2+F0rL1S4Pg==` |

I notice/licenze testuali sono i file `LICENSE` nei tre pacchetti npm installati; il lock mantiene provenienza e hash. Nessun asset, font, WASM o modello è stato aggiunto; nessuna dipendenza copyleft nuova. La review degli obblighi per altre dipendenze copyleft resta nella issue #126 e non cambia per questa adozione.

## Perimetro tecnico e rollback

`src/tools/text-markup-converter/module.ts` importa dinamicamente il nuovo adapter **solo** nella direzione HTML → Markdown. L'adapter controlla cancellazione e limite di **1.000.000 caratteri** prima di importare Turndown. L'HTML di input passa attraverso il parser ristretto già installato: gli elementi attivi sono scartati, gli URL sono filtrati, e `previewHtml` è serializzato da un modello di soli tag e attributi permessi. Solo questo HTML sanitizzato raggiunge Turndown. Le regole Turndown su `br`, liste, escaping di `<>` e strike mantengono il sottoinsieme esistente, compresi pre, tabelle appiattite e il testo Unicode. Il risultato continua a usare il contratto, MIME e nome di download precedenti; il sorgente resta immutato.

In assenza di `document` (Worker/SSR), il modulo risponde `HTML_MARKDOWN_BROWSER_ONLY`; l'adapter gestisce `AbortError` e `INPUT_TOO_LARGE`. Le altre quattro conversioni e Markdown Preview restano sincrone. Il Worker Cloudflare non è modificato; niente fetch/upload introdotti. Per il rollback, rimuovere l'adapter e l'importazione dinamica dal modulo, ripristinare la conversione tramite `convertTextMarkup`, rimuovere i tre pacchetti dal lock e rigenerare l'indice di certificazione con `npm run certification:build`.

## Confronto e prova reale locale

Fixture preesistenti: `tests/text-markup-conversion.test.ts`, `tests/developer-web-engine.test.ts`. Prova indipendente del consumer: `scripts/acceptance-turndown-293.mjs`, con 10 input (Unicode decomposto, formati, liste, tabelle, entità HTML e contenuto attivo) per viewport desktop 1440 px e mobile 390 px, confronto byte-per-byte con il motore precedente; preview sanificata, sorgente intatto, `.md` scaricato e riaperto da Node, input oltre limite rifiutato, richieste di rete monitorate e osservazione di violazioni CSP. Il run headless del 2026-10-19 ha riportato:

```
{ "viewport":1440, "matched":10, "elapsedMs":1382, "peakObservedHeapBytes":8202080, "cspViolations":0, "egress":0, "downloadedAndReopened":true, "overLimit":"INPUT_TOO_LARGE" }
{ "viewport":390, "matched":10, "elapsedMs":983, "peakObservedHeapBytes":7993000, "cspViolations":0, "egress":0, "downloadedAndReopened":true, "overLimit":"INPUT_TOO_LARGE" }
```

`elapsedMs` include 10 operazioni Playwright e la prova d'errore: non è una latenza isolata del donor. `peakObservedHeapBytes` è il massimo dei campioni `Performance.getMetrics/JSHeapUsedSize` dopo ogni fixture, non il massimo istantaneo assoluto. La CSP è osservata durante l'elaborazione sulla pagina locale. Queste misure documentano il browser testato, non un dispositivo fisico o un deploy.

La build statica reale (`dist/`, servita via HTTP locale) ha ripetuto il medesimo confronto 10/10 per viewport con zero egress/CSP, UTF-8 riaperto e rifiuto del superamento limite. Esiti: 1440 px `elapsedMs=1027`, `peakObservedHeapBytes=5636448`; 390 px `elapsedMs=1077`, `peakObservedHeapBytes=5744224`. Dal build Astro i chunk caricati solo per questa modalità sono `turndown.browser.es` **10.790 B / 4.138 B gzip** e `turndown-adapter` **1.492 B / 823 B gzip**; il modulo dello strumento iniziale è **1.106 B / 603 B gzip**. `npm run build`: 304 pagine PASS, `npm run deploy:check` (static portability e Cloudflare dry-run): PASS.

Nessun Gold/release né deploy di produzione è implicato dal ticket. La build e il dry-run Cloudflare sono verificati separatamente; il sito pubblico non viene aggiornato con questa PR.
