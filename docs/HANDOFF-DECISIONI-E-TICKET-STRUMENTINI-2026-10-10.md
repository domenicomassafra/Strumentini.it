# Strumentini.it — handoff finale delle decisioni e del mandato ticket

Data: 10 ottobre 2026. Repository: `/Users/domenico/Code/Strumentini.it`.
Stato: **AUDIT CONSEGNATO; GRILLING CONFERMATO; PACCHETTO DI LANCIO PREPARATO**.
Il prossimo agente non è stato lanciato da questa sessione. Il prodotto, il redesign e i ticket di implementazione non sono dichiarati DONE o Gold.

## 1. Mandato immediato

Il mandato originale del 10 ottobre faceva riferimento a un prompt di coordinamento, ora ritirato dal working tree (#498) e conservato nella storia Git del commit `7fe2dfd`. Questo è uno snapshot storico, non un'istruzione di lancio attuale.

**Unico scopo:** completare il pacchetto operativo di Strumentini.it: riconciliare tutti i ticket presenti, aggiornare quelli che richiedono una revisione, creare quelli mancanti e futuri pertinenti, integrare specifiche/roadmap e preparare prompt di esecuzione. Il destinatario usa **Chat On Steroids** con **quattro subagenti nativi**. Il coordinatore è l'unico integratore delle authority condivise e dell'archivio ticket.

Autorizzati nel prossimo incarico: letture, ricerca mirata, documenti, ticket locali e rigenerazione delle loro proiezioni con generatori esistenti. Non autorizzati: codice applicativo/test applicativi, installazione di dipendenze, implementazione del redesign, deployment, DNS/D1, acquisti o pubblicazione di messaggi/issue su servizi esterni. Il destinatario prepara e controlla ticket eseguibili; la loro esecuzione è un incarico successivo. L'originario divieto di aprire ticket nuovi è superato dalla richiesta esplicita del nuovo pacchetto.

Il grilling non va ricominciato. Le otto risposte finali sono state confermate, con una precisazione mobile, e seguite da `go`. Le future scelte visuali e gli acquisti rimangono gate delimitati delle rispettive attività; non bloccano la pianificazione.

## 2. Decisioni dell'owner — authority per il nuovo pacchetto

| ID | Decisione confermata | Implicazione per ticket e roadmap |
|---|---|---|
| OWN-01 | Strumenti utili ogni giorno/settimana per chi lavora al computer, soprattutto in ufficio, anche persone comuni | Non ridurre il pubblico a freelance o sviluppatori; ordinare per lavori pratici |
| OWN-02 | Ambizione ampia, catalogo attuale mantenuto ricercabile, selezione principale curata | Nessun tetto 10–30 strumenti e nessuna eliminazione automatica dei 269 |
| OWN-03 | Prodotto base completo/affidabile nelle operazioni dichiarate; avanzato futuro | Definire capacità e limiti per strumento; non cancellare acceptance storiche per chiudere il base |
| OWN-04 | PDF, immagini, Excel/CSV, estrazione testo e oscuramento dati sono lavori forti | Roadmap e verifiche end-to-end per tutti questi ambiti, senza restringere il catalogo a essi |
| OWN-05 | Nel tempo editor PDF professionale e editor immagini con capacità comparabili a Photoshop sul web | Decomporre capacità concrete: PDF avanzato prima, immagini dopo; dati crescono per operazioni/automazioni; nessuna promessa di parità attuale |
| OWN-06 | Quasi tutto, possibilmente tutto, anche su telefono | Mobile incluso nel base e nell'avanzato; responsive non equivale a capacità; eccezioni motivate e recuperabili |
| OWN-07 | Ingresso per strumento e per file trascinato/selezionato | Suggerire operazioni compatibili col file; picker mobile equivalente; nessuna esecuzione/upload impliciti |
| OWN-08 | Operazioni consecutive sul risultato | Evitare scarica/ricarica obbligatorio; riuso dei contratti di risultato e handoff esistenti |
| OWN-09 | Memoria locale, risultati di sessione, file salvati esplicitamente sul dispositivo | Cronologia operazioni/preferiti/impostazioni; anteprima + Scarica, automatico opzionale; niente archivio cloud documenti come default |
| OWN-10 | Server ammesso se gratuito, dichiarato e scelto | Costi aggiuntivi zero iniziali; locale equivalente o indisponibilità trasparente al limite; lifecycle file verificabile |
| OWN-11 | Investimento forte in normativa/fiscalità italiana | Privati/dipendenti e partite IVA primi percorsi; fonti ufficiali, annualità e rollover; donor non sostituisce prova normativa |
| OWN-12 | Area personale adattiva, navigazione stabile | File + uso locale + recenti/preferiti; spiegazione dei suggerimenti; nessuna necessità di AI remota |
| OWN-13 | Inizialmente utilità gratuita e personal brand | Prodotto autonomo con firma owner/pagina autore; ads possibili, donazioni/pagamento futuri non ancora scelti |
| OWN-14 | Codice proprietario | Riuso con licenze compatibili e obblighi rispettati; commerciale valutabile; no automatico open source |
| OWN-15 | Donor-first e parallelismo forte; token quasi illimitati | Riutilizzare capacità mantenute prima di scrivere motori; nessun acquisto automatico; 2.000 repo/tool è esempio di ambizione, non quota da produrre |
| OWN-16 | REDESIGN COMPLETO deciso, interfaccia attuale troppo basic/generica/statica | Tutte le superfici e interazioni; evitare restyling cosmetico e template AI |
| OWN-17 | Tre alternative realmente differenti, direzione da scegliere dopo | Minimal/rigorosa, editoriale/riconoscibile, task/workspace; confronto su home/tool/result/account desktop e mobile; owner sceglie prima di implementare |
| OWN-18 | Animazioni e suono desiderati | Movimento utile e curato; reduced-motion; suono off di default/opt-in; no feedback solo sonoro |
| OWN-19 | Valutare motori commerciali con proposta concreta | Costo, beneficio, alternative e approvazione prima di acquisto; non chiedere nuovamente budget token |
| OWN-20 | Unico incarico successivo: ticket/spec/roadmap/prompt con 4 nativi Chat On Steroids | Nessuna implementazione applicativa né deployment in quella sessione; conclusione misurata sulla completezza del pacchetto |

Le stime di tempi/costi restano stime. Il riuso consentito di software e lo sviluppo autonomo di funzionalità analoghe sono percorsi distinti; accesso al sorgente o reverse engineering non conferiscono automaticamente diritti di copia. Nessun fork esterno o acquisto è necessario per completare l'incarico ticket.

## 3. Cosa è stato realmente verificato

Baseline dell'audit: `d0947cc278416ca966151eae516255b325477230`; sorgente distribuito nel receipt `95be886`. Ultimo HEAD letto prima di questa consegna: `9a3d0e2`, main ahead 2; singola worktree. I commit dell'audit erano `f350309` e `9a3d0e2`. La nuova consegna aggiunge documentazione; non cambia il sorgente applicativo o la produzione.

- 269 manifest; 327 ticket, 284 completed, di cui 17 refusal; 43 open: 5 ready, 31 dependency, 2 source, 5 physical. `npm run tickets:check` è stato rieseguito con PASS durante il grilling, zero mismatch. Ricalcolare sul checkout destinatario.
- 130 navigazioni reali Chrome/Playwright, 13 superfici, cinque larghezze, light/dark, tutte 200 senza overflow osservato. Non sono prove fisiche di smartphone.
- UTM, CSV, PNG e PDF merge hanno prodotto download reali riaperti indipendentemente; cinque pagine PDF in ordine, pixel/alpha PNG uguali, celle CSV quotate/zeri preservati. Loading/cancel PDF esercitato su fixture.
- Account: bootstrap Turnstile fallito in tutte le visite controllate; submit non completabile. Recenti vuoti dopo uso reale; `noteToolUse` non collegato ai percorsi. Copy file/attività superiore allo stato implementato. Contrasto secondario account 3,508:1.
- OCR #246 era laboratorio pubblico noindex fuori catalogo; #237 redaction e #247 PDF OCR 404 pubblici nell'audit.
- Validatore su checkout pulito: 0 errori e 7 blocker; 10 receipt assenti, 2 non Gold, 259 stale, altre prove release non attuali. Durante scrittura documenti rilevava anche worktree dirty: conservarne l'onestà.
- Fingerprint globale invalida molte prove ma esclude `worker/`; badge frontend non verificano la medesima freshness. LOCAL/network-forbidden è un contratto, non sandbox di rete.
- Telemetria era inattiva; metriche attuali di ritorno/riuso non dimostrano D7 o uso ripetuto della stessa persona. Zero workflow/run GitHub Actions osservati.
- Cloudflare live era 100% `6a1a5eaf-1091-45a7-a7c8-635c321877be`; versione precedente presente, rollback non esercitato. D1 info disponibile; SELECT schema rifiutata per autorizzazione, login autenticato non provato.
- iPhone fisico collegato nell'audit, Android/adb non verificati; prove physical NOT_RUN. Non ripetere vecchia affermazione “iPhone assente”.
- Suite 1.791 test / 233 suite, check 1.949 file, build 291 pagine sono **storici**, non nuovi esiti di questa consegna.

L'audit completo e le prove sono `docs/AUDIT-INDIPENDENTE-STRUMENTINI-2026-10-10.md` e `docs/audit-2026-10-10/`. Le raccomandazioni del reviewer di restringere il prodotto e sospendere fiscalità/CF **non sono state adottate**. I fatti negativi rimangono validi al loro snapshot; le priorità si aggiornano con OWN-01–20.

## 4. Codebase e authority da usare

Stack esistente: Astro statico, Preact, TypeScript, Cloudflare Worker/D1 per account. Mantenere come baseline, nessuna migrazione gratuita di framework. Motori condivisi, registry compile-time, lazy heavy dependencies, oracles/fixture/receipt esistenti sono asset.

File riletti nel grilling:
- `src/workbench/membership.ts`, `src/workbench/state.ts`: stato IndexedDB di tool ID, recenti e preferenze; nessun archivio documenti. Unione favorites account non equivale a sync cancellazioni.
- `src/runtime/binary-handoff.ts`: envelope verificati e trasferimento locale bounded, 64 MiB nel contratto attuale; non promessa di workflow universale su tutti i file.
- `.scratch/strumentini-expansion-20261005/validate_backlog.py`, `ticket_dashboard.py`: archivio e proiezioni esistenti, stati `blocked`, `completed`, `ready-for-agent`, ID continui e grafo aciclico. Parser delle dipendenze numeriche limitato a 1–3 cifre: pianificare entro limiti, non introdurre 2.000 ID incompatibili.
- Originali #117 e #237: sottoinsiemi normativi e sicurezza PDF con acceptance globale ancora aperta.

Usare:
1. `docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md` e `docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md` come mandato precedente e contesto, con delta OWN-01–20.
2. `PRODUCT.md`, `PRODUCT-SPEC.md`, `PRODUCT-MARKETING-CONTEXT.md`, `IMPLEMENTATION-PLAN.md`, `DESIGN.md`, `design/WORLD.md`.
3. `docs/10-tool-expansion-result-system-v2.md`, `docs/11-format-operation-matrix.md`.
4. `.scratch/strumentini-expansion-20261005/issues/`, `CURRENT-TICKET-DASHBOARD.{md,json}`, `TICKET-DAG.md`, `SKILL-ROUTING.md`.
5. `quality/oracles/`, `quality/fixtures/`, `quality/receipts/`, `spikes/` e `docs/RESEARCH-DECISIONS-2026-10-27.md` (decisioni uniche tratte dalle vecchie lane, con recupero integrale da Git).
6. `PROJECT-STATUS.md`, `HANDOFF.md`, `ROADMAP.md` se aggiornati, receipt release 95be886 come cronologia.
7. `CONTEXT.md` e `docs/PENDING-GRILLING-2026-10-10.md` per vocabolario/risposte.

Non esisteva `tasks/index.md` locale corrente; non importare task globali di DStack estranei. I run September, storici già nel 2026-10-10, sono stati ritirati in #498 con decisioni conservate nel registro e originali in Git; non recuperare vecchi worker o worktree come WIP.

## 5. Donor: piste verificate, non adozioni approvate

| Pista | Leva | Vincoli da risolvere nei ticket |
|---|---|---|
| jSquash / Squoosh | JPEG/MozJPEG, WebP, OxiPNG, AVIF per #047 e derivati | Wrapper Apache, transitive/compiled assets, pinning, output, cold/warm/memory/device/CSP; non importare analytics/whole app |
| SVGO già installato | Ottimizzazione SVG | Rendering equivalente, ID/viewBox/references, hostile SVG |
| heic-to/libheif già presente | HEIC iPhone e codec #212 | LGPL e componenti codec distinti, orientation/metadata/multipagina, prove fisiche; non equiparare LGPL ad AGPL |
| PDFStudio/qpdf vendored; PDF.js | PDF mutation/inspection/extraction | Provenance e engines già disponibili prima di nuovi parser; non inferire redaction sicura da parser riuscito |
| Libre Convert / ZetaOffice / LibreOffice WASM | Office→PDF fedele #056/#024 | Licenza wrapper distinta dal runtime; asset ~49,75 MiB compressi rilevati, CDN latest non pinned; service worker/cache/COOP/COEP da isolare |
| MuPDF.js | Motore PDF ricco | AGPL o commerciale nello snapshot; prodotto proprietario richiede percorso compatibile, non adozione automatica |
| Spectrum Web Components e altri primitives | Studi di interazioni/editor/design system | Non imporre skin Adobe né nuova infrastruttura UI senza utilità; design authority ancora da scegliere |

Aggiornare soltanto evidenze decisive che possono essere cambiate, da fonti primarie. I candidati fiscali devono provare regole/anno/fonti, non soltanto avere un repository. Per editor immagini, PDF e dati cercare donor aggiuntivi mantenuti e compatibili; documentare source, license, versione, API, prove, costi e cosa sostituiscono.

## 6. Livelli e completezza richiesta

Il pacchetto deve distinguere:
- livello base implementato/verificato;
- base con gap da risolvere;
- evoluzione avanzata;
- R&D/fattibilità con go/no-go;
- refusal storico, capacità non spedita;
- gate owner/physical/external con prossima azione.

Sono dimensioni di pianificazione, non nuovi lifecycle incompatibili. Mai abbassare un AC storico per chiudere un umbrella. Se un requisito viene trasferito a un nuovo ticket, mantenere ID/link/criterio/stato di prova e dichiarare che il requisito rimane aperto.

Deliverable del destinatario: registro decisioni/requisiti, riconciliazione 327/327 (o conteggio fresco), matrice tutti i manifest/formati, ticket mancanti scritti, 43 originali risolti a livello di piano, refusal riconciliati, donor matrix, DAG e frontier, roadmap massimo cinque outcomes, prompt futuri con gate, report verifiche e handoff terminale.

“Futuri” significa capacità giustificate dalle decisioni e dalle famiglie del prodotto, non qualunque idea ipotetica. Nessuna quota artificiale di nuovi ticket e nessun epico “finire Photoshop” senza children verificabili.

## 7. Verifica e prosecuzione

Il run contiene `COORDINATOR.md`, `HISTORICAL-RESPONSES.md` e manifest dei file di consegna. Il solo prompt da lanciare ora è quello del coordinatore. Nessuna response viene precreata.

Il destinatario aggiorna il backlog nello stesso archivio; i quattro specialisti scrivono solo documenti/proposte nelle loro directory disgiunte e restituiscono risultati nativi. Il coordinatore integra serialmente, aggiorna authority e rigenera DAG/dashboard; controlla coverage, riferimenti, duplicati, ownership, nessun ciclo e nessuna modifica applicativa.

La conclusione dell'incarico significa **PACCHETTO OPERATIVO COMPLETO**, non prodotto implementato, visual approvato, Gold o produzione promossa. Ogni futuro prompt deve portare contesto, confini, ticket, input/output, AC, prove, rollback e gate pertinenti. Non può introdurre scelte di upload, licenza, spesa o visual non approvate.

Il terminal handoff esterno va nella response adiacente; i quattro subagenti non usano questo trasporto manuale. A una successiva lettura verificare response, diff e prove, poi autorizzare il lavoro esecutivo appropriato.
