# STR-REUSE-55.5 / #279 — QR foto con ZXing

Valutazione del 19-20 ottobre 2026. La branch è stata riallineata
a `origin/main` `5bc81d7dbca67b0249b43e54913e3e9aad42b268`.
**Decisione di distribuzione: BLOCKED / NO_GO fino al gate #126 (STR-366).**
La branch prepara un fallback locale dietro import dinamico e conserva il decoder
attuale. Questa prova non promuove alcun tool a Gold e non certifica la release.

## Provenienza, licenze e distribuzione

- Donor [`@zxing/browser@0.2.1`](https://github.com/zxing-js/browser),
  tag immutabile [`v0.2.1`](https://github.com/zxing-js/browser/releases/tag/v0.2.1),
  commit `9ad027d88d4533bd6d29f9d8d7e517e23cd361ff`, **MIT**,
  tarball `https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz`,
  SRI `sha512-92pVfVDUXbc15xu9vIEmhNyqIEASMEkDF92CwT6T+7sg2EHXJRktH9CQKoQSXe51UtbNsj+Fm09H/JBWHMs/Sw==`.
- Dipendenza runtime `@zxing/library@0.23.0`, **Apache-2.0**,
  tarball `https://registry.npmjs.org/@zxing/library/-/library-0.23.0.tgz`,
  SRI `sha512-6fkkoFwP8CHxl6ugnPsj74PLJgX2iRv5zczGAyt5OBzQgxFhuhF0NCEc4t4OvSr8xAv2MRLlI0Iu9ZGDZQ2urA==`.
- Transitiva `ts-custom-error@3.3.1`, **MIT**,
  tarball `https://registry.npmjs.org/ts-custom-error/-/ts-custom-error-3.3.1.tgz`,
  SRI `sha512-5OX1tzOjxWEgsr/YEUWSuPrQ00deKLh6D7OTWcvNHm12/7QPyRh8SYpyWvA4IZv8H/+GQWQEh/kwo95Q9OVW1A==`.
- Opzionale transitiva `@zxing/text-encoding@0.9.0`,
  **(Unlicense OR Apache-2.0)**, tarball
  `https://registry.npmjs.org/@zxing/text-encoding/-/text-encoding-0.9.0.tgz`,
  SRI `sha512-U/4aVJ2mxI0aDNI8Uq0wEhMgY+u4CNtEb0om3+y3+niDAsoTCOB33UF0sxpzqzdqXLqmvc+vZyAt4O8pPdfkwA==`.
  Il file `LICENSE.md` contiene i due testi e le attribuzioni WHATWG.
- Testi legali copiati **integralmente** dai tarball npm in
  `public/licenses/zxing-279-browser-MIT.txt`,
  `zxing-279-library-Apache-2.0.txt`,
  `zxing-279-ts-custom-error-MIT.txt` e
  `zxing-279-text-encoding-DUAL.txt`. Nessun NOTICE separato,
  WASM, modello, font o asset runtime esterno è stato trovato nei quattro
  pacchetti.
  `package-lock.json` conserva URL e SRI; sono metadati di integrità e **non**
  provano diritti per l'intero prodotto o l'attestazione indipendente di ogni
  asset di #126.

`@zxing/library@0.23.0` dichiara Node `>=24`; l'uso prodotto è browser.
Il 20 ottobre, su MiniPC Node **26.12.0**, i 39 test QR mirati passano.
Il gate `tsx scripts/donor-provenance-366.ts --check`, prima dell'aggiornamento
del parser, riportava `UNKNOWN_LICENSE node_modules/@zxing/text-encoding`.
Il pacchetto dichiara realmente `(Unlicense OR Apache-2.0)`, espressione SPDX
valida; la correzione #126 in PR #362 aggiunge l'identificatore `Unlicense`
al parser. Sul branch riallineato alla sua integrazione in main, il gate
restituisce **`VERIFIED_METADATA` e zero failures**: è una verifica di
metadati e integrità, non una clearance legale complessiva.
Il confronto byte per byte tra i quattro file `public/licenses/zxing-279-*`
e i file LICENSE dei pacchetti npm installati è **4/4 identico**.
La verifica indipendente dei diritti di distribuzione resta distinta dalla
lettura automatica dello SPDX e dai quattro testi legali conservati.

## Confronto dei decoder

Corpus locale indipendente: `qrcode@1.5.4` produce simboli QR L, M, H e
simboli oltre la dimensione supportata dal motore interno; il renderer pixel
è separato da quello del prodotto. Sono inclusi rotazione di 90 gradi,
specchio, skew orizzontale, rumore deterministico, blur 5×5, contrasto
95/170, scala piccola, inversione di colori e rifiuti di bianco/dimensione.
Campione fotografico reale da
[`zxing/zxing` blackbox `qrcode-1/1.png`](https://github.com/zxing/zxing/blob/master/core/src/test/resources/blackbox/qrcode-1/1.png),
640×480, SHA-256
`6908e133d3ce9bdbf3f72bd2c881ea993c6c5d388f8420ac3c87673e2b3f7bd4`,
output associato da `1.txt` verificato byte per byte. Foto testata senza
upload. **48 casi:** letture o rifiuti attesi corretti **15/48 native**
e **48/48 ZXing**. La foto non è decodificabile dal motore nativo
e viene letta da ZXing (EC M).

Misure sullo stesso processo Node/macOS, una passata del corpus: native
**1467,15 ms** di tempo complessivo per chiamata, ZXing **81,8 ms**;
heap occupato a fine prova **19,09 MiB** (non picco allocativo).
Tempi e memoria non sono misure Safari né garanzie di dispositivo.

**Bundle locale prodotto da `npm run build`:** entry
`QrReaderTool` **5.628 B** (gzip **2.439 B**);
adapter ZXing **1.762 B** (gzip **1.017 B**) e due chunk
importati dinamicamente **26.911 + 454.127 B** (gzip
**7.017 + 118.261 B**). L'import lazy non aggiunge questi chunk
alla prima visualizzazione del form; il costo di carico dei due decoder
si manifesta solo al fallback.

## Comportamento adottabile e limiti

La UI carica solo file locali e converte in RGBA. Il decoder nativo è
provato per primo: rimane autorità per QR delle versioni supportate,
controllo sindromi Reed–Solomon, maschera e copie del formato. Solo
`QR_DECODE_FAILED` attiva il lazy import di ZXing. Il fallback accetta
soltanto EC M/Q/H; rifiuta EC L in questa fase, per non mutare il contratto
di rifiuto di moduli L già corrotti. Una successiva estensione EC L richiede
un controllo di correzione verificabile e un nuovo corpus negativo.
Le matrici, l'SVG incollato, gli errori tipizzati e gli input fuori
limite conservano il percorso originale.

L'adapter restituisce un'assenza esplicita (`null`) per maschera, versione
e verifica indipendente non attestabili: la UI mostra avviso anziché
dichiarare una verifica che non è avvenuta. Limite immagine 4 MP e testo
8 KiB, rifiuto di dati RGBA invalidi; abort prima e dopo caricamento
dinamico. Nessuna richiesta di permesso fotocamera, di media stream, di
upload o di rete del decoder. Tutti gli import hanno specifier npm locali;
la modalità Worker non viene attivata, perché questo adapter usa un canvas
DOM su browser principale. Il percorso senza DOM rifiuta esplicitamente
`QR_IMAGE_DECODER_UNAVAILABLE`. Nessuna parità Safari mobile fisica
viene dichiarata senza un consumer Safari reale.

**Verifica browser reale:** il 20 ottobre, Chrome `automation-browser`
esistente sul MiniPC via CDP ha letto un QR indipendente EC M a 390×844
e la fotografia upstream `photo-1.png` (SHA-256 indicato sopra) a
390×844 e 1280×844. In tutti e tre i casi il contenuto atteso è apparso,
con avviso ZXing e metadati non determinati, senza richieste offsite,
POST, errori JS o overflow. Il nuovo chunk `zxing-adapter` è stato
richiesto dopo il submit. Il sito usa
solo import dinamici di script ospitati su `self`, senza `eval`,
camera, worker o chiamate di rete del donor.

La verifica del 20 ottobre con CSP `script-src 'self'` più hash degli
script inline Astro e `connect-src 'none'` ha letto correttamente tutti
e tre gli input; il probe `/api/auth/session` dell'app,
separato dal decoder, è stato bloccato dalla CSP di prova. La CSP senza
gli hash blocca l'idratazione Astro esistente.

## Verifica mobile del 21 ottobre 2026

La decisione owner del 20/10 («basta simulatore ed emulatore») chiude il
criterio Safari mobile sul piano dell'engine, non del dispositivo fisico.
La lane automatica è `scripts/acceptance-qr-reader-279.mjs`
(`npm run acceptance:qr-reader:mobile`), costruita sulla stessa struttura
di `scripts/acceptance-ios-safari-sim-281.mjs`: server statico sul `dist`,
Playwright WebKit **26.6** con profilo `iPhone 17`, ricevuta in
`quality/receipts/ios-safari-simulated-279.json`. La ricevuta dichiara
`evidenceKind: SIMULATED_DESKTOP_WEBKIT_MOBILE` e
`physicalDeviceObserved: false`.

Fixture indipendenti: `quality/fixtures/qr-contract/photo-ecm-279.jpg`
(536×536, EC M, `https://esempio.it/zxing-279-mobile`) e
`photo-lowcontrast-279.jpg` (504×504, EC Q, `STR-279 basso contrasto`),
prodotte da `scripts/generate-qr-279-photo-fixtures.mjs` con l'encoder
indipendente `qrcode@1.5.4` (MIT) e degradazioni fotografiche fatte con
`sharp@` (rotazione, blur, contrasto ridotto, luce non uniforme). Il
manifest `qr-279-photo-manifest.json` ne fissa payload, livello EC e
SHA-256. Il test `tests/qr-zxing-photo-279.test.ts` verifica che il decoder
nativo **rifiuti** entrambe e che il fallback ZXing le legga: la lane
esercita davvero il percorso donor, non il decoder interno.

Esiti WebKit 26.6 (MiniPC, `dist` di questo commit): **7/7 PASS**.

- `iphone17-photo-ecm`: payload esatto, `Livello M`, `Maschera: non
determinata`, `Versione: non determinata dall'immagine`, `Byte UTF-8: 35`,
avviso «Testo riconosciuto dal decoder ZXing» e avviso maschera, zero
richieste offsite, zero richieste non-GET, zero errori JS, overflow 0.
- `iphone17-photo-lowcontrast`: payload esatto a `Livello Q`.
- `viewport-390x844` e `viewport-1280x844`: payload esatto, overflow 0
(regressione 390 px).
- `iphone17-csp-strict`: con `script-src 'self'` più hash degli script
inline e `connect-src 'none'` il decoder funziona e non produce errori.
- `iphone17-refuses-oversized-input`: PNG 2400×1800 (4,32 MP) rifiutato con
«supera il limite di 4 megapixel», nessun payload mostrato.
- `iphone17-refuses-blank-image`: immagine vuota rifiutata con «Non
riconosco un codice QR», nessun payload.

Misure della lane: ai 22 script richiesti dal caricamento non si aggiunge
alcun chunk del decoder; dopo il submit arrivano `zxing-adapter` (1.762 B)
e i due chunk `esm` (26.911 B + 454.127 B). Decodifica misurata 0,45–1,4 s
per caso. Nessun Worker creato (l'adapter usa il canvas del thread
principale) e nessun accesso alla fotocamera. La memoria resta una **stima
di policy** (fixture + RGBA decodificato ≈ 1,17 MB contro il tetto di
16 MB), non un picco misurato: WebKit non espone il picco per scheda. La
cancellazione non ha un controllo nella UI: è coperta dal test unitario
`AbortError` in `tests/qr-zxing-279.test.ts`.

Limiti dichiarati nella ricevuta: WebKit emulato su desktop, non Safari su
dispositivo fisico e non Safari dentro il simulatore iOS. Su questo host
non esiste `Simulator.app` (installazione Xcode 27 senza
`Contents/Developer/Applications`) e SafariDriver 26.6.2 rifiuta la
capability `safari:useSimulator` con `session not created: The 'macOS'
platform is incompatible with requested capability: safari:useSimulator`:
una sessione Safari dentro il simulatore non è quindi pilotabile, e nessuna
parità di dispositivo fisico viene dichiarata.

Safari reale, prova aggiuntiva: `scripts/acceptance-qr-reader-279-safari.mjs`
guida **Safari.app 26.6.2** del Mac Studio via SafariDriver
(`safaridriver --enable`) sul `dist` servito in locale, finestra 390×844.
Entrambe le foto sono state lette: payload esatto, `Livello M` e `Livello Q`,
`Maschera: non determinata`, i due avvisi, chunk `zxing-adapter` richiesto
solo dopo il submit, zero richieste offsite, overflow 0, 0,26–0,83 s.
Ricevuta `quality/receipts/safari-webdriver-279.json`, schermate
`safari-279-qr-reader-390.png` e `safari-279-qr-reader-390-lowcontrast.png`.
Due limiti sono registrati nella ricevuta: è Safari desktop in una finestra
da 390 px e non iOS; e l'iniezione file nativa di SafariDriver produce un
file che la pagina non riesce a leggere (`arrayBuffer` →
`NotReadableError`, `createImageBitmap` → `InvalidStateError`), per cui gli
stessi byte della fixture vengono allegati con `DataTransfer` dopo aver
verificato **in pagina** il loro SHA-256 contro il manifest. Con byte
illeggibili la UI mostra un errore tipizzato e nessun risultato: nessuna
lettura inventata.

**Gate di ammissione (riverificato il 21 ottobre su `main`
`9609c01b95bb1f9f75f7672056569dd863ecf273`):**
`tsx scripts/donor-provenance-366.ts --check` restituisce
`VERIFIED_METADATA` con zero failures; i quattro testi legali installati
coincidono **byte per byte** con `public/licenses/zxing-279-*` (4/4); la
suite QR mirata passa **42/42** e `npm run build` produce 309 pagine con
`build inspection PASS`. L'[issue #126](https://github.com/domenicomassafra/strumentini-it/issues/126)
resta aperta per altri donor (heic-to, mediabunny, PDFStudio/QPDF) e non
per questo pacchetto: il gate QR-specifico è soddisfatto, mentre la
clearance legale complessiva del prodotto non è oggetto di questo ticket.
Nessuna promozione Gold, nessuna ammissione di release e nessun deploy:
restano i gate separati.
Rollback:
rimuovere l'import e l'adapter `zxing-adapter.ts`, le due dipendenze dirette
e i loro testi legali; `decodeQrFromRaster` è preservato.
