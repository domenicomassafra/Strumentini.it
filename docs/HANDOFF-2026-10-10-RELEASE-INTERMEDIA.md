# Strumentini.it — MEGA HANDOFF / RELEASE INTERMEDIA

**Snapshot:** 2026-10-10 (Europe/Rome). **Destinatari:** release owner, nuovo agente tecnico e revisore strategico.

**Repository:** `/Users/domenico/Code/Strumentini.it`; GitHub `domenicomassafra/strumentini-it`; ramo canonico `main`.
**Scopo:** fermare la lavorazione corrente, consegnare un prodotto utilizzabile nel perimetro già certificato, consentire un *grilling* serio su direzione, architettura, dipendenze, donor e costi. **Non è un certificato di nuova release in produzione.**

## 1. Dieci righe per decidere subito

1. Il progetto funziona: sito Astro statico/client-side, catalogo e moltissime utility già operative; non serve riscriverlo né aprire altre decine di ticket per pubblicare il perimetro sicuro.
2. Il backlog verificato è **327 ticket / 284 completati / 43 aperti**. Dei completati, **17 sono rifiuti espliciti**, non funzionalità spedite. Non confondere quantità di ticket chiusi con percentuale di prodotto rilasciato.
3. Gli aperti sono **5 pronti per un agente**, **31 dipendenti**, **2 in attesa di fonti ufficiali** e **5 in attesa di prove su dispositivi fisici**. Il grafo ha 12 ticket numericamente pronti, ma solo 5 realmente assegnabili dopo i gate esterni.
4. Il collo di bottiglia non è principalmente il coding: è aver trasformato *tutte* le combinazioni dei formati e *tutti* i dispositivi in condizioni di chiusura della piattaforma. Necessario ridurre perimetro di rilascio, non ridurre i controlli di sicurezza.
5. **#047:** la compressione PNG pubblica ora distingue IDAT pixel-lossless, palette esatta e palette RGB approssimata (alpha preservato); il **solo AC PNG** è chiuso. JPEG esperto, WebP lossless/effort e SVG optimizer restano fuori portata verificata.
6. **#056:** conversione printable TXT/Markdown/HTML/CSV funziona entro limiti; conversioni ricche DOCX/XLSX/PPTX sono intenzionalmente rifiutate finché mancano renderer e fidelity corpus. Non chiamarle supportate.
7. **#212:** migliorata la sola estrazione del primo fotogramma GIF, con frame parziali trasparenti e interlacciati; HEIC reale da iPhone e encoding/animazione continuano non promossi.
8. **#237:** export raster-only con cancellazione di oggetti sorgenti e prova byte integrale migliorato; test reale con file ostile nascosto/orfano, pypdf/pdfminer/PDF.js/PDFKit print/copy superati. **Sicurezza e mobile non ancora certificate**: interfaccia esposta solo in DEV, non nel catalogo/build di produzione.
9. **Non promuovere Gold né ridurre i gate con una modifica al ticket.** Pubblicare semmai il subset attuale confermato; separare `shipped`, `refused`, `prototype`, `physical-NOT_RUN`.
10. Prossima decisione corretta: **congelare roadmap e fare 1 sessione di grilling 45–60 minuti**, poi selezionare *al massimo 2* dipendenze che sbloccano famiglie significative; non ripartire con quattro agenti implementatori senza una decisione di prodotto.

## 2. Stato effettivo e prove replicabili

### Architettura e limiti

- Astro static build, Preact per UI interattiva, TypeScript; Vite per bundling. Elaborazione privilegiata nel browser, lazy heavy codecs/worker; Cloudflare/static hosting dove possibile; nessun obbligo di inviare documenti dell'utente a server.
- `src/engines/` contiene i motori, `src/components/tools/` le UI, `src/tools/` manifest/catalogo, `src/pages/tools/` le route. `src/release/preview-boundary.ts` tiene fuori le route sperimentali dal catalogo pubblico.
- Contratti forti: MIME reale/signature, bounded memory, abort/cancel, verifica dell'artefatto esportato, trasparenza su perdita e metadati, **refusal fail-closed**. `quality/` e test/fixture sono fonti delle prove, non decorazioni.
- Vedere `docs/00-product-vision.md`, `docs/04-decision-history.md`, `docs/06-go-to-market.md`: la direzione storica non è un generico clone di 200 tool, ma un workspace utile con proposta riconoscibile. **Riconsiderare il divario** tra tesi di prodotto e proliferazione dei codec.

