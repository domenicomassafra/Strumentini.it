# STRUMENTINI.IT — HANDOFF DEFINITIVO LOCALE

**Rivalutazione critica del prodotto, stato verificato, piano di grilling e mandato per il redesign completo**

**Checkpoint:** 10 ottobre 2026, ore 20:20–20:30 Europe/Rome. **Stato:** handoff conclusivo della fase di sviluppo; il prossimo agente deve prima analizzare e discutere, non riprendere automaticamente l'implementazione. **Questo file è il punto d'ingresso canonico.**

## 0. COME USARE IL FILE NELLA NUOVA CHAT

**Percorso locale assoluto:** `/Users/domenico/Code/Strumentini.it/docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md`.

Al nuovo agente dare l'ordine di **leggere integralmente questo documento e il prompt dettagliato** `docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md`, quindi gli originali citati. Se il nuovo agente non può leggere il disco, inviare entrambi i file o incollare il prompt. Non limitarsi alla memoria della chat precedente.

**Obiettivo dichiarato dal proprietario:** tutto il WIP tecnico precedente deve essere consolidato; desidera una **rivalutazione completamente indipendente** di prodotto, domanda, target, tecnologia, velocità di avanzamento, costo opportunità, donor/fork, UX e UI. La grafica attuale è giudicata **troppo basic, generica, AI slop**: dopo il grilling il progetto dovrà affrontare **un redesign completo**, non un cambio di palette. Il *se* del redesign è deciso; *identità, scope, forma, UX e implementazione* vanno invece decisi insieme.

**Sequenza obbligatoria:** AUDIT autonomo e documentato → diagnosi critica → `plan-grill-with-docs` / `plan-grilling` / `plan-domain-modeling` → decisioni confermate → `design-consultation` e 3 alternative di nuovo prodotto/UI → approvazione → implementazione reale con `design-impeccable` → QA, canary e rollout solo quando autorizzati. L'audit non va saltato; il redesign non va anticipato senza decisioni.

## 1. FONTI DI VERITÀ E MATRICE DI AUTORITÀ

| Concetto | Fonte canonica | Stato nel checkpoint |
|---|---|---|
| Codice, Git | `/Users/domenico/Code/Strumentini.it`, GitHub `domenicomassafra/strumentini-it` | `main` pulito; source live al commit **`95be886`**; documenti successivi `de2b1bc`, `dcfb624` e prossimo commit handoff |
| Produzione | Cloudflare Worker `strumentini`, `https://strumentini.it` | `6a1a5eaf-1091-45a7-a7c8-635c321877be`, 100%, verificato 10/10 alle 20:20 |
| Catalogo | `src/generated/catalog.ts`, manifests e build | **269 strumenti**, **291 pagine statiche**; il numero non prova utilità o qualità uniforme |
| Ticket | `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md`, `issues/*.md`, `ticket_dashboard.py` | **327 totali, 284 completati (17 refusal), 43 aperti**; `npm run tickets:check` PASS |
| Product intent | `PRODUCT.md`, `PRODUCT-SPEC.md`, `docs/00-product-vision.md`, `docs/04-decision-history.md` | "Personal utility workbench" per knowledge workers; **tesi non ancora validata su utenti reali** |
| Design corrente | `DESIGN.md`, `design/WORLD.md`, `src/styles/global.css`, componenti | Uno schema categoria standard blu/bianco scelto in passato; **ora contestato dall'owner** |
| Prompt integrale | `docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md` | Istruzioni dettagliate per nuovo agente, audit/skill/grilling/redesign |
| Stato release | `.scratch/strumentini-expansion-20261005/PRODUCTION-RELEASE-20261010-95be886.md` | manual deploy effettuato, ma validatore release globale **BLOCKED**, non Gold |

### Ri-verifica effettiva al checkpoint

