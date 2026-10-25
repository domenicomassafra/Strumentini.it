# STR-412 — provenienza e limiti della tranche schema

Ricerca effettuata il **22 ottobre 2026**, prima della modifica. Scope: versionamento,
portabilità e migrazione reversibile dei progetti PDF e immagine. Le dipendenze
funzionali #138 e #144 sono ancora OPEN. Il codice di questa tranche non collega
un'interfaccia editor alla persistenza e non dichiara prove browser o deploy.

| Soluzione | Fonte e revisione | Licenza | Decisione |
| --- | --- | --- | --- |
| PersistenceAdapter + IndexedDB del repository | `src/persistence/persistence.ts`, `src/workbench/saved-pdf-341.ts` a main `5f49ff6f` (22/10/2026) | owner | Riutilizzato. Esteso con `add` atomico per salvare solo nuove chiavi, senza sovrascrivere gli snapshot precedenti. |
| Cronologia e salvataggio PDF #138 | PR [#400](https://github.com/domenicomassafra/Strumentini.it/pull/400), commit `39e852b5d3847e856fbc8305a974e44e2d00dfd8` (21/10) | owner; motore pdf-lib MIT | Record v1 letto e verificato mediante i checksum già previsti, senza modificare il database di #138. L'integrazione UI attende il merge della PR. |
| fflate 0.8.3 | [release v0.8.3](https://github.com/101arrowz/fflate/releases/tag/v0.8.3), commit [dcb3714a6c25db3a2748641019c5277413d09714](https://github.com/101arrowz/fflate/commit/dcb3714a6c25db3a2748641019c5277413d09714) (verifica 22/10/2026) | MIT | Già dipendenza del progetto; usate `zipSync`/`unzipSync` e filtro dimensioni dalla API ufficiale per gli allegati inclusi negli ZIP. Nessun pacchetto nuovo. |
| Web Crypto SHA-256 | [SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) (verifica 22/10/2026) | API browser nativa | Hash file e stato prima di aprire o memorizzare. |
| Dexie.js | [Dexie.js](https://dexie.org/) (verifica 22/10/2026) | Apache-2.0 | Non adottato: IndexedDB e l'adapter locale sono già presenti. |

**Motivo del codice owner:** lo schema di archivio comune e la conversione da
record PDF v1 a ZIP completo non esistono nei donor o nei writer di #138/#144.
La migrazione produce una nuova istanza v2 e lascia il record v1 intatto. Il
salvataggio richiede il consenso esplicito del chiamante; errori di checksum,
schema sconosciuto, file mancante, collisione o quota rifiutano la scrittura.
La semantica di editing dello stato deve essere controllata dall'editor proprietario
prima di ripristinare la sessione; questa libreria verifica integrità e formato
del contenitore e non sostituisce i suoi motori. La versione immagine v1 di
#144 non è ancora definita su main: non viene inventata una sua migrazione.


## Integrazione PDF #474 — 25 ottobre 2026

La tranche del 22/10 è stata completata nell'editor PdfPageWorkspace372:
usa src/workbench/pdf-project-412.ts per salvare snapshot v2 su richiesta,
elencarli, verificare hash/stato prima del restore e migrare esplicitamente
i record v1 di #138 con inserimento atomico add-only. I record v1 rimangono
conservati e accessibili tramite la UI preesistente. Uno schema futuro,
un allegato mancante, uno storico incoerente o un ID già esistente
causano rifiuto. L'archivio v2 browser usa createIndexedDbPersistence
(owner, src/persistence/persistence.ts) e il database
strumentini-editor-projects-412, object store state, separato dal DB v1
strumentini-optin-pdf-341. Il controllo pagine riprende pdf-lib già
dipendente del progetto (MIT); nessuna nuova dipendenza. Il test
consumer PDF è tests/str-412-consumer.browser.mjs; la figlia immagine
#475 rimane responsabile della propria integrazione e verifica.

## Integrazione editor immagini #475 — 25 ottobre 2026

Il paragrafo storico sopra descrive il solo schema del 22 ottobre. Ora lo
schema v2 e il salvataggio immagini v1 (#144) sono su main. La UI
`/tools/image-crop/` riutilizza lo schema v2 comune,
`createIndexedDbPersistence` del repository, le cronologie
`project-history-385`, la decodifica `readImageTransformSource` e il
contenitore ZIP/hash già disponibili. Nessun pacchetto aggiunto.

La nuova copia immagine v2 salva i byte della sorgente come asset `source`
con SHA-256, nome, dimensioni e cronologia di undo/redo (past/current/future).
Il restore verifica il contenitore e ogni trasformazione prima di sostituire
lo stato in UI; la decodifica verifica anche le dimensioni effettive.
L'elenco v2 usa `PersistenceAdapter.keys` per trovare snapshot creati
atomicamente, senza sovrascrivere le copie preesistenti. L'interfaccia
continua a leggere il formato immagine v1 di #144; salvarlo di nuovo crea
una nuova istanza v2 e conserva il record v1. La prospettiva è ancora un
export PNG separato secondo i limiti già dichiarati da #144.