### QA misurata nel ciclo 10 ottobre

- `npm run check`: **1.949 file Astro/TS, 0 errori, 0 warning, 22 hint non bloccanti**; log `/tmp/stru-integrated-check3.log` (non versionato).
- `npm run build`: **291 pagine statiche**, `inspect-build PASS`, **269 voci catalogo**, **284 sitemap entries**; asset JS e route gate verificate in `/tmp/stru-integrated-build3.log` (non versionato). Route pubblica `pdf-true-redaction-237` **ASSENTE**.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **233 suite / 1.791 test PASS anche nella riesecuzione finale successiva al fix PDF `/Parent`**, log `/tmp/stru-final-owner-tests-20261010.log`, **76,83 secondi**. Lo stesso ciclo ha ripetuto `npm run check` 0 errori e `npm run build` 291 pagine. Sono prove sul checkout integrato appena prima del commit finale; un futuro deploy deve comunque legare il gate al nuovo SHA e rieseguire le verifiche pertinenti.
- `scripts/acceptance-image-idat-public-47.browser.mjs`: **40/40** su Chromium + WebKit desktop viewport 390 px (PNG IDAT, palette exact/lossy, veri download, verifiche Sharp di byte/alpha/errore, no offsite/error/overflow).
- `scripts/acceptance-image-directional-212.browser.mjs`: **102/102** su Chromium, Firefox, WebKit desktop viewport 390 px. Nota controprova: il decoder GIF nativo Firefox interpreta diversamente un offset di frame; il PNG canonico coincide con Sharp/Pillow, ma NON si dichiara identità con il GIF nativo Firefox.
- `scripts/acceptance-pdf-redaction-237-dev.browser.mjs`: reali UI/upload/scelta regione/download DEV; due PDF scaricati incluso `covered-orphan-237.pdf` con testo privato coperto e oggetto orfano. Output riaperto con **PDF.js, pypdf, pdfminer.six e macOS PDFKit/CoreGraphics** (copia, anteprima, stampa su PDF, riapertura), nero nei pixel selezionati, testo originale non recuperabile; file corrotto rifiutato, nessuna richiesta offsite, browser 390 px. È **un subset desktop**, NON prova generale/physical mobile.
- I test diretti dal proprio ambiente, la certificazione storica, la build distribuita e la produzione sono quattro concetti distinti. **Nessun nuovo deploy o Gold implicato dal presente handoff.**

### Gate di release globale: **BLOCKED, nonostante test/build PASS**

`npm run deploy:check:portable` ha dato **PASS**: 1.693 file statically portable, nessun runtime server. `tsx scripts/validate-release.ts` restituisce un JSON `status:"BLOCKED"` con **8 blocker** (il comando termina comunque con exit 0: leggere il campo `status`, non il solo exit code). Situazione osservata prima del commit finale:

1. Browser performance receipt source **stale**.
2. **10 tool** senza certificazione receipt.
3. **2 tool** con certificazione diversa da Gold.
4. **259 tool** con Gold receipt source **stale**.
5. Mancano prove Android Chrome **fisico** per image-resize.
6. Mancano prove iOS Safari **fisico** per image-resize.
7. Rollback receipt verified **stale**.
8. Al momento del controllo l'albero Git era **dirty** (il successivo commit pulisce solo quest'ultimo, non gli altri sette).

