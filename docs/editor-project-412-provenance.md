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