1. `git status --porcelain=v1 --branch`: **`## main...origin/main` senza altre righe**, nessuna modifica tracked/untracked.
2. `git worktree list --porcelain`: **una sola worktree** nel repository canonico. `git branch -avv`: una sola branch locale `main` e `origin/main` (+ `origin/HEAD`). `git stash list`: **vuoto**.
3. `git ls-remote --heads origin`: solo `refs/heads/main`. È stato trovato un **remote-tracking ref obsoleto** `origin/feature/str-048-210-211-image-compression`, già assente dal server: `git fetch --prune origin` lo ha eliminato, senza creare merge né perdita di codice; `main` era già aggiornata.
4. `git rev-list --left-right --count origin/main...HEAD`: **`0 0`**. Niente force push. La pulizia precedente aveva rimosso **14 worktree** e **16 branch locali vecchi**, senza modifiche tracciate pendenti; **non rifarla** alla cieca.
5. `npm run tickets:check`: `PASS`, 0 mismatch, 327/284/43; `ready-for-agent=5`, `dependency-blocked=31`, `external-source-blocked=2`, `external-device-blocked=5`.
6. `wrangler deployments status --name strumentini --json`: unica versione `6a1a5eaf-1091-45a7-a7c8-635c321877be` al **100%**. Precedente version ID da verificare prima di ogni rollback: `32956b26-6c3c-4a22-92c5-ae29be8e7f65`.
7. HTTPS live da `curl`: `GET /` **200**, `GET /api/auth/session` **200** con `{"user":null}`. Playwright Chromium: `GET /`, `/strumenti/`, `/tools/image-compression/` **200**, `/tools/pdf-true-redaction-237/` **404** intenzionale. **Anomalia da annotare, non da etichettare come login rotto:** la **navigazione diretta** di Playwright alla route JSON `/api/auth/session` ha restituito **404/HTML**, ma `fetch('/api/auth/session')` dall'app, ripetuto 3 volte, ha restituito **200/JSON** e `curl` diretto ripetuto ha dato 200. Il client API tipico funziona; investigare differenza `Sec-Fetch-*`/navigazione se emerge un problema utente reale. Una richiesta Python `urllib` generica ha avuto un 403 transient, mentre curl/Playwright pagina sono 200: non dedurre un outage da un client isolato.
8. `npx tsx scripts/validate-release.ts --no-write-receipt` (read-only): **`BLOCKED`, 0 errors, 7 blockers, 0 warnings**. PASS `toolSurface`, `cloudflareStaticAssets`, `publicSiteUrl`, `publicMetadata`, `staticAssets`, `truthfulClaims`; BLOCKED Gold, browser source-bound, dispositivi fisici, rollback.

**Le evidenze `1.791/1.791` test in **233 suite**, TypeScript/Astro 0 errors/0 warnings su 1.949 file, build 291 pagine, portabilità/static Wrangler e canary HTTP 144/144 sono state raccolte durante il release batch e sono documentate nel receipt live, non rieseguite da zero in questo solo checkpoint documentale.** Non far girare 1000 test per accertare un Markdown modificato; ripetere prove mirate quando cambia codice.

## 2. IL VERO STATO DEL PRODOTTO (NON CONFONDERE CATEGORIE)

**Shipped / utilizzabile nel perimetro testato:** Astro 7 static, UI Preact, 269 manifest reali, directory, categorie, ricerca, onboarding e workbench local-first, molti tool di testo/CSV/PDF/immagini/media, shell light/dark, account opzionale con API Worker/D1 per autenticazione/sync strumenti salvati, asset statico su Cloudflare, contenuti di aiuto/FAQ. Il dominio è online. Funzione specifica provata in produzione: PNG palette exact con upload, download e confronto RGBA indipendente in Chromium e WebKit a viewport 390px. Non dedurre che ogni tool sia stato testato su mobile reale.

**Sviluppato ma incompleto rispetto al ticket originale:**

