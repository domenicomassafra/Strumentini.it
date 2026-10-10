# Strumentini.it — pending verificati e sessione di grilling per il prossimo agente

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
