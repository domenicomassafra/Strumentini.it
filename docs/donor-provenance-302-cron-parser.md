# STR #302 — cron-parser 5.10.2: NO_GO

Data verifica: 19 ottobre 2026. Contratto: [issue #302](https://github.com/domenicomassafra/strumentini-it/issues/302), dipendenza diritti [#126](https://github.com/domenicomassafra/strumentini-it/issues/126).

**Decisione: NO_GO.** Mantenere il motore locale in `src/engines/developer-web/web-reference.ts`. Il candidato restituisce istanti errati durante entrambi i cambi d'ora in `Europe/Rome`, violando le policy già pubblicate da `cron-next-run` e spiegate dal tool. Nessuna modifica a sorgenti, route, Gold, runtime, dipendenze o deploy; il rollback è quindi l'attuale implementazione, rimasta invariata. Per riproporre l'adozione servono prove che correggano entrambe le divergenze, oltre al gate diritti #126.

## Donor e diritti (candidato, non installato)

- Upstream: [harrisiirak/cron-parser](https://github.com/harrisiirak/cron-parser), tag `v5.10.2`, commit [`5033a312f1fe04665060eacf4378f16c48ca4ea8`](https://github.com/harrisiirak/cron-parser/commit/5033a312f1fe04665060eacf4378f16c48ca4ea8). Licenza MIT; npm 5.10.2 pubblicato entro il 9 ottobre 2026, repository aggiornato l'11 ottobre 2026 (13 issue aperte al momento della consultazione).
- Tarball npm: `cron-parser@5.10.2`, integrity `sha512-JfAYMY0LZaWQTuict8PhtF/ksSnq8xefSDmQUnnoqvkPYkU/y3UP0DTWzJKFBz0P1IXsDG8q0vY3zHkoFZOhvw==`; unpacked size 155.712 byte.
- Dipendenza transitiva osservata: `luxon@3.7.2`, MIT, [moment/luxon](https://github.com/moment/luxon), integrity `sha512-vtEhXh/gNjI9Yg1u4jX/0YVPMvxzHuGgCm6tC5kZyb08yjGWGnqAjGJvcXbqQR2P3MyMEFnRbpcdFS6PBcLqew==`. Nessun asset o codice transitivo vendorizzato; NOTICE/distribuzione e diritti restano soggetti al gate #126 prima di un'eventuale adozione.
- Ambiente provato: Node.js 24.18.0 e bundle JavaScript browser locale (esbuild `platform=browser`). Il bundle sperimentale di **cron-parser + motore originale** è di 385,7 kB non compresso, quindi non misura l'incremento della build finale. Nessuna installazione in `package.json` / lockfile del prodotto: il donor è stato isolato in `.scratch/issue-302-donor/` ignorata da Git.

## Confronto differenziale e oracle

Input `from` sempre UTC e `count=3`. Il motore esistente e `cron-parser` coincidono su `*/15 * * * *` UTC e su `0 9 13 * 5` in `Europe/Rome` (DOM/DOW **OR**: 2, 9 e 13 gennaio 2026 alle 08:00 UTC). Lo spiegatore attuale dice correttamente che DOM/DOW sono in OR.

| Input | Expected e motore attuale (UTC) | cron-parser 5.10.2 (UTC) | Esito |
|---|---|---|---|
| `30 2 * * *`, `2026-03-28T01:31Z`, Europe/Rome | `03-30T00:30Z`, `03-31T00:30Z`, `04-01T00:30Z` | `03-29T01:30Z`, `03-30T00:30Z`, `03-31T00:30Z` | **FAIL gap**: il 29/03 la 02:30 locale non esiste; donor emette le 03:30 |
| `30 2 * * *`, `2026-10-24T01:31Z`, Europe/Rome | `10-25T00:30Z`, `10-25T01:30Z`, `10-26T01:30Z` | `10-25T00:30Z`, `10-26T01:30Z`, `10-27T01:30Z` | **FAIL overlap**: manca la seconda 02:30 locale |
| `0 9 * * * echo yes`, `2026-01-01T00:00Z`, UTC | `01-01T09:00Z`, `01-02T09:00Z` | `Invalid cron expression, too many fields` | **FAIL**: il parser corrente permette il comando dopo i cinque campi |

Oracle indipendente per gap e overlap: `python3`, `datetime`, `zoneinfo.ZoneInfo('Europe/Rome')`; enumerazione di istanti UTC e selezione di quelli le cui rappresentazioni locali hanno ora `02:30`. Risultati: primavera `2026-03-30T00:30Z`, `03-31T00:30Z`, `04-01T00:30Z`; autunno `2026-10-25T00:30Z`, `10-25T01:30Z`, `10-26T01:30Z`. Nessun oracle condivide il parser del prodotto o quello del donor.

## Tempi, memoria, browser, privacy

Confronto Node di una chiamata a 3 occorrenze (`performance.now()`, macchina corrente, numeri illustrativi, non SLA): UTC ogni 15 minuti **17,59 / 4,29 ms** (originale / donor); DOM/DOW **202,87 / 2,83 ms**; gap **20,45 / 1,13 ms**; overlap **16,66 / 3,19 ms**. Dopo riscaldamento, dieci richieste UTC: medie **0,216 / 0,390 ms**. High-water dell'heap JS campionato dopo le singole richieste (`--expose-gc`): **979 / 1.828 KiB** sopra baseline. Non è una misura del picco transitorio assoluto; per entrambi i motori il test non garantisce un limite di memoria.

Il confronto browser carica un bundle locale e conta tutte le richieste di rete (nessun upload). Chromium e Firefox riproducono entrambi i **FAIL DST** e il **PASS DOM/DOW**, con **zero richieste di rete**; il codice esegue nel browser, senza backend. WebKit è stato provato due volte: il primo processo è stato interrotto dopo che non avanzava su `browser.newPage` (`Target page, context or browser has been closed`); il secondo ha superato il timeout di 40 secondi (exit 124). **Nessun risultato WebKit viene dichiarato.** Non è un test fisico iOS/Android e non autorizza un'affermazione sul comportamento del dispositivo reale. L'uso di esbuild e il caricamento come script locale non prova la CSP di un rilascio integrato; per un eventuale nuovo tentativo restano da certificare import lazy, abort, envelope, CSP, limiti di 20 risultati e ricerca di un anno.

## Verifica del comportamento invariato

`./node_modules/.bin/vitest run tests/developer-web-engine.test.ts --maxWorkers=1` → **1 file / 26 test PASS** (inclusi i due vettori DST). Il motore produttivo rimane senza dipendenze da `cron-parser`; l'assenza di alterazioni ai consumer conserva rifiuti, cancel, envelope e trattamento locale preesistenti. L'adozione diretta violerebbe i criteri #302; questo documento è l'esito **NO_GO** esplicitamente ammesso dall'Acceptance.
