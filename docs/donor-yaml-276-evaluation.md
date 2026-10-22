# STR-276 — `json-yaml-converter`: valutazione separata e NO_GO `yaml@2.9.1`

**Decisione (20 ottobre 2026): NON adottare** `yaml@2.9.1` nel converter JSON ↔ YAML, perché il percorso reale candidato peggiora i tempi di JSON → YAML di **10,0–12,5 volte** sui corpus misurati. Questo applica il criterio esplicito di [#276](https://github.com/domenicomassafra/strumentini-it/issues/276): «non effettuare il cambio se peggiore». Il [NO_GO #275](https://github.com/domenicomassafra/strumentini-it/issues/275) era relativo al formatter YAML; il presente confronto misura **separatamente entrambi i versi** del converter. Il percorso di produzione rimane invariato.

## Provenienza, licenza e candidato

- Upstream [eemeli/yaml](https://github.com/eemeli/yaml), tag `v2.9.1`, commit `1440ecd3d1bff41e4ac399f8f6839e810328bd16`; release del 2026-09-11; licenza **ISC** (LICENSE del pacchetto). Ricognizione upstream del 2026-10-19: non archiviato, ultima attività annotata 2026-09-23.
- npm `yaml@2.9.1`: `https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz`; SHA-256 `4ef6c54cf559b8a207b7b518378230805a1c84af239b14960e8c67c7d59de5d3`; integrity npm `sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`.
- La dipendenza candidata non dichiara dipendenze transitive runtime/optional/peer né asset WASM, font o fetch esterni; solo JS e licenza ISC, senza NOTICE ulteriore. Il gate generale di licenze/provenance **#126/#366** rimane autonomo; la ricevuta #275 lo indicava NO_GO per elementi preesistenti. Qui non è stata effettuata adozione né presentata la sola SRI come autorizzazione.
- Esperimento preservato **non integrato**: MiniPC `~/Code/.worktrees/strumentini-it-276` (WIP su `cc0a90fe`, modifica `index.ts`, download runtime, test, manifest npm; `yaml-adapter.ts` e fixture untracked) e Studio `~/Code/.worktrees/strumentini-it-276` (branch `feat/str-276-yaml-converter`, WIP distinto). Nessun reset né riscrittura dei due worktree.
- Il candidato MiniPC `jsonYamlConverterWithDonor` calcola **sempre** il risultato legacy. In JSON → YAML esegue inoltre stringify **e parse** del donor, verifica uguaglianza JSON e usa il fallback se il roundtrip non coincide; in YAML → JSON restituisce direttamente il risultato legacy. La versione donor pura è stata misurata separatamente come controprova del costo senza doppia validazione. La #275 non ha integrato in `main` alcun adapter da condividere.

## Benchmark Node 26 sul corpus specifico JSON ↔ YAML

Macchina: MiniPC, `node v26.12.0`, esecuzione con `flock -w 1800 /tmp/strumentini-heavy.lock`, sotto `tsx`. Fixture indipendenti presenti nel WIP `tests/fixtures/json-yaml-converter-276/corpus.json` (14 JSON→YAML, 9 YAML→JSON) e due dataset più grandi di 150 e 450 record realistici. Confronto a parità di input/indent, stessa sessione e operazioni seriali, ordine alternato fra le iterazioni. Warmup iniziale dell'import. **20 ripetizioni** per ciascuna piccola fixture, **8** per ogni input grande; `performance.now()` misura la latenza, `process.cpuUsage()` campiona il tempo CPU nel terzo controllo. Si riportano mediane; i p95 sono prodotti dal benchmark di lavoro.

| Direzione | Dimensione input (caratteri) | Mediana legacy (ms) | Mediana adapter WIP (ms) | Rapporto |
| --- | ---: | ---: | ---: | ---: |
| JSON → YAML, run 1 | 24.705 | 2,267 | 26,955 | **11,9× più lento** |
| JSON → YAML, run 2 | 24.705 | 2,341 | 29,183 | **12,5× più lento** |
| JSON → YAML, run 1 | 74.452 | 5,953 | 70,188 | **11,8× più lento** |
| JSON → YAML, run 2 | 74.452 | 6,840 | 68,277 | **10,0× più lento** |
| YAML → JSON, run 1 | 28.895 | 1,710 | 1,992 | 1,16× (fallback legacy) |
| YAML → JSON, run 2 | 28.895 | 1,968 | 1,674 | 0,85× (fallback legacy) |
| YAML → JSON, run 1 | 87.042 | 4,563 | 4,820 | 1,06× (fallback legacy) |
| YAML → JSON, run 2 | 87.042 | 5,313 | 5,227 | 0,98× (fallback legacy) |

Il donor **senza** verifica supplementare è comunque più lento: per JSON → YAML 150/450 record, run 1, **7,905/17,225 ms** contro **2,267/5,953 ms** legacy; run 2 **6,772/16,872 ms** contro **2,341/6,840 ms**. Per YAML → JSON il parser donor diretto è molto più lento del parser locale: sui 150/450 record **15,194/43,615 ms** contro **1,710/4,563 ms** (run 1), **15,011/46,056 ms** contro **1,968/5,313 ms** (run 2).

Il terzo controllo con `process.cpuUsage()` e 8 ripetizioni per dataset ha dato in JSON → YAML: **150 record 4,801 ms CPU locale vs 62,859 ms CPU adapter**, **450 record 7,043 vs 94,134 ms CPU**. Latenze wall-clock della stessa prova: 2,373 vs 30,526 ms e 5,107 vs 64,606 ms. La CPU misura il processo nel suo complesso (incluse attività V8/GC), non una quota isolata della libreria; conferma però la direzione della regressione delle latenze.

Byte input JSON 150/450 record: **25.155/75.802**; byte input YAML: **29.345/88.392**. Gli output del WIP e del motore locale sui due dataset grandi sono identici nei byte: JSON→YAML **29.345/88.392**, YAML→JSON **38.971/117.218**. Non emerge un vantaggio di compressione. Heap e RSS campionati **dopo** le operazioni nello stesso processo variano con GC e ordine: per JSON→YAML da 450 record nel controllo CPU, ad esempio, heap 81,73 MiB legacy vs 92,55 MiB adapter, RSS 200,56 vs 200,19 MiB. Non sono differenze causali isolate né high-water mark, quindi non supportano dichiarazioni di miglioramento della memoria o di un budget browser.

## Qualità, limiti e decisione

Nel confronto differenziale: **14/14 fixture JSON→YAML** conservano il valore JSON e sono rileggibili con parser donor; **10/14** producono gli stessi byte legacy e **4/14** cambiano quoting/multilinea, aumentando di 2–9 byte il risultato di quelle fixture. Nel verso YAML→JSON **8 fixture** sono accettate con valori e output uguali al legacy; **una nona fixture** (`chuni-annidati`) è già invalida nel parser locale e viene rifiutata anche dal candidato. I rifiuti esistenti su tag, duplicati, tab, input malformati e alias sono conservati (18 rifiuti su 9 casi × 2 percorsi). Per `.inf` e `.nan` il motore corrente conserva la sua interpretazione come stringa, mentre il parser donor diretto applica una semantica diversa: un passaggio automatico a quel parser richiederebbe una decisione esplicita, non soddisfatta qui.

Non sono stati prodotti nuovi bundle né installata dipendenza runtime, quindi non esiste una prova CSP/Safari mobile/Worker per un adapter **non adottato**; non sono stati inventati receipt fisici o Gold. Il candidate non supera l'AC prestazionale prima di quel gate. È stato inoltre evitato qualunque cambio al PDF repair **#171**: non ci sono file sorgente condivisi con #276, ma i due lavori hanno conteso il medesimo lock per build e test sul MiniPC.

**Risoluzione:** archiviare #276 come **NO_GO / not planned**, con le prove nella issue originale. Restano il motore legacy e i suoi rifiuti. Una futura proposta dovrebbe mostrare beneficio end-to-end riproducibile per entrambi i versi, preservare le semantiche JSON e superare provenance, CSP, browser e gate del prodotto; i WIP sperimentali restano preservati per tracciabilità.
