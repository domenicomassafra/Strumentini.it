# STR-385 — Riuso per progetti immagine (22 ottobre 2026)

Nessun donor runtime nuovo: usa la History e la pipeline PNG di `src/engines/image/transform-workspace.ts` e IndexedDB/transaction API native ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), consultato il 22/10/2026). Il gap custom è il salvataggio opt-in del file originale con parametri trasformazione, schema v1 e revisione CAS atomica, non presenti nell'adapter IndexedDB generico del repository.

Donor soltanto **dev/test**: [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB), Apache-2.0. Il branch originale aveva verificato `6.2.5` al commit `65f2c04e242550e86f86fcdff17cbee81ae96604`; la riconciliazione del 24/10 conserva la versione `6.2.6` già presente in `main` e la sua integrità registrata in `package-lock.json`. I sorgenti del donor non sono modificati. Nessuna nuova licenza copyleft né autorizzazione release.
