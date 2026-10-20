# STR-275 — valutazione di `yaml@2.9.1` per `yaml-formatter`: NO_GO

Decisione del 20 ottobre 2026: **non adottare** l'adapter `yaml@2.9.1` in `yaml-formatter`. L'issue [#275](https://github.com/domenicomassafra/strumentini-it/issues/275) richiede di interrompere la sostituzione quando il donor peggiora i risultati. Due nuove esecuzioni sotto lock sul MiniPC, Node 26.12.0, confermano mediane 7,9–11,8 volte più lente. Nessuna modifica all'engine, al catalogo o alle dipendenze di produzione deriva da questa valutazione documentale.

## Donor confrontato e tracciabilità

- Upstream [eemeli/yaml](https://github.com/eemeli/yaml), tag `v2.9.1`, commit `1440ecd3d1bff41e4ac399f8f6839e810328bd16`; release 2026-09-11. Licenza **ISC**, file `LICENSE` nel pacchetto. Ultimo push upstream annotato durante la ricognizione del 2026-10-19: 2026-09-23; repository non archiviato.
- npm `yaml@2.9.1`: tarball `https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz`, SHA-256 `4ef6c54cf559b8a207b7b518378230805a1c84af239b14960e8c67c7d59de5d3`; SRI `sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`.
- Nessuna dipendenza runtime dichiarata (normale, opzionale o peer), nessun asset esterno/WASM/fonts rilevato nel candidato, nessun notice aggiuntivo oltre alla licenza ISC. La verifica generale delle dipendenze #126/#366 rimane un gate autonomo.
- La prova resta nello **staging non integrato** del worktree `strumentini-it-275-round6`, branch `feat/str-275-round6` su base `d91a78703f84b02561fe7f93a1340a01344f3079`. Include `scripts/benchmark-yaml-275.ts`, fixture differenziali e adapter. L'esperimento è conservato per audit; non implica l'adozione.

## Prestazioni misurate

Entrambe le esecuzioni hanno usato lo **stesso benchmark**, con `performance.now()`, ordine `legacy-local` poi `yaml-2.9.1`, chiamate seriali nello stesso processo. I tempi sono **wall-clock**, non CPU isolata: 25 run per `service-config` (147 caratteri), 8 per `generated-records` (43.789 caratteri e 2.002 righe). Il confronto misura il percorso formatter completo; l'import dinamico è incluso nel candidato. Node `v26.12.0` sul MiniPC, lock esclusivo `/tmp/strumentini-heavy.lock`.

| Run | Input | Mediana locale | Mediana donor | Regressione | p95 locale / donor |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | 147 caratteri | 0,078 ms | 0,920 ms | **11,8×** | 0,224 / 2,054 ms |
| 1 | 43.789 caratteri | 5,341 ms | 46,495 ms | **8,7×** | 12,451 / 473,017 ms |
| 2 | 147 caratteri | 0,087 ms | 0,880 ms | **10,1×** | 0,271 / 1,767 ms |
| 2 | 43.789 caratteri | 6,093 ms | 48,209 ms | **7,9×** | 14,275 / 649,184 ms |

| Run e input | Heap locale / donor dopo le chiamate | RSS locale / donor dopo le chiamate |
| --- | ---: | ---: |
| 1, 147 caratteri | 19,42 / 22,23 MiB | 82,29 / 88,44 MiB |
| 1, 43.789 caratteri | 23,73 / 55,56 MiB | 94,19 / 156,94 MiB |
| 2, 147 caratteri | 16,30 / 19,52 MiB | 76,98 / 85,86 MiB |
| 2, 43.789 caratteri | 26,72 / 39,04 MiB | 97,11 / 131,73 MiB |

Heap e RSS sono **massimi campionati dopo ciascuna chiamata nello stesso processo**: indicano pressione di memoria maggiore nella fase donor, ma non sono misure isolate del costo incrementale del pacchetto né high-water mark del browser. Il p95 con 8 run può risentire del primo import e della GC; le regressioni delle mediane si ripetono e bastano ad applicare il vincolo di rifiuto dell'issue. Le misure non dimostrano un beneficio CPU, di bundle o Safari mobile.

Riproduzione dal worktree sperimentale già staged (con Node 26 disponibile nel `PATH`):

```sh
flock -w 1800 /tmp/strumentini-heavy.lock npx tsx scripts/benchmark-yaml-275.ts
flock -w 1800 /tmp/strumentini-heavy.lock npx vitest run tests/developer-web-engine.test.ts tests/developer-transform-download.test.ts tests/yaml-formatter-275.test.ts --maxWorkers=1
```

## Qualità funzionale e gate

Le fixture indipendenti esplorano configurazioni realistiche, numeri YAML 1.2, multilinea, flow collections e rifiuti di tag/alias/duplicati/limiti. Il donor migliora alcune forme rispetto al parser locale. Il rerun del 20 ottobre, con Node 26.12.0 e lock MiniPC, ha concluso **37/37 test mirati verdi su 3 file** (26 engine, 9 specifici YAML, 2 download); questi successi non compensano la regressione prestazionale richiesta dal criterio di adozione. Il candidato resta una prova locale senza promozione Gold, senza attestazione Safari mobile fisico e senza deployment.

Inoltre, il gate generale di provenance `npx tsx scripts/donor-provenance-366.ts --check` nel candidato era `NO_GO` per materiale preesistente (font pubblici, core OCR e licenze di modelli/lingue OCR). Non si trasferiscono certificazioni o autorizzazioni da questa prova.

**Esito:** continuare con il percorso locale esistente di `yaml-formatter`. Qualsiasi proposta futura di sostituzione richiede un nuovo confronto più favorevole, un gate #366 adeguato e accettazione completa. La #275 può essere chiusa con rifiuto motivato: l'implementazione sperimentale non è un cambiamento di prodotto consegnato.