- **#047 compressione:** PNG IDAT senza perdita, palette PNG exact e lossy con alpha esatto; AC PNG chiuso. JPEG avanzato, WebP lossless/effort e SVGO/multipass restano da provare in termini contrattuali.
- **#056 Office→PDF:** gli export printable limitati sono autentici; documenti ricchi DOCX/XLSX/PPTX **rifiutati** quando non si può garantire fedeltà. Refusal corretto ≠ ricca conversione realizzata.
- **#212 formati direzionali:** subset GIF first-frame offset/interlacciato migliorato; HEIC/iPhone fisico, AVIF, animazioni/metadata non promossi universalmente.
- **#237 true PDF redaction:** motore raster-only con prove di rimozione byte hidden/orphan e interoperabilità PDFKit dopo fix `/Parent`, **solo DEV/non pubblico**; sicurezza universale / hardware / revisione indipendente mancanti.
- **#246 OCR locale e #247 PDF OCR:** avanzamento tecnico di laboratorio, **niente catalogo prod** su #247; hardware e QA OCR non sufficienti.

**Bloccato o non certificato:** Gold non source-bound sulla revisione attuale, due receipt non Gold, 10 tool senza receipt, 259 vecchi Gold source-stale, fisici iOS/Android assenti, rollback corrente da ricertificare. Non segnare tutto verde. Il prodotto online può essere utile **senza** che la piattaforma abbia completato ogni promessa futura.

## 3. I 43 TICKET ORIGINALI RIMASTI, SENZA APRIRNE ALTRI

| Gruppo | Ticket e ragione | Decisione prima del coding |
|---|---|---|
| 5 agent-ready | **#047, #056, #212, #237, #246**: codec avanzati, Office fidelity, GIF/HEIC/AVIF, PDF redaction, OCR locale | selezionare al più **uno** spike codec/Office e tenere PDF sicurezza spento finché manca revisione indipendente |
| 2 source | **#115** storicità e provenienza amministrativa; **#117** fonti ufficiali fiscali per annualità/IVA/IRPEF/INPS | decidere se fiscalità italiana è davvero core oppure manutenzione/regolamentazione costosa da sospendere |
| 5 physical | **#229** microfono; **#277/#280** Android; **#278/#281** iOS Safari | solo veri test device/picker/perms/memoria/cancel, non viewport emulator |
| 31 dependency | **#008, #011, #012, #013, #014, #015, #018, #024, #028, #031, #032, #035, #040, #046, #049, #058, #062, #121, #122, #126, #127, #128, #130, #133, #134, #135, #152, #158, #235, #247, #279** | non sbloccarli con nuove spunte: mantenere la DAG; decidere quali catene dismettere o de-scope formalmente |

**31 = conta verificata**, niente duplicati da ricreare. I singoli issue originali specificano AC e dipendenze: leggerli prima di toccare lo status. Criteri di chiusura forti rimangono validi sui formati che si decide di offrire. È però **un errore strategico possibile** mantenere 327 ticket come *soglia per poter dire che esiste un MVP*: distinguere roadmap aspirazionale e perimetro shipping.

## 4. RIVALUTAZIONE INDIPENDENTE: VERDETTO PROVVISORIO E PROVE

**Verità principale:** Strumentini.it è un risultato ingegneristico significativo e funzionale, ma non c'è prova che sia **un business differenziato** né un prodotto che gli utenti desiderino usare quotidianamente. Il repository fornisce molte prove di correttezza tecnica, **non** dati di domanda, frequenza, retention, revenue o disponibilità a pagare. Dobbiamo smettere di interpretare completamento dei test come validazione di mercato.

### Che cosa oggi appare incoerente

