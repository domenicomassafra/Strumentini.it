# STR-416 — provenienza e campo di prova (20 ottobre 2026)

Motore riusato: [fflate](https://github.com/101arrowz/fflate) **0.8.3**, già
presente in `package.json` e `package-lock.json`. Pacchetto:
[npm fflate 0.8.3](https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz);
licenza MIT (metadati npm verificati il 20/10/2026), mantenimento registrato:
ultima modifica metadati npm 20/07/2026. La provenienza della dipendenza era
già registrata in `docs/donor-provenance-366-2026-10-11.md`; nessun nuovo
pacchetto o codice vendorizzato è stato introdotto.

Riuso diretto: `zipSync`, `gzipSync`, `Inflate`, `Gunzip`, più la policy
esistente `checkZipPath407` e `checkZipEntryType407`. Controlli aggiunti
localmente: directory ZIP e header locale coerenti, CRC32 e ISIZE, budget
misurati durante l'inflazione, collisioni di percorso, archivi annidati,
limite 15 s e terminazione del Web Worker. Scaricare un file richiede un
gesto esplicito; nessuna estrazione scrive su un percorso file system.

Prove ripetibili: `npx vitest run tests/regroom-str-416.test.ts --maxWorkers=1`
con decompressione indipendente Python `zipfile` e `gzip -dc`, fixture
ostili e `node tests/regroom-str-416.browser.mjs` sul consumer compilato.
Le verifiche fanno riferimento esclusivamente ai limiti e formati supportati;
nessuna dichiarazione di compatibilità generale ZIP64, cifratura o dispositivi
fisici è implicita. Il deploy produzione mantiene i gate autonomi del progetto.