**Red flag architetturale #1 da sottoporre a grilling:** `scripts/lib/current-revision.ts::currentEvidenceSourceFingerprint()` calcola un unico SHA-256 su **tutti** i file `src/`, `scripts/`, `tests/`, `public/`, fixture/oracle e config; `src/release/validation.ts::validateGoldReceipts()` confronta **ogni** receipt Gold con questo fingerprint globale. Di conseguenza **modificare un test o una utility può invalidare le attestazioni di centinaia di utility NON modificate**. Questo spiega i **259 receipt stale** in una singola tornata e perché ogni avanzamento incrementale sembra richiedere una ricertificazione di massa. È un controllo fail-closed deliberato, ma probabilmente **a granularità sproporzionata** per 269 tool indipendenti. Il prossimo agente deve progettare una migrazione verificabile a **fingerprint per tool + sue dipendenze transitive + un gate integrato di release** mantenendo firme, controllo dei confini, prove browser e receipt storici; **non** disattivare la verifica né rietichettare i vecchi 259 receipt in automatico. Serve revisione del modello di certificazione, NON un refresh cosmetico.

## 3. Modifiche consegnate in questo batch (non ampliare senza consenso di release)

| Ticket | Miglioramento reale | Chiusura attestabile | Rimanente |
|---|---|---|---|
| **#047 compressione** | PNG palette strict `PLTE/tRNS`, exact o lossy RGB (errore <=32/255), alpha per pixel esatto, byte accounting; integrato nella pagina pubblica, separato da PNG IDAT | **AC PNG completato, ticket OPEN** | JPEG native expert, WebP real lossless/effort, SVG multipass/preview, dispositivi fisici |
| **#056 printable/Office** | Corpus Office OOXML autentico con tabelle, link, chart e immagini; descrizioni di mancata fedeltà per formato; rifiuto DOCX/XLSX/PPTX prima della lettura | **OPEN** | Fidelity/page-layout output ricchi, approvazione donor, mobile; route printable #256 già completata separatamente |
| **#212 GIF/AVIF/HEIC** | Primo fotogramma GIF offset trasparente, interlace, canvas logico e alpha; dimostrato con Sharp e Pillow e 3 browser | **OPEN** | Foto HEIC reale da iPhone, test fisici, scelte su animazione/encoding AVIF, gate #268 |
| **#237 redazione PDF** | Verifier non ammette byte sorgenti recuperabili tra `startxref` ed EOF; PDF writer ora include `/Parent` pagina necessario a PDFKit; DEV-only UI e prove indipendenti | **OPEN, NON PUBBLICO** | Copertura malevola più ampia e reale, dispositivi fisici, revisione sicurezza formale |

**Integrazione #047:** `src/engines/image/png-palette-lossy-47.ts`, `src/engines/image/visual-tools.ts`, `ImageVisualTool.tsx`, `ImageResultV2.tsx`; non cambiare a caso logica target/qualità di altri formati. Nella palette approssimata solo RGB varia; trasparenza/alpha deve rimanere identico. Niente codifiche nascoste e niente metadata falsamente preservati.

**Integrazione #237:** `src/engines/pdf/secure-raster-redaction-237.ts`, `PdfSecureRedaction237Tool.tsx`, `src/pages/tools/pdf-true-redaction-237/[...route].astro`, `src/release/preview-boundary.ts` e check release. **Il PDF originale non viene copiato nell'output; si crea un PDF nuovo con soli Flate RGB raster**; questo elimina anche testo selezionabile, collegamenti, metadata e caratteristiche vettoriali *in tutte le pagine*. Il modello input supportato è ristretto a <=4 pagine, <=8 MiB e max 12 rettangoli; i PDF firmati, crittografati, incrementali/ibridi, annotati o complessi vengono rifiutati. Il canale sperimentale **DEVE** restare DEV/noindex/non-prerender e fuori catalogo, finché l'approvazione di sicurezza non è completa.

**Tre difetti veri trovati col RED->GREEN nel ciclo:**

