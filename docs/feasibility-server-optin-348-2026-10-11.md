# #348 — Fattibilità del server opzionale gratuito: NO_GO

**Data della ricognizione:** 11 ottobre 2026, repository Strumentini.it, HEAD iniziale `42562bb4`.
**Decisione:** `NO_GO` per attivare nuovi job o upload server-side. Questo è uno studio di fattibilità con verificatore statico e simulatore di budget; non introduce né abilita la funzionalità. Mantiene l'esecuzione locale e l'accesso anonimo. **Non interpreta il NO_GO come errore di esecuzione del test:** è l'esito richiesto dal perimetro di pianificazione.

## Fonti, piano effettivo e configurazione verificata

Fonti **primarie** lette il 2026-10-11 (le date di pubblicazione/aggiornamento sono quelle riportate dalle rispettive pagine):

1. [Cloudflare Workers — Limits](https://developers.cloudflare.com/workers/platform/limits/), pagina aggiornata **2026-10-08**: Free `100.000` richieste Worker al giorno (reset a mezzanotte UTC), **10 ms CPU** per richiesta HTTP, **128 MB** per isolate, 50 subrequest per richiesta; la richiesta che supera la quota riceve **1027**, CPU/memoria fuori limite **1102**. I tempi d'attesa delle richieste di rete non equivalgono al tempo CPU. Limite upload a livello di account Cloudflare Free **100 MB** per singola richiesta, che **non** costituisce un budget sicuro di progetto.
2. [Cloudflare Workers Static Assets — Billing and Limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), aggiornata **2026-04-23**: le richieste ai file statici sono gratuite e illimitate; le invocazioni del Worker consumano il relativo piano. Con `run_worker_first` su Free, oltre quota la richiesta va in 429 e non recupera automaticamente gli asset.
3. [Cloudflare D1 — Pricing](https://developers.cloudflare.com/d1/platform/pricing/), aggiornata **2026-04-21**: Free **5 milioni** di righe lette/giorno, **100.000** scritte/giorno, **5 GB** di storage complessivo. Le metriche sono righe *scansionate/scritte*, non numero di query; limiti su account condivisi e azzeramento a **00:00 UTC**.
4. [Cloudflare D1 — enforcement changelog](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/), pubblicata **2026-09-01**: oltre la quota Free D1 le query restituiscono errori; i dati già memorizzati non sono cancellati.

Le quote pubblicate sono vincoli di un piano **ipotetico Workers Free**, non attestano quale piano abbia oggi l'account, l'utilizzo complessivo corrente, o la gratuità di un servizio remoto aggiuntivo. Gli eventuali costi VIES/provider, requisiti di trattamento e quota API di fornitori futuri sono **NON_VERIFIED**: il modello fallisce chiuso anche in assenza di un solo dato di budget. Un progetto con piano diverso, risorse Cloudflare condivise e invocazioni da altre applicazioni può consumare quote differenti. Non si stima un costo monetario pari a zero in assenza dei dati reali.

Configurazione locale esaminata, in sola lettura: `wrangler.jsonc` usa `main: worker/index.ts`, `assets.directory: ./dist`, binding `ASSETS` e D1 `AUTH_DB`, senza `run_worker_first`, R2, AI bindings o route di conversione file. `worker/index.ts` registra **19** combinazioni metodo/route: **12** account/autenticazione, **6** preferiti/sincronizzazione e **1** `POST /api/vies/check` verso la Commissione europea. I servizi VIES, Google JWKs e Turnstile effettuano chiamate esterne solo per le funzioni già previste; il pannello VIES dichiara l'invio e richiede il clic sul pulsante. Le componenti account e preferiti hanno chiamate autorizzate al Worker; il tool IP pubblico esegue un GET esterno su richiesta dell'utente. `src/telemetry/adapter.ts` offre un trasporto HTTP parametrico, che non è di per sé prova di attivazione in ogni esecuzione.

## Confronto locale / nuovo job server opt-in

| Asse | Elaborazione locale attuale | Nuovo job su Workers Free (solo ipotesi) |
| --- | --- | --- |
| Attivazione e consenso | Input elaborato dal browser/Worker web locale; nessun consenso a upload file implicito | Serve scelta per **quel singolo job**, descrizione tipo/dimensione dati e destinazione, azione esplicita separata dal login |
| Richieste e quota | Nessuna richiesta Worker necessaria per il calcolo deterministico; asset statici su Cloudflare senza tariffa per richiesta | Quota **condivisa** max 100.000 richieste dinamiche/giorno, inclusi endpoint già in uso; al superamento: rifiuto senza tentare un upload |
| CPU e memoria | Dipende dal device/browser; limiti di fattibilità per tool da misurare su mobile | Free **10 ms CPU/job** e **128 MB/isolate**; il modello impone prudentemente **120 MiB** come tetto teorico. Conversioni di file grandi plausibilmente fuori budget, senza benchmark non classificabili GO |
| DB e stato | IndexedDB/OPFS e scaricamento locale ove previsto | D1 comune: 5 milioni righe lette/giorno, 100.000 scritte/giorno, storage 5 GB **decimali**; l'uso già in corso deve essere noto |
| Consumo e denaro | Nessuna nuova tariffa server di elaborazione per il singolo tool; restano costi esistenti come dominio | Anche sotto limiti tecnici **costo incrementale non certificabile** senza piano/account e provider reali; oltre il Free la richiesta fallisce e non deve avviare upgrade pagati automaticamente |
| Privacy e offline | File e contenuto rimangono nel browser per gli strumenti locali; diverse funzioni disponibili offline | Il file lascerebbe il dispositivo, con nuovi requisiti su cancellazione, log, minimizzazione e retention; offline non possibile |
| Quota/errore | Il motore locale riporta il proprio limite/errore | Solo fallback **locale già supportato** oppure **indisponibile**; mai invio silenzioso, pagamento implicito, o sostituzione del risultato valido precedente |

## Verificatore eseguibile e risultato indipendente

```sh
npx tsx scripts/feasibility-server-optin-348.ts
npx vitest run tests/feasibility-server-optin-348.test.ts
```

Il primo comando enumera ricorsivamente i sorgenti di `src` e `worker` (esclusi i bundle di terze parti sotto `vendor`), blocca nuovi file Worker e deriva le 19 route dalla tabella TypeScript tramite AST. Controlla la superficie di binding/configurazione Wrangler, i digest SHA-256 dei file Worker/migrazioni e dei client first-party che presentano primitivi di trasporto (`fetch`, XHR, WebSocket, beacon, ecc.). Qualsiasi mutazione rispetto agli snapshot riesaminati, nuovo file di trasporto o nuova route produce `baselineSafe: false`, violazione codificata e **exit 1**. Risultato del run corrente: `baselineSafe: true`, `serverMode: NO_GO`, **1.620** file esaminati, **19** route, **0** violazioni. La quantità di file è contestuale al checkout e può variare con altri ticket.

L'inventario è **un allarme di drift conservativo, non un certificato di sicurezza runtime**. I digest coprono il sorgente recensito; non dimostrano il flusso reale dei dati, il codice vendorizzato, gli asset `public`, i moduli dinamici, script remoti, nuovi alias del trasporto, i pacchetti in `node_modules`, o comportamenti attivati dal browser. La lettura delle route non copre percorsi dinamici extra ricavati da librerie. Un componente nuovo che usasse un trasporto non identificato dal pattern potrebbe sfuggire: prima di abilitare upload occorrono threat review runtime/CSP, QA di rete indipendente su anonimo e autenticato, mock dei guasti e test mobile. `baselineSafe: true` **non autorizza** un server job e il checker restituisce sempre `serverMode: NO_GO`.

La funzione pura `evaluateCandidateBudget` verifica **sulla carta** consenso informato, clic esplicito, disclosure del job, limiti di byte/CPU/tempo/memoria, quote account-wide Workers e D1, affidabilità della fonte e modalità di fallback. Richiede numeri finiti, interi, non negativi per tutte le quote e per l'utilizzo dell'account. Se qualsiasi dato manca o supera il limite ritorna `NO_GO` e `fallback: local` (se già supportato), altrimenti `fallback: unavailable`. L'eventuale `BUDGET_ONLY` indica una stima aritmetica soddisfacente **in un esperimento ipotetico** e non avvia richieste, crea D1 o concede rilascio.

**Test mirati** (`11` PASS al 2026-10-11): code path genuino con route/manifest/fonti censiti; nuovo endpoint POST; upload `FormData` aggiunto a un client; nuove chiamate `fetch`, beacon, XHR, WebSocket e proprietà bracket; attivazione di `run_worker_first`; tre forme di consenso mancante; quota account ignota per tutte e quattro le risorse; overflow di tutte le quote; file, CPU, tempo e memoria eccessivi; `NaN`, valori frazionari, fallback locale/indisponibile. I test iniettano sorgenti ostili **in memoria** senza modificare app e provider. **NOT_RUN:** invocazioni Cloudflare live, misure di CPU/traffico reali, picco concurrente reale, trattamento GDPR/DPA di provider nuovi, browser mobile e verifica in produzione.

## Budget, picchi e minacce — casi bloccanti

| Caso simulato | Vincolo | Decisione/fallback |
| --- | --- | --- |
| Utente non autenticato o autenticato, ma senza gesto specifico di invio | Il login e le preferenze salvate non sono consenso per un file | `NO_GO`, locale / indisponibile |
| Account Workers già a 99.950 richieste/giorno, nuova funzionalità stimata a 100 | 100.050 richieste supera 100.000 | `NO_GO`, locale / indisponibile |
| Account D1 già oltre o vicino a 5 M letture, 100.000 scritture, 5 GB | Una sola nuova riga o un byte può determinare errore | `NO_GO`, locale / indisponibile |
| Fonte quote disponibile, ma metriche reali account-wide sconosciute | I numeri del singolo tool non indicano la quota residua | `NO_GO`, locale / indisponibile |
| File 1 MiB + 1 byte con limite ipotetico 1 MiB, o CPU stimata 11 ms | Il limite di progetto resta più stretto del provider | `NO_GO`, nessun upload |
| Servizio esterno non disponibile / timeout / utente annulla | Il precedente risultato locale valido deve restare intatto; il retry non deve raddoppiare effetti | Design `NO_GO` per lo sviluppo fino a timeout, annullamento, idempotenza e receipt provati end-to-end |
| Picco di richieste o abuso ripetuto da diversi IP/account | Quota condivisa, rate limit per account/IP e anti-abuso non simulati in prod | `NO_GO`: capacità effettiva e costo **UNKNOWN** |
| Log, errori o telemetry che conservano file/payload/URL remoti | Esfiltrazione accidentale, retention e consenso | `NO_GO` fino ad audit di rete, log, minimizzazione e cancellazione |

Condizioni tecniche per un **eventuale** ticket di implementazione distinto: cap locale **prima** dell'invio; budget giornaliero atomico, misurato a livello account e strumento con margine per account già presenti; disclosure per-job e consenso revocabile; request/response timeout e `AbortSignal`; chiave di idempotenza e nessun retry mutante implicito; input minimizzato; nessuna registrazione del contenuto nei log; risposta di errore codificata senza riscrivere il risultato precedente; fallback locale verificato sull'operazione reale; controllo CSP/telemetria e test accessibilità mobile. Ogni provider aggiuntivo richiede fonte ufficiale della sua quota, modello del costo e condizioni d'uso, audit dei dati e test live esplicitamente autorizzati.

## Stato dei criteri di accettazione nel perimetro `feasibility`

- **AC-348.1 — PROVATO (studio):** confronto con quote hard, costi condizionati e consenso per-job; fonti primarie del 2026-10-11; **costo effettivo e piano account sconosciuti ⇒ NO_GO**.
- **AC-348.2 — PROVATO nel modello statico e nel simulatore, NON_VERIFIED end-to-end:** regressioni negative rifiutano la nuova route e l'upload client identificabile; per il budget il rifiuto restituisce solo `local` o `unavailable`. Nessuna modalità server è attivata; test runtime di upload/overquota restano `NOT_RUN`.
- **AC-348.3 — PROVATO come studio:** budget, stress e modello delle minacce con prove negative; limiti sconosciuti e verify runtime indicati `NO_GO/NOT_RUN`, senza promettere zero costi o supporto provider.

**Rollback:** eliminare esclusivamente i file di fattibilità `scripts/feasibility-server-optin-348.ts`, `tests/feasibility-server-optin-348.test.ts` e questo documento, e ripristinare lo status del ticket. Non sono state cambiate route, Worker, UI, configurazione, dati o deploy. **Nessuna nuova dipendenza**.