1. **Promessa "workbench personale" vs facciata "directory generica".** `PRODUCT.md` e `docs/00-product-vision.md` definiscono l'installato e i default memorizzati come prodotto, e il catalogo come infrastruttura. Ma `src/pages/index.astro` e `src/components/home/{HomeHero,CategoryGrid,StarterTools}` aprono su claim generico, grande input ricerca e griglia di categorie. **Fatto di codice:** è una homepage directory-first. **Ipotesi forte:** per un nuovo utente la differenziazione del workbench non è percepibile; da verificare con sessioni reali di 3 job.
2. **Il design GENERICO è in parte una decisione storica esplicita**, non soltanto un errore accidentale: `design/WORLD.md` dichiara la tesi "familiar, expected version" e "one blue, one white card, one obvious action". Ha favorito prevedibilità e consistenza su 200 tool, ma il proprietario ora **ritira l'approvazione estetica di quell'indirizzo** e chiede una sostituzione end-to-end. Non prendere `WORLD.md` come vincolo estetico eterno; usalo come baseline da migrare dopo consenso.
3. **Ripetizione componenti da template.** `src/components/home/HomeHero.astro` usa tagline "Strumenti semplici, utili davvero.", search-bar universale, blob e tile decorative; `CategoryGrid.astro` applica a ogni categoria la stessa card, bordo, ombra, icona con tinta, contatore e piccolo hover. **Fatto di codice:** pattern ripetuti e personalità visiva derivata quasi interamente dai token globali. **Giudizio di design:** rischio elevato di percezione basic/slop e nessuna gerarchia in base a utilità reale. Il redesign deve affrontare composition, typographic voice, interaction and IA, non nuove sfumature di blu.
4. **269 tool vs contratto originario 200.** `PRODUCT.md`, `DESIGN.md` e `design/WORLD.md` spesso parlano ancora di "200"; il catalogo live è 269. `docs/08-product-definition-pre-design-synthesis.md` dice addirittura che l'app non è implementata: documento storicamente corretto ma **sbagliato se letto come stato attuale**. Serve inventario dell'autorità e aggiornamento selettivo dei documenti vivi, non riscrivere a posteriori la storia.
5. **Feature factory ≠ designer del compito.** Il wrapper di tool (`ItalianToolPage`), sezioni ripetute FAQ/trust/property e la directory sono coerenti, ma vanno testati rispetto a *time-to-result*. Moltiplicare lo stesso template per 269 route può diluire il valore. Un prodotto eccellente farà in modo che l'utente riconosca il task, arrivi subito al controllo e comprenda risultato/errori; evidenziare i tool per un job e per percorso, non il numero totale.
6. **Il motore fiscale potrebbe essere una deviazione costosa.** #115 e #117 sbloccano numerosi calcoli, ma introducono problemi di fonti ufficiali e aggiornamento per anno. Senza prova che gli utenti li vogliano e senza owner normativo, questa catena rischia di ritardare il nucleo PDF/file/CSV/workbench.
7. **Quality gate e velocità sono mal accoppiati.** Suite 1.791, 5 browser desktop/emulazioni, source fingerprint, Gold evidence, matrice 327 ticket e test simultanei su Mac carico hanno aumentato costo di ogni modifica. Servono verifiche differenziali su unità toccate e un **release train** con freeze, poi matrice cumulativa; non abbassare controlli sicurezza/accuratezza.
8. **WIP frammentato non equivale a codebase in arretrato.** Vecchi branch/worktree già sorpassati generavano rumore cognitivo. Sono stati consolidati e rimossi nel batch precedente. Al checkpoint attuale non esiste altro Git WIP e lo sviluppo deve smettere fino al grilling.

### Scorecard preliminare, soggettiva e dichiaratamente incompleta (0–5)

