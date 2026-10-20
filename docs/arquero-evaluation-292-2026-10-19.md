# STR-292 — Arquero 8.0.3: NO_GO per l'adapter proposto

Data: 19 ottobre 2026. Issue: [#292](https://github.com/domenicomassafra/strumentini-it/issues/292); mappa madre [#289](https://github.com/domenicomassafra/strumentini-it/issues/289); requisiti correlati #146, #147, #149, #150, provenance #126. Queste issue non sono dichiarate completate.

## Donor e provenienza

- Donor: [uwdata/arquero](https://github.com/uwdata/arquero), tag [v8.0.3](https://github.com/uwdata/arquero/releases/tag/v8.0.3), commit `e8003b487ac362f5679ed130cb3a6597b684f903` (29 maggio 2025), licenza **BSD-3-Clause**. Versione npm pinned `arquero@8.0.3`, integrity `sha512-7YQwe/GPVBUiahaPwEwgvu6VHyuhX0Ut61JZlIJYsAobOH5unLBwTmh43BobhX/N4dW1sb8WyKlQ8GjFq2whzQ==`.
- Transitive osservate da npm (19/10/2026): `@uwdata/flechette@2.7.0`, **BSD-3-Clause**, `sha512-+d4JwDnBJsxjH7zMz5QSDOVQQYqFdAQYSaR6lfBazFz28C5eIBiL5s4jqLEWJKcc43fSU1m6yHMcWeRUCTNH+g==`; `@uwdata/wk-geojson@0.0.1`, **BSD-3-Clause**, `sha512-4RpnKbdrphwzP+BwgzuGRqA/s03oT1rzHAKdU43Ozn8J1BCTwS+2iAGQ7YQAnrCkCi213WtQ7VYaFjVtvZotPQ==`; `acorn@8.19.0`, **MIT**, `sha512-oJlA3XiRm7Cyk6qFD2Jn8ak9B7jSy0qy00ADO3+8dpT0LSjFihQYv4C02LFCSYJV3Q37xYwwRy5m+IpIiUzqWw==`.
- Tutti e quattro i pacchetti distribuiscono `LICENSE` nel tarball npm; nessun `NOTICE` aggiuntivo rilevato in questi quattro pacchetti e nessun asset esterno caricato nel probe. Sono dati di inventario, **non clearing concluso** della provenance complessiva #126.
- [Arquero PR #401](https://github.com/uwdata/arquero/pull/401) (CSV quote handling) inclusa in 8.0.3; [issue upstream #361](https://github.com/uwdata/arquero/issues/361) **ancora aperta**: il maintainer conferma l'uso diffuso di `Function` a runtime e l'assenza di una modalità CSP compatibile facilmente attivabile.

## Risultato del gate: NO_GO, nessuna adozione

Nel **probe locale con CSP restrittiva simulata** (`script-src 'self'`), l'adapter lazy previsto per join/group/pivot viene bloccato: Chromium segnala `Evaluating a string as JavaScript violates ... 'unsafe-eval' is not an allowed source of script`. Il punto di chiamata è il compilatore di espressioni upstream, `src/expression/compile.js`, che esegue `Function('fn', '$', code)`. Con lo **stesso bundle** e con `'unsafe-eval'` consentito, il donor invece produce tre righe di join: il rifiuto è causato dalla policy del probe, non da un import mancante.

**Distinzione produzione/probe:** la risposta HTTP 200 di `https://strumentini.it/tools/csv-join/` verificata il 19/10/2026 **non presenta un header `Content-Security-Policy`**; il probe non dimostra che oggi il sito live rifiuti Arquero. La CSP restrittiva è un gate di compatibilità e sicurezza ipotetico, non una proprietà osservata del deploy. Il NO_GO deriva dal mancato rispetto della fedeltà richiesta senza un adapter correttivo, dal maggiore peso del bundle e dalla dipendenza da `unsafe-eval` in una configurazione restrittiva; non si dichiara un guasto della produzione.

In più, un adapter fedele deve reintrodurre esplicitamente le politiche correnti del motore:

| Fixture esistente e negativa | Motore corrente | Arquero 8.0.3 diretto |
| --- | --- | --- |
| Join full con `NULL` e celle vuote, politica `never-match` | 5 righe, colonne `id,left_value,id_right,right_value_right` | 3 righe; le chiavi `NULL` e vuote combaciano e la seconda chiave viene omessa |
| Group sum case-insensitive e token `NULL` | 2 gruppi `A=3`, `NULL=7` | 4 gruppi distinti, senza normalizzazione esplicita |
| Pivot con chiavi e intestazioni case-insensitive | 2 gruppi, colonne `team,Q1,Q2` | 4 gruppi, colonne `team,Q1,Q2,q1` |
| Somma con un valore numerico non valido | `INVALID_NUMERIC_VALUE` | somma `null` senza rifiuto |
| Sort numerico con virgola decimale italiana | `A,B,C` | ordinamento lessicografico `C,A,B` se non si applica conversione |

Queste differenze sono correggibili con validazione e normalizzazione dedicate, ma **il donor diretto non raggiunge la parità**. Il codice attuale offre inoltre previsione di cardinalità prima della materializzazione del join, limiti di righe/celle, disclosure di colonne e CSV escaped contro formule: andrebbero conservati in un adapter. Il beneficio misurato non giustifica oggi l'adapter e la dipendenza aggiuntiva; un'eventuale CSP restrittiva ne aumenterebbe il costo di compatibilità.

## Riproduzione ed evidenze

Su una worktree isolata da `origin/main`, Node 26.10.0:

```sh
npm ci --ignore-scripts
npm install --no-save --package-lock=false --ignore-scripts arquero@8.0.3
/opt/homebrew/bin/node --expose-gc --import tsx scripts/arquero-gate-292.mts
/opt/homebrew/bin/node scripts/arquero-browser-gate-292.mjs
npm run catalog:build
npx vitest run tests/table-advanced-operations.test.ts tests/table-ops-handoff.test.ts tests/table-transform-upgrade-195.test.ts --maxWorkers=1
npm run build
python3 -m http.server 18592 --bind 127.0.0.1 --directory dist  # in un terminale separato
STR292_BUILD_ORIGIN=http://127.0.0.1:18592 /opt/homebrew/bin/node scripts/arquero-built-ui-gate-292.mjs
```

- **3 suite / 28 test preesistenti PASS**; fixture JSON vere da `quality/fixtures/csv-table-ops/vectors.json` e casi ostili. L'harness Node asserisce le divergenze osservate, la conservazione degli input e il rifiuto della cardinalità esplosiva prima della materializzazione; misura tempi mediani su cinque iterazioni, dopo warm-up, heap delta post-operazione con `--expose-gc` (indicatore, non profiling completo del picco interno).
- Misura locale Node (una esecuzione, sensibile a hardware/GC): join 5.000 righe motore **10,67 ms / +16,93 MiB**, Arquero **3,04 ms / +3,24 MiB**; group 20.000 righe motore **4,57 ms / +9,16 MiB**, Arquero **4,46 ms / +2,90 MiB**. Il donor è più rapido in questo caso semplice, ma non ha parità semantica e richiede nuove regole. Nessun claim di benchmark universale.
- Bundle browser minificato (esbuild, prova completa con materializzazione effettiva del join donor): modulo di prova con motore **27.124 B**, stesso modulo con Arquero **257.520 B** (+230.396 B). Prova tree-shaking separata del turno precedente: operazioni table attuali ~28.665 B / 10.294 B gzip, Arquero ~229.825 B / 72.873 B gzip. Sono payload del probe, non una misura del bundle di produzione.
- **Chromium 153 desktop 1440×900 e mobile emulato 375×667**: motore corrente scarica `joined-292.csv`, riaperto da `python3/csv.reader`, 4 righe con `001`, `Zoë`, `李`, token `NULL` e formule neutralizzate (apostrofo iniziale); CSP errors **0**, external requests **0**. Arquero con la CSP restrittiva del probe: **bloccato in entrambi**, external requests **0**; con CSP che consente `'unsafe-eval'`: **3 righe di join**, errori CSP **0**, external requests **0**, in entrambe le viewport. Gli script non affermano una prova di dispositivo fisico o dell'header CSP in produzione.
- **Consumer compilato reale**: `npm run build` produce **304 pagine**; il browser apre `/tools/csv-join/` servita da `dist/`, compila la richiesta full join dal form Preact idratato, clicca `Scarica risultato`. Desktop e mobile emulato HTTP **200**, CSV `csv-join.csv` con **4 righe / 4 colonne**, rilettura indipendente Python esatta incluse intestazioni, Unicode, zeri iniziali e formule inerti, **0 errori JS** e **0 richieste esterne**. Lo smoke usa l'app compilata su loopback, non certifica l'hosting pubblico o hardware mobile reale.
- La pagina di **prova locale** usa esplicitamente `connect-src 'none'`; il probe non effettua chiamate a Worker Cloudflare né upload. Le route `worker/**`, i contratti di rete e il codice applicativo non sono modificati. Il valore `performance.memory.usedJSHeapSize` è un campione, **non** un picco di memoria complessiva su mobile.
- Gate di repository: `npm test -- --maxWorkers=1` → **407 suite PASS, 2.859 test PASS, 9 skipped**; `npm run tickets:test` → **5 PASS**; `npm run check` → **exit 0, zero errori/avvisi, 38 hints**; `npm run build` → **304 pagine, build inspection PASS**; `npm run deploy:check` → **portable PASS e Cloudflare dry-run PASS**, senza pubblicazione.

## Decisione, rollback e seguito

**NO_GO per la proposta di adozione di Arquero 8.0.3 allo stato attuale**. Nessuna dipendenza in `package.json` o `package-lock.json`, nessun adapter attivato, nessun deploy/Gold, nessuna modifica al consumer: nell'uso reale resta l'implementazione corrente già verificata. Gli script del gate sono solo strumenti di prova e richiedono l'installazione locale temporanea indicata sopra; `npm ci` ripristina l'albero delle dipendenze. Eventuale rivalutazione con nuovo confronto di fedeltà, bundle, CSP e rollback, e con verifica dell'evoluzione di [#361](https://github.com/uwdata/arquero/issues/361).
