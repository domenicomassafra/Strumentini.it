# Strumentini.it — pending verificati e sessione di grilling per il prossimo agente

## Sessione attiva — rivalutazione indipendente consegnata

**Checkpoint finale del grilling:** l'owner ha confermato le otto decisioni finali e dato `go` alla preparazione del pacchetto. L'intesa di prodotto è confermata; il progetto e il redesign non sono completati. Il prossimo incarico è **solo ticket/spec/roadmap/prompt**, con quattro subagenti nativi Chat On Steroids; autorizzata la creazione e revisione dei ticket nel prossimo incarico. Leggere prima [l'handoff decisionale finale](HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md). Il nuovo prompt di lancio è `tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/lane-01-coordinator/001-strumentini-ticket-finalization.prompt.md`; i vecchi prompt audit/grilling restano documentazione storica, non una richiesta di ricominciare il questionario.

Il nuovo [audit indipendente](AUDIT-INDIPENDENTE-STRUMENTINI-2026-10-10.md), con [prove](audit-2026-10-10/README.md) e [triage dei 43 originali](audit-2026-10-10/ticket-triage.md), è il checkpoint della fase A. Non modifica authority di prodotto/design, ticket o produzione. Il mandato complessivo resta aperto; nuovo sviluppo non autorizzato.

**Fase B conclusa con `plan-grill-with-docs`, `plan-grilling`, `plan-domain-modeling`. Tre round risposti; intesa confermata dall'owner e successivo `go`.** Le risposte del round 1 aggiornano il mandato come segue:

- **Prodotto e pubblico:** strumenti usati ogni giorno o settimana da chi lavora al computer, soprattutto in ufficio, utili anche alle persone comuni. Esperienza personale riportata: compressione, divisione, eliminazione pagine e modifica PDF; conversioni immagini/PDF; modifiche rapide alle immagini. Sono esempi di domanda, non una lista esaustiva o un ordine definitivo di priorità. Codice fiscale citato come utility utile anche fuori dall'ufficio.
- **Ambizione:** disponibilità a investire molto e a parallelizzare il lavoro; token considerati quasi illimitati. Non chiedere nuovamente un budget token. Questo non equivale ad autorizzazione a sostenere spese esterne o ad acquistare licenze.
- **Design:** redesign completo, riconoscibile, con componenti e interazioni curate. Insoddisfazione esplicita per l'esperienza statica e generica. Effetti e sound design da valutare in base all'utilità, non già richiesti come funzionalità obbligatorie.
- **Distribuzione del codice:** prodotto chiuso/proprietario, salvo necessità concreta da discutere. Non proporre open source come default né adottare licenze incompatibili assumendo un cambio di questo vincolo.
- **Nuovo deliverable richiesto:** dopo le risposte finali, preparare un handoff e un prompt definitivo per un altro agente con quattro subagenti nativi. Deve coprire revisione/aggiornamento dei ticket esistenti, ticket mancanti e futuri pertinenti, prompt di esecuzione e miglioramento completo. La precedente proibizione di nuovi ticket non impedisce questa futura attività esplicitamente richiesta; in questa sessione si raccolgono ancora le decisioni. Nessun ticket nuovo aperto ora.
- **Confini inizialmente aperti, ora risolti nel round 2 sotto:** mandato limitato al pacchetto di pianificazione/ticket; ChatGPT con Chat On Steroids. Non inferire autorizzazione a implementare o rilasciare dalla richiesta di un mega prompt.

L'ipotesi dell'audit di un nucleo da 10–30 strumenti e di un workspace focalizzato su consegne freelance **non è una decisione dell'owner**. Non usarla per restringere il catalogo o de-scopare ticket. Mantenere le prove e le proposte dell'audit distinguendole dalle scelte confermate. Primo glossario di termini confermati in `CONTEXT.md`; nessun nuovo ADR prima di un trade-off significativo risolto.

### Round 2 — decisioni ricevute, non riaprire le domande già risolte

- **Q1 — Compito unico del prossimo agente:** accettata la raccomandazione di produrre/aggiornare ticket, roadmap, specifiche e prompt, senza implementazione applicativa. Copertura di tutti i ticket presenti e dei futuri pertinenti alle risposte, non soltanto dei 43 aperti. Pianificare il completamento del prodotto non equivale a dichiararlo già completato.
- **Q2 — Trasporto e delega:** l'owner lancerà personalmente su ChatGPT il prompt completo preparato con Prompt2Prompt; l'agente destinatario dovrà usare **Chat On Steroids** per **quattro subagenti nativi** e le skill pertinenti. Non chiedere di nuovo piattaforma o modelli. Prompt2Prompt riguarda il solo handoff esterno; i quattro specialisti usano task/messaggi/risultati nativi, non quattro nuovi handoff manuali. La preparazione del prompt non autorizza questo agente a lanciarlo al posto dell'owner.
- **Q3/Q4 — Utilità e ambizione:** priorità ampia a PDF, Excel/CSV, oscuramento dati, preparazione immagini ed estrazione testo. Nel tempo l'editor immagini dovrebbe avvicinarsi alle capacità di Photoshop e l'editor PDF a un editor PDF professionale completo sul web. Sono riferimenti di capacità, non istruzioni di copia del marchio o una promessa di parità già verificata. Richiesti livelli/ticket **base** e **avanzati futuri**; il confine operativo del livello base è nella frontier finale.
- **Donor-first:** sfruttare fortemente implementazioni esistenti, fork e adattamenti per accelerare, anziché riscrivere ogni motore. L'esempio di 2.000 strumenti/repository esprime ambizione, non un numero minimo obbligatorio di ticket. Verificare diritti di riuso, licenze transitive e mantenibilità; preservare il vincolo proprietario. Distinguere riuso consentito, licenza commerciale e sviluppo autonomo del comportamento richiesto; non trattare repository visibile o reverse engineering come autorizzazione implicita a copiare sorgente chiuso.
- **Q5/Q6 — Catalogo e ingresso:** accettata selezione principale curata con catalogo completo ricercabile. Doppio ingresso per scelta dello strumento o file trascinato; azioni suggerite in base al tipo di file (PDF: compressione, unione, pagine, conversioni; immagini: azioni pertinenti). Accettate operazioni consecutive sul risultato. Interesse a suggerimenti personalizzati; grado di personalizzazione nella frontier finale.
- **Q7 — Memoria:** interesse a cronologia operazioni e risultati riscaricabili per un periodo; dettagli ancora aperti. Preferenza per gratuità e assenza di costi aggiuntivi di database. Non trasformare questa risposta in consenso a un archivio cloud o a conservazione automatica dei documenti.
- **Q8 — Server:** consentita in principio una modalità server **se gratuita**, dichiarata chiaramente per quello strumento. L'esaurimento del servizio gratuito e il ciclo di vita dei file vanno specificati, non assunti. Nessun upload silenzioso, servizio oneroso o spesa autorizzati da questa risposta.
- **Q9 — Fiscalità italiana:** investimento forte, anche tramite donor. La proposta di sospendere la fiscalità ampia dell'audit non è stata adottata. Il riuso del codice non sostituisce prove di fonti ufficiali, annualità e completezza dei calcoli. Normativa e utility italiane fanno parte della roadmap.
- **Q10 — Business:** inizialmente soprattutto personal brand e utilità gratuita, senza modello economico obbligatorio. Pubblicità possibile; pagamento/donazioni futuri da valutare. Non introdurre paywall, tracking pubblicitario o donazioni come decisioni già approvate.
- **Q11 — Design:** direzione ancora da scegliere in seguito, eventualmente tramite modelli/immagini. Preparare ticket per tre alternative realmente diverse e successiva selezione; non inventare palette, font o approvazione visiva. Questo punto aperto non impedisce la consegna di ticket sul redesign, sulle invarianti e sulla discovery.
- **Q12 — Movimento/suono:** desiderati entrambi; accettata la raccomandazione di interazioni curate e funzionali, effetti espressivi pertinenti, suono disattivato di default e attivabile. Preservare reduced-motion/accessibilità.
- **Q13 — Licenze/costi:** accettata valutazione anche di motori commerciali tramite proposta concreta con costo, beneficio e alternative; nessun acquisto implicito.

### Round finale — risposte confermate

- **Q1:** base affidabile e completa nelle operazioni dichiarate; editor professionali e automazioni complesse nell'avanzato. Nessuna acceptance storica eliminata per rendere verde il base.
- **Q2:** editor PDF avanzato prioritario, poi immagini; dati/Excel/CSV crescono attraverso operazioni e automazioni utili.
- **Q3 — precisazione rispetto alla raccomandazione:** l'owner vuole **quasi tutto, possibilmente tutto, anche da telefono**. La capacità mobile è obiettivo per base **e avanzato**, non una scelta desktop-only. Le limitazioni vanno motivate e quantificate; non promettere parità prima delle prove fisiche. La sequenza tecnica può essere progressiva, ma il requisito mobile rimane tracciato.
- **Q4:** cronologia locale di operazioni/preferiti/impostazioni; output conservati in sessione, salvataggio dei file sul dispositivo su scelta esplicita; anteprima e download manuale con automatico opzionale. Nessun archivio cloud documenti come default.
- **Q5:** modalità server inizialmente a costo aggiuntivo zero, dichiarata e scelta; al limite usare percorso locale equivalente se disponibile oppure indisponibilità trasparente. Nessuna spesa automatica.
- **Q6:** suite fiscale approfondita per privati/dipendenti e partite IVA come primi destinatari, in due percorsi distinti; annualità/fonti esplicite. Piccole imprese in evoluzione coerente.
- **Q7:** area personale adattiva con suggerimenti da file e uso locale, recenti/preferiti; navigazione stabile. Nessun modello AI o invio documenti necessario per questo comportamento.
- **Q8:** prodotto autonomo con firma riconoscibile dell'owner e pagina progetto/autore, strumenti in primo piano.

La direzione visiva è **deliberatamente rimandata a tre alternative concrete e successiva approvazione**. È un gate dei futuri ticket design/esecuzione, non un blocco alla pianificazione attuale. Non riaprire domande già risolte; proseguire nel pacchetto autorizzato. I dettagli tecnici non ancora dimostrati vanno in ticket di fattibilità con AC, prove e prossima azione, non trasformati in nuove domande generiche.

**Verifica puntuale dopo le risposte del round 2:** riletti dashboard/validator e confini di stato/trasferimento file (`src/workbench/membership.ts`, `src/workbench/state.ts`, `src/runtime/binary-handoff.ts`), oltre ai ticket #117/#237. `npm run tickets:check` PASS su HEAD `9a3d0e2`: 327 ticket, 284 completed di cui 17 refusal, 43 open, 0 mismatch. Non è prova di completezza funzionale o nuova verifica live. Il validator ammette `blocked`, `completed`, `ready-for-agent`: eventuali etichette base/avanzato vanno aggiunte come dimensione separata, senza inventare stati incompatibili o cancellare acceptance storiche. Questo lavoro ha modificato soltanto documentazione del grilling.

I dati sotto restano il registro storico del checkpoint precedente. Nuovi riscontri: account Turnstile bloccato nel browser controllato, recenti non alimentati dagli usi, contrasto testo account insufficiente, OCR #246 accessibile noindex fuori catalogo, iPhone fisico collegato ma acceptance NOT_RUN. Il redesign completo è già deciso; direzione, tre alternative concrete e approvazione di implementazione sono ancora pending.

> **Punto d'ingresso aggiornato:** `docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md` è il documento finale locale e versionato che collega questo backlog al mandato strategico/UX. I 43 ticket originali rimangono OPEN finché non sono soddisfatti i rispettivi criteri o una decisione esplicita li de-scopa.

**Documento operativo unico da utilizzare in una nuova chat** con `docs/HANDOFF-2026-10-10-RELEASE-INTERMEDIA.md`; aggiornato dopo commit sorgente `95be886`, Cloudflare 100% sulla versione associata e rimozione di 14 worktree/16 branch datati. **Non continuare il lavoro senza una scelta del proprietario sull'obiettivo del prodotto.**

**MANDATO AGGIORNATO, 10 ottobre — questo è il registro pending, NON il prompt completo.** Il proprietario ha richiesto una revisione iniziale **integrale e autonoma** (prodotto, concorrenza, costi, codice, design esistente, sito live, 43 ticket), poi una sessione **DStack `plan-grill-with-docs` / `plan-grilling`** con decision tree e raccomandazioni, e **un redesign end-to-end certo** nella roadmap, da realizzare una volta approvata la direzione. Ha definito il visual corrente troppo basic e generico/"AI slop": l'agente dovrà verificare le cause e sostituire il sistema visivo, non fare un restyling cosmetico. **Il prompt completo canonico da incollare nella nuova chat è `docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md`.** Usare questo insieme ai quattro documenti d'handoff e a `PRODUCT.md`, `DESIGN.md`, `design/WORLD.md`. Il vecchio prompt breve in fondo a questa pagina è superato.

## Stato fotografato

| Misura | Verificato | Significato |
|---|---:|---|
| Tool nel catalogo | 269 | Offerta esistente, NON 269 strumenti tutti Gold o ugualmente distintivi |
| Pagine statiche build | 291 | Include pagine di contorno/noindex, ma non route dev-only #237/#247 |
| Ticket completati | 284/327 | 17 chiusi con refusal esplicito e non messi sul mercato |
| Ticket aperti | **43** | 5 ready, 31 dipendenti, 2 official-source, 5 physical evidence |
| Test integrati | 1.791/1.791 | Regressione codice; non sostituisce utenti, dispositivi o certificazione |
| Cloudflare live | `git-95be886` | Distribuzione manuale verificata al 100%, NON Gold globale |
| Worktree/branch locali attivi | 1 / 1 | Solo `main`, senza WIP Git sporco |

## Cosa è veramente pending (non crearne di nuovi)

**Pronti per lavoro subordinato a scelte di prodotto:** #047 JPEG/PNG/WebP/SVG (solo **AC PNG completato**), #056 rich Office→PDF (refused finché no prova di fedeltà), #212 HEIC/AVIF/GIF (subset GIF primo frame, no HEIC iPhone), #237 true PDF redaction (DEV-only security audit), #246 OCR locale (qualità, memoria, mobile). Tutti cinque ticket interi OPEN.

**Fonti esterne:** #115 comuni/stati esteri storici ufficiali e #117 fiscalità italiana versionata e completa. Sono radici importanti, ma possono richiedere manutenzione normativa annuale e assunzione di responsabilità. Collegati: #121/#122/#008/#018, #126/#127/#128/#130/#133/#134/#135/#152/#158, famiglie #011–#015, #040/#062 e #046.

**Dispositivi:** #229 microfono fisico; #277 e #280 Android Chrome vero; #278 e #281 iOS Safari vero. #279 e #046 si sbloccano solo dopo i gate. Non usare i simulatori per spuntare AC real device.

**Altre dipendenze:** #024 da #056; #028/#049/#235/#058 da codec e #212; #031/#247 da #246; #032 da #237; #035 da #229. **Tutti i 31 originali** restano elencati nel dashboard generato: `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md`. La somma 5+31+2+5=43 è il controllo di completezza.

### Proposta di priorità (NON aggiornare gli status senza prove)

| Ordine | Risultato da ottenere | Originali coinvolti | Stop/go prima di spendere altre ore |
|---|---|---|---|
| **1** | Prime 3 user journeys reali e analytics privacy-safe; chiedere agli utenti se li usano, perché tornano e cosa manca | Prodotto pubblico corrente / #046 solo se proprio necessario | Nessun nuovo catalogo finché non si osserva un utente vero completare lavoro |
| **2** | 1 prova di fattibilità misurabile con **jSquash** JPEG/WebP effettivo, confronto bundle WASM/offline, alpha, tempi, licenza | #047, poi #028/#049 | Stop se aumenta molto peso/memoria, non supera già presente o non è portable Cloudflare |
| **3** | 1 prova di fattibilità **Libre Convert/ZetaOffice** con vero documento DOCX/XLSX/PPTX difficile | #056, poi #024 | Stop se runtime/licenza/COI/offline/size o fedeltà non adatti a prodotto e budget |
| **4** | Chiudere il fronte #237 con revisore PDF security esterno oppure mantenere spento | #237→#032 | **No public deploy** finché non si prova sicurezza oltre il corpus/desktop |
| **5** | Sessione fisica controllata su iPhone/Android (picker, memoria, permessi, annulla) con ricevute autentiche | #229, #277/#278, #280/#281, #246, #212 | Nessun Gold e nessuna chiusura di source/mobile senza log device verificabile |

**Da sospendere deliberatamente:** estensioni al catalogo senza domanda misurata; implementazione manuale di JPEG/WebP encoder, Office rich renderer, compatibilità con tutti i PDF ostili; completamento delle 31 dipendenze prima di una validazione del prodotto. **Da non sospendere:** bug sicurezza, regressioni già live, diritti sui file, limiti memoria e privacy.

## Grilling: banca di temi e domande, NON una sequenza rigida

**La skill DStack `plan-grilling` richiede la `frontier` completa di domande già affrontabili ad ogni round**: domande numerate, raccomandazione su ciascuna, poi attesa delle risposte e aggiornamento dell'albero. Non imporre "una domanda per round" come da precedenti prompt; non interrogare il proprietario prima dell'audit fattuale completo. Questi esempi sono spunti, non un questionario da inviare tutto in un solo turno.

1. Quale singola persona usa Strumentini.it ogni settimana, e quale azione completa meglio che su tool concorrenti? Hai prove o solo ipotesi?
2. Se domani mantenessimo **solo 20 tool**, quali terreste e perché? Quali 249 toglierebbe il primo utente senza sentirne la mancanza?
3. Il lavoro punta a un business SEO pubblicitario, a un workspace per professionisti o a un progetto R&D per costruire un sistema personale? **Scegli il KPI dominante**.
4. Quali 3 workflow fanno tornare gli utenti: conversione PDF, compressione immagini, utilities fiscalità, produttività per documenti, altro? Quale benchmark reale lo dimostra?
5. Perché realizzare un encoder WebP a mano quando un donor WASM Apache-2.0 potrebbe farlo? I vincoli offline/privacy/memoria lo giustificano?
6. Se il donor LibreOffice richiede cross-origin isolation, runtime di terzi o licenza inadatta, vogliamo davvero DOCX→PDF o dichiarare limiti e procedere al lancio?
7. Quale promessa di sicurezza *possiamo verificare* per PDF redaction senza rischiare di divulgare informazioni nascoste? Chi può firmare quella revisione?
8. Le fonti fiscali ufficiali (#115/#117) sono una vera leva commerciale o un obbligo di manutenzione normativa che distoglie dal nucleo? Quali annualità e verifiche servono?
9. Quante ore/costo per 1 nuova funzionalità siamo pronti ad accettare? Che cosa uccidiamo quando supera il budget?
10. Qual è il criterio oggettivo per **non aprire** un ticket nuovo, e come evitiamo di ripetere ogni giorno le stesse quattro matrici browser e build?
11. Serve davvero completare 327/327 per dire che il prodotto è utilizzabile? Definire tre colonne indipendenti: **live**, **accettato ma non promosso**, **R&D/rifiutato**.
12. Chi è responsabile del rilascio, del rollback e della matrice privacy? Perché le vecchie branch/worktree non erano state eliminate al momento dell'integrazione?

## Donor da verificare prima di implementare

Riferimenti controllati il 10/10/2026; **non sono già integrati né approvati commercialmente**.

- **jSquash**: https://github.com/jamsinclair/jSquash. Repository Apache-2.0, package JPEG (MozJPEG), WebP (libwebp), AVIF, Oxipng, PNG; build WASM/ESM orientate a browser e Web Workers. **Attenzione:** documentazione cita problemi noti Vite `optimizeDeps` e nested workers. Priorità #047: prova isolata, indipendente pixel/byte/license/dimensione bundle/CSP su Cloudflare statico, poi decidere go/no-go.
- **Libre Convert**: https://github.com/Rhgx/libre-convert. Usa LibreOffice WASM, COOP/COEP e SharedArrayBuffer, con service-worker bootstrap; promette Office→PDF. Il progetto è una *prova concettuale*, non una dipendenza approvata: verificare **licenza effettiva del runtime ZetaOffice separatamente da quella del wrapper**, font, fedeltà, offline, download asset, route API, compatibilità web hosting. Evitare qualsiasi integrazione fino a prove e permessi sufficienti.
- **MuPDF.js**: https://github.com/ArtifexSoftware/mupdf.js. Motore potente ma licenza **AGPLv3 o commerciale** secondo il proprietario: non incorporare in prodotto proprietario senza conformità legale o accordo.
- **Già nel repo**: `fflate`, `svgo`, `heic-to`, `pdfjs-dist`. Confrontare una nuova dipendenza rispetto a queste prima di aggiungerla. `pdfjs-dist` non costituisce automaticamente sicurezza PDF redaction.

## Prontuario per l'agente successivo

**Leggi prima, non ripartire da vecchi worktree:**

1. `docs/HANDOFF-2026-10-10-RELEASE-INTERMEDIA.md`
2. `docs/PENDING-GRILLING-2026-10-10.md`
3. `.scratch/strumentini-expansion-20261005/PRODUCTION-RELEASE-20261010-95be886.md`
4. `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md`

**Verifica:** `git status -sb`, `git worktree list`, `git branch -avv`, `git ls-remote --heads origin`, `npm run tickets:check`, `npm run check`, `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`, `npm run build`, `npx tsx scripts/validate-release.ts --no-write-receipt`, `wrangler deployments status --name strumentini --json`. Non lanciare di nuovo tutto senza un cambiamento reale.

**Prompt da incollare in una nuova chat:** utilizzare **il documento integrale**, senza riassumerlo:

`docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md`

È intenzionalmente lungo: vincola audit preliminare, real user journeys, 43 originali e donor, applicazione fedele delle skill di grilling, decisioni con ADR, e **redesign completo** approvato e poi realizzato con il corretto flusso design/QA/release. Se la nuova chat ha accesso al filesystem, leggere direttamente quel documento. Altrimenti copiarne **tutto** il contenuto come messaggio iniziale.