| Dimensione | Stima | Fonte / limite | Cosa la migliorerebbe |
|---|---:|---|---|
| Funzionalità tecniche | **4/5** | route/build/test/deploy effettivi; non tutte certificate | focus sui 10–30 tool più utili, indipendente proof output |
| Privacy/local-first | **4/5** | client-side per file, API opzionale; nessuna prova di abuso accertata | audit reale network/file e note UX privacy verificabili |
| Fiducia/correctness | **3/5** | forte test coverage ma 7 release blockers e source-stale | source-bound evidence, device, rollback, scope pubblica sincera |
| Differenziazione | **2/5** | tesi workbench, facciata directory commodity | misurare saved defaults e recurring workflows su utenti veri |
| Craft visuale | **2/5** | font Inter, blu/bianco, hero/generic cards; valutazione basata su codice e screenshot precedenti, non audit WCAG completo | nuova brand stance, IA, gerarchia, componenti distintivi, UX operativa |
| Esperienza mobile | **3/5** | viewport browser e assenza overflow rilevati, ma non hardware | veri iPhone/Android, performance pesanti, picker/focus/keyboard |
| Sostenibilità manutenzione | **2/5** | numerosi codec custom, fonti annuali, prove per ogni route | donor ben licenziati, shrink scope, release batched, budget stop |
| PMF, revenue, retention | **NON VALUTABILE** | nessuna prova di interviste, paid users o coorti | ricerca utenti, metriche anonime, esperimenti falsificabili |

**Questi numeri sono solo una scala per il reviewer e NON un benchmark scientifico.** Il nuovo agente deve rifare un audit visivo realmente completo di desktop e mobile, includendo screenshot del sito live, dark mode, sottopagine, ricerca, input/output, focus, stati errore, preferiti/account, **prima** di alzare o abbassare giudizi.

## 5. TRE IPOTESI DI PRODOTTO DA METTERE ALLA PROVA

**A. Workbench per freelance e piccoli team operativi (raccomandazione iniziale)**: partire da una scelta di job/casi d'uso, tenere 10–30 strumenti nel set quotidiano, riusare default, recente e favoriti. Pro: beneficio ripetibile, brand più memorabile, layout operativo; contro: la domanda di workspace persistente va dimostrata con ritorno reale. Test in 2 settimane: 3 lavori concreti, completamento/time-to-result e numero di ritorni anonimi senza tracciare file.

**B. Directory SEO di utility gratuite**: massimizzare ricerca Google, landing ottimizzate, conversione da query a tool, molto catalogo. Pro: domanda query già esistente; contro: competizione feroce, comoditizzazione, design sempre simile e costo di mantenimento 269 pagine. Test: Search Console/ingressi per keyword reali e completamento da deep link, non follower fittizi.

**C. Verticale curato PDF/file prep**: diventare riconoscibile come strumento affidabile per preparare/convertire documenti, con workflow e proof, tagliando parecchio altro. Pro: messaggio più chiaro e canali distribuzione; contro: concorrenza con prodotti specializzati forti e limiti su Office/PDF/redaction. Test: 5 problemi ad alto valore e corpus reale, i plugin pesanti non devono compromettere la privacy.

La scelta va fatta **prima** di investire in 31 ticket concatenati o in una nuova home. Se non emergono evidenze per nessuna, valutare anche stop/pivot parziale.

## 6. DONOR/FORK: ALTERNATIVE CONCRETE, EVIDENZA VS DECISIONE

**Verifica pubblica del 10/10/2026**, non ancora spike/installazione:

| Candidato | Evidenza verificata oggi | Potenziale | No-go/due diligence |
|---|---|---|---|
| **jSquash** `https://github.com/jamsinclair/jSquash` | WebAssembly browser/worker, moduli ufficiali per MozJPEG, libwebp, libavif, Oxipng, resize; repo Apache-2.0; esempi Cloudflare/Vite, con warning su Vite optimizeDeps | Alta per **#047** e parti #212: meno encoder fatto in casa | misurare esatto API lossless/effort, pixel+alpha, runtime WASM, bundle, CSP, offline, licenze transitive, performance Safari; non usare CDN runtime per file privati |
| **Libre Convert + ZetaOffice** `https://github.com/Rhgx/libre-convert` | wrapper MIT che usa LibreOffice WASM per Office→PDF; README distingue esplicitamente **licenza separata del runtime** e prova browser dichiarata su Chromium; piccolo repo | Possibile shortcut per **#056**, invece di reinventare layout Word/Excel/PPT | licenza runtime, caching/service worker, SharedArrayBuffer/COOP/COEP, **runtime molto pesante** (altro pacchetto ZetaOffice elenca artefatti 154 MB wasm + 95 MB data: misura l'esatto donor, non attribuirli automaticamente a Libre Convert), Safari, rete/offline, test fidelità rich, privacy |
| **MuPDF.js** `https://github.com/ArtifexSoftware/mupdf.js/` | wrapper ufficiale WASM per rendering/manipolazione PDF; Artifex dichiara **AGPLv3 o commerciale** | alternativa tecnicamente robusta per parser/rendering/PDF | non integrare nel prodotto senza verifica licenze/commercial policy; redaction e rimozione byte sorgenti richiedono prova separata, non basta un renderer |
| **Asset già presenti** | `fflate`, `svgo`, `heic-to`, `pdfjs-dist` e logiche browser attuali | ridurre codice nuovo sfruttando quanto già paghiamo/manuteniamo | confronto quantitativo di qualità, size, tempo e coverage contro donor, niente sostituzione senza benchmark |

**Fonti di audit** (consultare nuovamente quando si prende la decisione): jSquash README ufficiale `https://github.com/jamsinclair/jSquash#readme`; Libre Convert README `https://github.com/Rhgx/libre-convert#readme`; MuPDF licenza `https://artifex.com/licensing`; `https://github.com/mapo80/libreoffice-web/releases` per un esempio di dimensione runtime ZetaOffice, non un benchmark di quello specifico donor.

**Regola build-vs-buy:** una spike limitata, indipendente e misurabile deve provare *funziona su corpus e browser reali, è legalmente usabile, è economicamente sostenibile, non rompe il front-end né la privacy*; se non supera la soglia, **non continuare a implementare a mano senza nuova decisione**. Rimuovere duplicati codice e dipendenze solo dopo migrazione dimostrata.

## 7. REDESIGN: DA FARE, NON DA "POLISHARE"

Il proprietario **ha già richiesto un rifacimento profondo**. All'atto del grilling non chiedere "vuoi davvero redesign?". Bisogna decidere:

1. Identità/messaggio e primo target: cosa deve risultare riconoscibile nei primi 5 secondi e in un secondo utilizzo.
2. IA: home come task launcher/workbench, non la solita directory; come accedere ai 269 strumenti senza sommergere, e come distinguere ricerca, preferiti, recenti, categorie e tool packs.
3. Composizione e tipografia: abbandonare formula hero-blob + griglia infinita di card, scegliere una voce editoriale/operativa con ritmo, iconografia utile e copy chiaro in italiano.
4. Tool UX: integrazione input → progress → error/refusal → risultato/downloading, senza 6 blocchi SEO prima dell'operazione; mobile-first realmente usabile.
5. Trust e accessibilità: privacy mostrata attraverso comportamento vero, nessun badge o statistiche inventate, focus, tastiera, motion, target touch, WCAG 2.2 AA.
6. Account e continuità: cosa aggiunge davvero l'accesso oltre al browser anonimo, e come preservare IndexedDB/localStorage state nel redesign.

### Tre direzioni visive che **il prossimo agente deve proporre con veri esempi**

- **Precise Utility / editoriale austero**: black/white dominante, forte griglia tipografica, componenti densamente funzionali, nessun ornamento casuale; tono sobrio e credibile. Rischio: risultare freddo se non ben progettato.
- **Editorial Human / strumenti memorabili**: titoli con personalità, gerarchia narrativa e layout modulare distinto per classi di task, poche immagini originali dove aiutano; non il caos, non copia letterale di brand altrui.
- **Command Workbench / risultato-first**: interfaccia che sembra uno strumento professionale, ricerca/command palette ben in vista, pannelli input/output e preset che ricordano il contesto, home molto diversa per primo uso vs ritorno. Rischio: complessità e curva di ingresso.