1. Verifier PDF accettava byte segreti extra non nel grafo parser (risolto con confronto byte-per-byte del PDF canonico completo).
2. PDF esportato raster strutturalmente aperto da alcuni parser ma incompatibile con PDFKit/CoreGraphics perché pagina senza `/Parent` (risolto; chiudere in regression test).
3. Parser GIF primo frame non ricompositava offset trasparente/interlacciato sul logical canvas (risolto su subset testato; Firefox mostra divergenza propria del decoder nativo).

### What NOT to do

- Niente `merge -s ours` come finto merge di codice vecchio; niente cherry-pick alla cieca di branch del giorno precedente sopra `main` moderno.
- Niente certificazione `Gold` con viewport emulato al posto di iOS/Android reali; niente screenshot/fake receipt.
- Niente `PDF` coperto con rettangolo opaco presentato come *secure redaction*; niente autocomplete silent sui formati non supportati.
- Niente conversione DOCX/XLSX/PPTX spacciata per page-faithful senza confronto con rendering originario.
- Niente nuove dipendenze WASM da CDN runtime o licenze ignote prima dell'audit e del test `offline/static`.

## 4. Backlog residuo — dove tagliare dipendenze invece di creare lavori

**Source of truth:** `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md`; ogni checklist e gate nell'`issues/<numero>-*.md` corrispondente. `npm run tickets:check` deve rispondere con 0 mismatch. **43 OPEN = 5 READY + 31 dependency + 2 source + 5 device.**

### 5 esplorabili, non automaticamente chiudibili

- **#047**: AC PNG accettato; JPEG/WebP/SVG advanced dipendono da scelta codec/donor, IP/licenza/bundle/wasm e verifiche.
- **#056**: Office fidelity ancora negata esplicitamente; può chiudere *come rifiuto motivato* solo previa decisione di prodotto e modifica esplicita del criterio originario, NON per aver soltanto testato le refusals.
- **#212**: source GIF first-frame migliorato; richiede un originale HEIC realmente prodotto da iPhone + scelta su GIF animation vs still-only. Dipende #049/#235.
- **#237**: richiede security scope/coverage reale, revisore e mobile; blocca #032.
- **#246**: OCR locale reale già progredito (#247 in DEV), ma hardware iOS/Android, performance WASM, accuratezza/fiducia e policy OCR nei PDF rimangono insufficienti; blocca #031/#247.

### 31 bloccati da dipendenze interne (macro-catene)

| Radice | Ticket downstream | Diagnosi / scelta consigliata |
|---|---|---|
| **#115 fonti amministrative** | #121→#122→#008→#018, #158, #046 | Serve storico ufficiale consolidato di codici comuni/Stati esteri, verificabile e con periodo di validità. Non inventare record mancanti. |
| **#117 fonti fiscali annuali** | #126→#011; #127→#128→#012/#130→#013/#135; #133→#014; #134→#015; #152→#040; #158/#062/#018/#046 | È la catena più costosa: regole IVA, IRPEF, forfettario, TFR e ISTAT versionate per anno. Prima decidere quali calcoli sono realmente indispensabili al lancio. |
| **#047/#212** | #028, #049, #235→#058 | I formati specialistici rendono periferiche molte famiglie; pubblicare conversioni supportate e marcare le altre non disponibili. |
| **#056** | #024 | Office convert rich non approvato; modulo printable semplice già operativo. |
| **#246** | #247→#031 | OCR PDF sperimentale; non certificare fino a prove fisiche e qualità. |
| **#237** | #032 | Sicurezza PDF non è un badge da assegnare dopo una sola fixture. |
| **#229 microfono fisico** | #035 | Autorizzazioni/audio recording: necessario device reale. |
| **#277/#278** | #279→#046 | Resize Gold Android/iOS richiede ricevute device reali. |
| **#280/#281** | #046 | Ultimi gate heavy-tool real hardware, non desktop viewport. |

**Altri ticket dipendenti già presenti nel dashboard, NON smarriti:** #008, #011, #012, #013, #014, #015, #018, #024, #028, #031, #032, #035, #040, #046, #049, #058, #062, #121, #122, #126, #127, #128, #130, #133, #134, #135, #152, #158, #235, #247, #279. Questo è tutto il gruppo da 31; non crearli nuovamente.

