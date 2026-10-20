# STR-422 — reader EPUB3 offline: provenienza e limiti (20 ottobre 2026)

Donor riusati senza installare nuove dipendenze:

- [fflate 0.8.3](https://github.com/101arrowz/fflate), **MIT**, [npm tarball](https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz), npm metadata verificati il 2026-10-20 e ultima modifica metadata 2026-07-20. Usato tramite il parser ZIP locale STR-416 già integrato, che verifica header central/local, CRC32, quote, collisioni e inflazione bounded.
- [parse5 8.0.0](https://github.com/inikulin/parse5), **MIT**, [npm tarball](https://registry.npmjs.org/parse5/-/parse5-8.0.0.tgz), npm metadata verificati il 2026-10-20 e ultima modifica metadata 2026-04-19. Analizza struttura XHTML in stringhe inerti; nessun codice HTML viene iniettato nella pagina.
- Guard interno STR-407, [issue #164](https://github.com/domenicomassafra/strumentini-it/issues/164): controllo archivio ZIP e risorse XML/SVG. Specifica primaria [W3C EPUB 3.3](https://www.w3.org/TR/epub-33/). Nessun nuovo donor LGPL/MPL/GPL/AGPL.

Il lettore tratta EPUB3 come **contenitore di testo non attendibile** e non carica né rende HTML, CSS, immagini, SVG, script, riferimenti esterni o URL. Rifiuta asset attivi, percorsi non sicuri e file DRM/cifrati. Il profilo ammesso richiede mimetype iniziale store, container, OPF, spine e navigazione; input fino a 8 MiB, massimo 32 membri ZIP, 24 MiB espansi, 256 KiB di testo selezionato, 32 capitoli e quote ZIP della #407/#416. L'intero lavoro attraversa un Web Worker isolato, terminato entro 15 secondi o su annullamento; nessun output è pubblicato prima della conclusione completa.

Corpus locale in quality/fixtures/epub3-local-safe/: EPUB3 sintetici costruiti in modo indipendente con Python zipfile, testi originali senza diritti di terzi. Le prove sono: npx vitest run tests/regroom-str-422.test.ts tests/regroom-str-422-worker.test.ts --maxWorkers=1; npm run check; npm run build; node scripts/acceptance-epub-422.mjs sul consumer compilato Chromium 390px, TXT scaricato e riaperto e assenza di traffico esterno. La prova sintetica non attribuisce certificazione Gold, supporto DRM, EPUB3 arbitrari o verifica su dispositivi fisici.