Prima di scegliere leggere `design/WORLD.md` e `DESIGN.md` come **baseline storica**, non authority immutabile. Le alternative devono avere veri mockup comparabili (home desktop/mobile, catalogo/search, tool input+output, preferiti/account), quindi definizione token, stato e funzioni. **Non implementare finché l'owner non conferma**; implementare poi tutti i componenti condivisi e template principali, non solo home e screenshot.

## 8. GRILLING DSTACK — PROTOCOLLO VINCOLANTE

Le skill locali esistono:

- `~/.codex/skills/plan-grilling/SKILL.md`, idem per `~/.claude/skills/plan-grilling/SKILL.md`.
- `~/.codex/skills/plan-grill-with-docs/SKILL.md` usa **`plan-grilling` + `plan-domain-modeling`**.
- `plan-ceo-review` per diagnosi strategica, `business-office-hours` se serve domanda/PMF; `design-consultation`, `design-impeccable`, `design-review` per le fasi successive.

**Usare la semantica reale, NON un falso comando `/grill-me`**: mappare l'albero di decisioni, identificare a ogni round la **frontier completa** di domande già decidibili senza informazioni mancanti. Porre le domande numerate Q1/Q2/Q3... con risposta **raccomandata e motivata**, attendere il proprietario e riaggiornare la frontier. Non sottoporre a lui fatti che possono essere cercati; delegare ad agenti di audit se disponibili. Una decisione che dipende da un'altra non si anticipa. Registrare glossario e ADR solo dopo conferma; non eseguire le decisioni finché la shared understanding non è confermata.

### Decision tree suggerito (dipendenze)

| Nodo di radice | Decisioni che richiedono risposta del proprietario | Sblocca |
|---|---|---|
| **R1: vero problema/utente** | quale utente/jobs; usage/retention/paid vs SEO; che cosa significa "usabile" | priorità core, slogan, homepage, distribuzione |
| **R2: modello economico** | ricavi / gratuito, privacy, tempo da investire, metrica dominante e kill threshold | scelta di tool, costo donor, crescita |
| **R3: core scope** | 10–30 tool e 3 workflow principali, 43 ticket keep/park/cancel motivato | sitemap IA, fondo backlog, release train |
| **R4: valore distintivo** | workspace persistente o tool verticale o directory? che cosa si ricorda davvero? | onboarding, account, search, homepage |
| **R5: gusto / brand** | quale delle **tre direzioni realmente visualizzate**; che cosa tenere, cosa eliminare | `DESIGN.md`, `design/WORLD.md`, design system e implementazione |
| **R6: tecnologia & rischio** | quali donor approvare dopo benchmark, se rifiutare Office, che scope per redaction/fisco | engineering plan, licenze, security |
| **R7: execution** | budget, owner release, rollout, criterio QA, target 2 settimane/30 giorni | attività e fine fase decisionale |

**Output intermedio dopo audit e prima della prima domanda:** un report indipendente che dica senza addolcire: *che cosa è buono, cosa è brutto, cosa è costruito male o troppo, cosa gli utenti percepiscono, dove si è perso tempo, quali risorse esterne possono salvarlo*, con screenshot e prove. Quindi prima **round** di frontier. Non saltare il report per arrivare più in fretta alle domande.

## 9. CONSEGNA FUTURA: COSA IL NUOVO AGENTE DEVE PRODURRE

**Fase A (solo audit, senza alterare produzione):** browser desktop/mobile reali, homepage, 269 catalog, search, categorie, tool pesanti+leggeri, risultati veri, onboarding, guest/logged-out/account, preferiti, settings, help; 43 ticket e motivi, analisi source-bound proof; peer UX e competitor con fonti aggiornate; donor shortlist; screenshot e scorecard riveduta; report con `VERIFICATO`/`IPOTESI` e question tree. **Non fermarsi a questo handoff: convalidare o confutare i suoi giudizi.**