### Gate esterni non risolvibili con simulazioni

- **#115:** copertura e storicità ufficiale codici amministrativi; **#117:** fonti fiscali aggiornate, approvate e ancorate all'anno.
- **#229:** microfono vero; **#277/#280:** Android Chrome vero; **#278/#281:** Safari iOS vero e Web Inspector/picker/memoria.
- Un simulatore iOS può aiutare il debug, ma non sostituisce le prove hardware richieste dal contratto corrente. Il Mac Studio ha mostrato picchi di load >200–400 con processi di simulatori; non rilanciare più matrici Chromium/WebKit/Firefox simultanee e non uccidere processi di altri agenti.

## 5. Perché l'avanzamento ha rallentato: diagnosi critica

**Non è corretto dire soltanto che "sono rimasti 43 ticket".** L'effetto blocco nasce da una combinazione misurabile:

1. **Acceptance troppo ampia per il prodotto minimo**: #047 chiede quattro encoder/famiglie approfondite; #056 chiede fedeltà reale di tre suite Office; #212 include HEIC, AVIF e GIF animato. Ogni sottofeature richiede tecnologia, QA e fixture diverse. Un ticket rimane aperto anche dopo settimane di miglioramenti autentici.
2. **Sicurezza confusa con ambizione di catalogo**: #237 non deve andare live senza audit; tuttavia il suo blocco non deve arrestare altri tool sicuri.
3. **Refusal come chiusura tecnica ma non di valore**: 17 DONE sono rifiuti consapevoli (molti formati particolari). Metrica ticket chiusi può nascondere promesse al pubblico non mantenute.
4. **Matrice QA con costi lineari e macchina satura**: browser triplicati, molti worktree storici, database di fixture, `npm test` e build ripetuti dopo ogni microvariazione. Fare suite completa per *batch*, target test per singola modifica.
5. **Fidelity semantica a mano**: ricostruire da zero il rendering Office, encoder WebP/AVIF e security PDF è troppo costoso rispetto al test di donor credibili già pronti.
6. **Indecisione sul primo utente e primo impiego**: una directory di 269 tool è tecnicamente imponente ma non sostituisce motivo di tornare, acquisizione organica misurabile, 1–3 workflow distintivi e monetizzazione/distribuzione.

**Correzione proposta:** due roadmap separate. **A. Pubblico MVP attuale** = soli tool con accettazione dimostrata, SEO/UX/onboarding, metriche aggregate *senza file o contenuti utente*, primi utenti; nessuna richiesta di completare tutti i 327 ticket. **B. R&D specialistico** = plugin codec, Office, redaction e calcolatori fiscali, con gate espliciti e decisione di continuare/abbandonare dopo benchmark. Evitare che B trattenga A.

## 6. Donor/fork da valutare *prima* di scrivere altro codice

Ricognizione pubblica del 10 ottobre 2026, **non** audit finale di licenze/transitive deps, dimensioni o vulnerabilità. Classifica per potenziale impatto e condizioni:

| Priorità | Donor | Perché può far risparmiare | Limiti/gate prima di adottarlo |
|---|---|---|---|
| **P0** | **jSquash** https://github.com/jamsinclair/jSquash | Moduli WASM browser/worker con `@jsquash/jpeg` (MozJPEG), `@jsquash/webp` (libwebp), `@jsquash/avif`, `@jsquash/oxipng`, PNG. Molto più diretto di fare encoder manuali; potrebbe sbloccare #047 e parte #212. Codice Apache-2.0. | Dimostrare WebP *vero* lossless/effort, qualità e alpha; Vite/Web Workers, WASM lazy/offline, CSP, memoria e bundle; verificare licenze proprie di codec e patent policy. Non presumere che supporti animated HEIC/GIF. |
| **P0 da spike** | **Libre Convert** https://github.com/Rhgx/libre-convert | Progetto MIT che usa LibreOffice WASM tramite ZetaOffice per convertire DOCX/XLSX/PPTX in PDF localmente. Potenziale shortcut di #056, invece del renderer da zero. | **Wrapper MIT ≠ runtime incluso liberamente**: runtime ZetaOffice caricato da fonte terza con licenza separata. Richiede cross-origin isolation/SharedArrayBuffer e cache/asset pesanti; test static Cloudflare, CSP, privacy/offline, resa Office, dipendenza runtime/CDN, legalità commerciale. Repo piccolo (~1 star al momento dell'audit): riferimento architetturale, NON donor approvato. |
| **P1** | **MuPDF.js** https://github.com/ArtifexSoftware/mupdf.js | Motore PDF WASM completo; può eliminare alcune classi di parsing/rendering manuale e migliorare #237/altre manipolazioni. | **AGPL v3 oppure licenza commerciale**: incompatibile con distribuzione proprietaria chiusa senza valutazione legale. Non assumere che rasterizzazione equivalga a redaction certificata. Prova tecnica isolata, NO integrazione diretta. |
| **P1** | **Squoosh** https://github.com/GoogleChromeLabs/squoosh | Architettura client-side e comparazione encoder/preview; riferimento storico per UX/corpus e worker, codice Apache-2.0. | Preferire i codec mantenuti jSquash piuttosto che forkare l'intera UI; verificare mantenimento attuale, compatibilità e assets. |
| **P2** | **libheif** https://github.com/strukturag/libheif | Base codec HEIC/AVIF con metadata/orientamento e decode multipiattaforma; parte già esiste via `heic-to` nel progetto. | LGPL e codec/plugin/HEVC patent licensing da valutare; memory/performance real iPhone; non introdurre doppio runtime dove `heic-to` è sufficiente. |
| **Già presente** | `svgo@4.1.0`, `fflate@0.8.3`, `pdfjs-dist`, `heic-to` | Usare davvero le dipendenze installate prima di costruire nuovi decoder/parser. `svgo` per #047 SVG solo se il contratto original-vs-output DOM/render è dimostrato; `fflate` già usato per PNG. | `svgo` minimizza AST ma potrebbe cambiare resa/font/precisione; `pdfjs-dist` rende/legge PDF, NON è un motore sicuro di redaction modificativa. |

**Decisione R&D raccomandata:** un agente fa **solo spike jSquash (JPEG+WebP lossless)** e un altro **solo spike Libre Convert/ZetaOffice** su corpus verificato, con budget di tempo predeterminato e criteri `go/no-go`: non integrare nessuno dei due prima di misurare byte WASM, funzionalità realmente supportate, licenza, rete/offline e conversione reale. Se falliscono, limitare promessa pubblica e chiudere l'ambizione del formato con refusal approvata.

## 7. Git, worktree e responsabilità dopo consolidamento

- I worktree datati **2026-10-09** non sono prove di 14 nuove funzionalità mancanti: nel confronto *per file* con `main` molte versioni commit erano **byte-identiche**; le differenze riguardavano soprattutto testo ticket e implementazioni **più recenti** in `main`.
- Audit dei branch: `prime/str-231-varispeed-20261009` (8b1d0bf), `worker/str-037-pts-seek-20261009` (b83bba6), `worker/str-059-adversarial-corpus-20261009` (baa568f), `worker/str-059-browser-20261009` (279fad9), `worker/str-218-mixed-image-masks-20261009` (82bb41d), `worker/str-231-dsp-20261009-b` (def4e7a), `worker/str-234-transform-bounds-20261009` (fb7dd58), `worker/str-236-rotated-browser-20261009` (e3dd8a7), `worker/str-237-malicious-corpus-20261009` (ee05889), `worker/str-241-visual-ui-20261009` (8edb320), `worker/str-246-ocr-evidence-20261009` (a539a10); in più `sprint/str-232-video` (59a2db6), `worker/str-231-audio-timeline-20261009` (571b82e) e detached clean-QA `a25dbf1`.
- **Verifica senza falsi merge**: questi vecchi SHA erano perlopiù *non ancestor* di `main`, ma il contenuto era stato integrato separatamente e/o sostituito. Una strategia `ours` per renderli formalmente merged sarebbe fuorviante; evitare anche di sovrascrivere file più recenti solo per livellare l'ascendenza.
- `git status -sb`, `git worktree list`, `git branch -vv`, `git stash list`, `git rev-list --left-right --count origin/main...main` sono i comandi base. La pulizia e la loro eventuale rimozione sono responsabilità dell'owner che verifica diritti e file non tracciati; non eliminare sessioni attive di altri progetti.
- **Unica fonte canonica operativa:** `main` + registro ticket; non riprendere il lavoro da un vecchio checkout solo perché il suo commit sembra "non merged".

