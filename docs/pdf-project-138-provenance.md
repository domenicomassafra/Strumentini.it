# STR-379 / #138 — Provenienza primitive PDF project

Verifica 20 ottobre 2026: la route esistente #132 riusa il motore e il renderer
PDF del prodotto, senza adottare altri pacchetti o scrivere un secondo editor.

- [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1, MIT; release
  [v1.17.1](https://github.com/Hopding/pdf-lib/tree/4beebbef7a261ed0be089bb1d63a5b6e28cc488a)
  (commit 2021-11-06), già in `package-lock.json`. Il parser indipendente
  riapre il file all'ingresso e al ripristino; lo stesso motore #132 produce
  l'output verificato con geometria e contenuto.
- [Mozilla PDF.js](https://github.com/mozilla/pdf.js/tree/d0991a0d53f3bb3a7307e3b83f279c1d117aafb3)
  v6.4.299, Apache-2.0, tag Git verificato su GitHub il 20 ottobre 2026.
  La route #132 usa già la sessione bitmap per la conta pagine e le miniature.
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
  e [Web Crypto SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest):
  API Web native, senza librerie né licenza donor aggiuntive. Si estende in modo
  additivo il DB `strumentini-optin-pdf-341` dalla versione 1 alla 2 con
  object store `projects`; lo store `pdf` #341 resta invariato. Transazioni
  IDB atomiche; checksum SHA-256 calcolato prima della scrittura e riletto
  prima di offrire il ripristino.

L'implementazione owner è limitata a validazione di storia, salvataggio esplicito
di snapshot immutabili e pulsanti nello stesso `PdfPageWorkspace372`.
Nessun payload donor copiato, nessuna dipendenza runtime aggiunta. La scelta
di API native rispetto a wrapper come `idb` evita un secondo strato persistence
per una transazione singola e rispetta il codice #341 già collaudato.

Verifica 22 ottobre 2026 per la regressione del ripristino: [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)
v6.2.6 (release 2026-10-16, commit upstream `8881007614a7c04e1766f0b802992a5dfacfafd7`),
Apache-2.0, solo `devDependency` per eseguire il vero seam IndexedDB da Vitest su Node.
La libreria emula transazioni/store/versioni; non entra nel bundle di produzione.
L'implementazione dell'eliminazione selettiva riusa la transazione `delete(id)`
già impiegata in `deleteSavedPdf341`, con store `projects` separato.