**Fase B (grilling):** round con skill corrette e raccomandazioni, glossario e ADR; rendere espliciti quale target, perimetro, estetica e strategia siano stati scelti. **L'utente decide, l'agente porta evidenze e opinioni.**

**Fase C (design decision):** tre alternative visivamente diverse con mockup desktop/mobile di home/catalogo/tool/result/account. Solo dopo approvazione design authority `PRODUCT.md`/`DESIGN.md`/`WORLD.md` aggiornati coerentemente.

**Fase D (redesign reale):** usare `design-impeccable`, cambiare IA/UX/UI condivisa da capo senza distruggere URL, SEO, account, privacy, funzionalità/download, forme supportate e accessibility. Real browser flows, form states, focus/dark/light, screenshot before/after, no overflows, real performance. Nessuna finta preview della produzione.

**Fase E (release e handoff):** nuovi QA su commit finale, canary/staged deploy quando autorizzato, rollback, documentazione dei 43 ticket aggiornata solo sulle prove, commit non-force e workspace pulito. Se il redesign non è ancora approvato, **fermarsi dopo il grilling** e non creare WIP extra.

### Raccomandazione di cadenza, NON nuova lista di microticket

**Cinque risultati al massimo per una futura finestra di due settimane**, subordinati alle risposte: (1) posizionamento e 3 jobs validati, (2) wireframe e nuova direzione visuale approvati, (3) UX core di un percorso completata e misurata, (4) donor spike solo per una tecnologia critica, (5) primo rollout controllato senza regressioni. Distinguere prototipo utile e rifacimento completo finito; il full redesign potrebbe richiedere più fasi di implementazione e non va promesso in due settimane senza scope.

## 10. SCRIPT DI AVVIO DA INCOLLARE NELLA NUOVA CHAT

> Riprendi Strumentini.it **non come implementatore di altri ticket**, ma come revisore CEO/product/CTO/UX che metterà in discussione tutto prima di fare nuove scelte. Repo locale `/Users/domenico/Code/Strumentini.it`, produzione `https://strumentini.it`, GitHub `domenicomassafra/strumentini-it`. **Leggi INTEGRALMENTE** `docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md` e `docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md`, poi gli altri quattro documenti citati. Verifica con le fonti attuali Git, Worker Cloudflare, codice, UX browser desktop/mobile, ticket e fonti concorrenti/donor. **Non farmi domande finché non hai completato e presentato una valutazione critica fattuale dell'intero prodotto.** Voglio capire se abbiamo sbagliato prodotto, priorità, architettura, design e metodi di sviluppo; non difendere le scelte precedenti per inerzia. Considero l'UI attuale troppo basic e da AI slop; un **REDESIGN COMPLETO** è un requisito del nuovo ciclo, ma *come* farlo lo decidiamo dopo audit e grilling. Usa la vera skill DStack **`plan-grill-with-docs` / `plan-grilling` / `plan-domain-modeling`**: decision tree, frontier completa, round numerati con raccomandazione e pausa per mie risposte, note/ADR dopo conferma. Dopo il grilling, proponi 3 direzioni artistiche realmente diverse e **solo dopo approvazione** implementa un redesign completo con `design-consultation`, `design-impeccable`, QA e staged release. Non riaprire WIP, non alterare produzione o Gold, non creare decine di nuovi ticket. Mantieni separati 43 originali OPEN e il lavoro Git già concluso. **Nel primo output consegna audit, verdict, scorecard provvisoria verificata, differenza fra ciò che funziona e ciò che è slop, donor risk/benefit, decision tree e soltanto poi il primo round di grilling.**

---

**Criterio di fine fase corrente:** questo documento è versionato su `main`; `origin/main` sincronizzato, `git status` pulito, uno solo worktree/branch, Cloudflare ancora sulla precedente versione di codice `95be886` (non serve deploy per Markdown); ticket invariati **43 OPEN**. Qualsiasi divergenza osservata nel checkpoint finale va annotata, NON nascosta.