## 8. I prossimi 7 passi per l'agente che riceve il passaggio

1. **Leggi questo handoff prima di aprire issue nuove.** Conferma commit `main`, albero pulito, stato `origin/main`, `CURRENT-TICKET-DASHBOARD.md` e storia di rilascio/cloudflare. Non usare metriche di ieri come di oggi.
2. **Controlla confine pubblico**: `/tools/image-compression/` palette exact/lossy scarica realmente; `/tools/pdf-true-redaction-237/` NON esiste nella `dist` di produzione; no Gold fittizi e nessuna richiesta remota contenente file.
3. **Triaging sulle radici**: decidi fra #115/#117 (fonti ufficiali), #246 (OCR qualità/mobile), #047 (jSquash), #056 (Libre Convert gate), #212 (iPhone HEIC), #237 (security). Massimo due iniziative insieme e una deve poter generare beneficio verificabile al lancio.
4. **Arriva a un sito utilizzabile**: pagine chiare, route attive, errori comprensibili, `tools` performanti e privacy, click reali, feedback utente; non trattenere deploy sicuro finché non sono completati Android/iOS per funzioni non ancora promosse.
5. **Verifica 2 donor in sandbox isolata**, senza sostituire motori pubblici finché il benchmark non vince con legalità, byte, runtime/worker, memoria, pixel/fidelity.
6. **Grilling prodotto**: chiedi quale segmento/3 workflow risolve problemi ripetuti, metriche prima di scrivere altro codice, quale differenziazione rispetto a strumenti già gratuiti, quanto budget e manutenzione giustificano fiscal source annuali o formati avanzati.
7. **Fai release go/no-go** separatamente da backlog. Se il subset attuale è sicuro, privilegia pubblicazione/uso reale. Registra ciò che non pubblicherai, anziché riaprire esperimenti.

### Prompt pronto per il prossimo agente

> Sei il nuovo release owner/revisore strategico di Strumentini.it. Leggi integralmente `docs/HANDOFF-2026-10-10-RELEASE-INTERMEDIA.md`, il registro ticket e la storia release. Verifica con Git lo stato reale, non credere a test non riprodotti. Valuta se siamo andati fuori strada costruendo troppi tool e test, proponi cambi di scope e fai grilling sul primo utente/uso/lancio. Controlla jSquash e Libre Convert come donor con attenzione a licenze e dispositivi reali. NON modificare produzione, Gold, fonti fiscali, WIP altrui o ticket senza prove e autorizzazione specifica. Consegna decisione go/no-go in tre perimetri (pubblico già pronto, prototipi, rifiuti), una roadmap di 2 settimane **massimo 5 risultati**, i ticket originali che sblocchi e quelli che puoi consapevolmente non fare.

**Conclusione:** il prodotto è **tecnicamente consistente**, ma la traiettoria è stata troppo orientata a completare matrici perfette prima di verificare utilità, visibilità e valore. **Non servono altri 100 ticket**. Serve una decisione sulla promessa pubblica e una selezione stretta di 1–2 donor/verticali con alto rapporto valore/costo, senza indebolire la sicurezza.
