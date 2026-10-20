# STR-418 — riparazione PDF a profilo ristretto

La route pubblica `/tools/pdf-repair/` recupera **esclusivamente** un documento PDF 1.0–1.7 con una tabella xref classica singola, un trailer e un solo marcatore `startxref`, quando il numero nel marcatore non indica l'effettivo offset della tabella. L'operazione corregge soltanto le cifre del puntatore: tutti gli oggetti, gli stream, le immagini e le annotazioni restano byte per byte quelli dell'originale. L'input non viene modificato.

Prima di offrire il download, il motore controlla che gli offset della xref coincidano con ogni dichiarazione di oggetto fisica (senza oggetti nascosti, duplicati o non indicizzati). Riapre l'originale e la copia con PDF.js per confrontare numero, geometria, testo estraibile e annotazioni di ogni pagina. Riapre inoltre la copia con pdf-lib. Una differenza, un errore o una struttura non riconosciuta determina rifiuto senza output.

Il profilo impone massimo **4 MiB in input/output**, **40 pagine**, **1024 oggetti** e **20 secondi** per un Web Worker dedicato, sempre terminato su completamento, timeout, errore o abort. Sono rifiutati PDF cifrati, firmati, incrementali, linearizzati, xref stream e object stream. Non è un recupero generico di file corrotti e non viene promessa equivalenza pixel per pixel, certificazione Gold o riabilitazione di firme.

La libreria già presente `pdf-lib@1.17.1` (MIT) verifica la riapertura; `pdfjs-dist@6.4.299 (versione dichiarata ^6.4.299)` (Apache-2.0) è il lettore indipendente. **Non** utilizza `pdfstudio` o QPDF WASM, vietati dalla decisione owner #126 (opzione B). Non aggiunge dipendenze né chiama servizi remoti.

Prove sintetiche e ostili in `tests/regroom-str-418.test.ts` e `tests/regroom-str-418-worker.test.ts`; controllo su documento a due pagine e sorgente PDF realmente corrotto tramite `scripts/acceptance-pdf-repair-418.ts` con Poppler `pdfinfo`/`pdftotext`; download della build Astro reale, viewport Chromium 390px, in `scripts/acceptance-pdf-repair-418.browser.mjs`. Le prove di browser non equivalgono a una verifica su dispositivi fisici.

Nessun dato di PDF viene registrato in telemetria; la verifica e il download avvengono nel browser. L'utente dovrebbe conservare l'originale per confronto esterno e considerare il risultato soltanto una correzione strutturale circoscritta.
