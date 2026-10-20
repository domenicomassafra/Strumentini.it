# STR-369 — Decisione sul motore di editing PDF

Verifica: **19 ottobre 2026**. Perimetro: editing locale nel browser, licenza compatibile con prodotto proprietario. Decisione: **mantenere il writer/parser interno per le sole modifiche dimostrate e PDF.js per lettura/rendering; nessuna nuova libreria adottata**. Un editor di testo PDF arbitrario non è dimostrato, quindi la capacità generale resta **NO_GO**. Non vengono attribuiti Gold, diritti commerciali o prestazioni su dispositivi fisici.

| Motore / fonte (verificata il 19/10/2026) | Feature e risultato indipendente | Licenza / transitive | Bundle locale / deploy | Mobile / decisione |
| --- | --- | --- | --- | --- |
| [Parser e writer interni](../src/engines/pdf/parser.ts), [filigrana](../src/engines/pdf/watermark.ts) | **PASS**: PDF reale a 2 pagine, overlay testuale persistente sulla pagina 1; lettura con PDF.js conserva `alpha`, aggiunge `STR369_OVERLAY`, lascia pagina 2 `beta`. Sostituzione arbitraria del testo esistente e reflow: **NO_GO** | Codice first-party; diritti di font e file in ingresso distinti. | Parte dei chunk applicativi; costo di download produzione **NOT_MEASURED**. | RAM su Android/iOS reali **NOT_RUN**. **KEEP_SCOPED** |
| [Mozilla PDF.js](https://mozilla.github.io/pdf.js/), [LICENSE](https://github.com/mozilla/pdf.js/blob/master/LICENSE), `pdfjs-dist@6.4.299` | **PASS**: lettura, estrazione testo prima/dopo l'overlay indipendente, 2 pagine; API di sostituzione testuale preesistente **NOT_PROVEN** | Apache-2.0 dichiarata; 10 notice installati (JBIG2, OpenJPEG, qcms, Liberation GPLv2 con eccezione, Foxit, CMaps); diritti transitive e QuickJS **NOT_CLEARED**. Hash locali e SRI di lock non attestano autonomamente il tarball originale. | Browser `860818 B` raw / `178397 B` gzip; worker `2229713 B` raw / `478728 B` gzip; codec WASM separati. Download reale produzione **NOT_MEASURED**. | RAM/decompressione su dispositivi fisici **NOT_RUN**. **RENDER_ONLY** |
| [pdfstudio 0.4.0 vendorizzato](../src/engines/pdf/vendor/pdfstudio/PROVENANCE.md), [qpdf upstream](https://github.com/qpdf/qpdf) | Wrapper qpdf già usato per password; modifica semantica del testo pagina **NOT_PROVEN**. File WASM confrontato con hash riportato nel PROVENANCE locale. | Apache-2.0 dichiarata nei file vendorizzati e qpdf upstream. Il tarball pubblicato e la catena qpdf/zlib/libjpeg non sono riattestati in modo indipendente: **NOT_CLEARED**. | qpdf WASM `2244725 B` raw / `693954 B` gzip, caricato su richiesta; download produzione **NOT_MEASURED**. | Picco di memoria WASM su mobile fisico **NOT_RUN**. **KEEP_SCOPED** |
| [pdf-lib](https://github.com/Hopding/pdf-lib), [limitazioni ufficiali](https://www.npmjs.com/package/pdf-lib) | Creazione, overlay, modifica campi modulo. La documentazione esclude API per cambiare testo già presente fuori da un modulo. **NO_GO** per sostituzione generica. | MIT dichiarata upstream; dipendenze, package installato e relativo bundle **NOT_VERIFIED**. | **NOT_MEASURED**, non installato. | **NOT_RUN**. **NO_ADOPT** |
| [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) (`2.11.1` nello spike isolato) | Donor sperimentale presente in `spikes/heavy-local-feasibility/package.json`; integrazione editor prodotto e sostituzione arbitraria di testo esistente **NOT_PROVEN**. | MIT nel manifest del package dello spike; verifica indipendente degli asset e delle transitive **NOT_RUN**. | **NOT_MEASURED**; non è una dipendenza runtime del prodotto. | **NOT_RUN**. **NO_ADOPT** |
| [MuPDF.js](https://github.com/ArtifexSoftware/mupdf.js), [licenza Artifex](https://artifex.com/licensing) | Editing pubblicizzato upstream; nessun round-trip locale, prestazioni o licenza d'uso acquisita: **NOT_RUN**. | AGPLv3 o licenza commerciale: l'uso proprietario senza accordo è **NO_GO**. | **NOT_MEASURED**, non installato. | **NOT_RUN**. **NO_ADOPT** |
| [macOS PDFKit](https://developer.apple.com/documentation/pdfkit) | API native, non forniscono un motore JS/WASM cross-browser. | Framework Apple di sistema; non redistribuito come donor Web. | **NOT_APPLICABLE** | **NOT_APPLICABLE**. **NO_ADOPT** |

La matrice eseguibile e i numeri in byte sono prodotti da `npx tsx scripts/audit-pdf-engine-provenance-369.ts`; le misure si riferiscono ai file installati localmente e alla loro compressione gzip, **non** al peso effettivo della build di produzione, del trasferimento HTTP o alla RAM mobile. L'analisi AST delle importazioni statiche e i notice locali non attestano da soli i diritti di ogni transitive né l'assenza di rete con URL costruiti a runtime.

Prova reale riproducibile senza cambiare il prodotto: `npx vitest run tests/audit-pdf-engine-provenance-369.test.ts --maxWorkers=1` riapre il file sorgente e quello modificato con il parser indipendente `pdfjs-dist/legacy`, confronta testo di entrambe le pagine, verifica SHA distinti, license gate, decisioni e limiti. `npx tsx scripts/audit-pdf-engine-provenance-369.ts` stampa il report JSON completo. I controlli di build sono `npm run check && npm run build`. Dopo la build, `node scripts/acceptance-pdf-engine-369.browser.mjs` verifica la rotta reale compilata nella scheda del browser di automazione esistente, il rifiuto PDF malformato, download, readback indipendente, operatori grafici e assenza di richieste offsite (richiede CDP visibile su `127.0.0.1:17630`).

Rimane esplicitamente **NO_GO** presentare una capacità di modifica arbitraria del testo PDF o acquistare/distribuire MuPDF per uso proprietario senza licenza. La decisione presente consente esclusivamente di continuare a usare le operazioni PDF già implementate e provate nei rispettivi perimetri.

## Aggiornamento STR-373 / #133 — 20 ottobre 2026

La precedente decisione **NO_GO per l'editing arbitrario** resta valida. Il motore first-party
[src/engines/pdf/edit-original-text-133.ts](../src/engines/pdf/edit-original-text-133.ts)
estende soltanto il sottoinsieme verificabile: su documenti PDF non cifrati, non firmati,
senza annotazioni, moduli o risorse grafiche complesse, ogni pagina con un unico operatore
di testo BT ... Tf ... Td (testo) Tj ET in stream indiretto non compresso,
il contenuto testuale originale può essere sostituito con ASCII stampabile, stessa lunghezza,
font Courier Type1 standard e identica metrica di avanzamento. L'operazione cambia lo
stream originale ed esporta una nuova copia; non inserisce overlay. La sorgente rimane immutata.

Sono esplicitamente **UNSUPPORTED_CAPABILITY / NO_GO**: font proporzionali o incorporati,
glifi Unicode/non mappati, stringhe di lunghezza differente, kerning/TJ, più operatori
di testo per pagina, reflow, testo in immagini, contenuti condivisi o compressi,
pagine ruotate, layout ambiguo, annotazioni (anche vuote), AcroForm, firme,
PDF cifrati/linearizzati, object stream e strutture non riconosciute. Non si deduce
dai casi verificati un editor universale, una garanzia su PDF esterni, Gold,
supporto fisico mobile o un deploy di produzione.

**Provenienza:** parser e writer originali del repository (codice first-party),
conservati e riusati senza librerie runtime aggiuntive; PDF.js pdfjs-dist@6.4.299
(Mozilla, Apache-2.0 dichiarata, incluso notice del package) impiegato come
lettore indipendente nel test Node. Poppler (pdfinfo, pdftotext,
pdffonts, pdftoppm) impiegato esclusivamente come oracolo esterno nel
consumer di accettazione su MiniPC; non è distribuito con il sito. Il vincolo
sulla distribuzione delle componenti transitive di PDF.js resta quello annotato
nella matrice STR-369 e non è qui ampliato. Donor, versioni e riferimenti upstream
rimangono quelli del confronto STR-369; nessuna adozione di MuPDF AGPL/commerciale.
