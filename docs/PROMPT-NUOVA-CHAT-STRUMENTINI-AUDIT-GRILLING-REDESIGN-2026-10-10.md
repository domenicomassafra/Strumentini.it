# PROMPT CANONICO — Nuova chat Strumentini.it: audit totale → grilling → redesign completo

> **Per chi avvia la nuova chat:** leggi prima `docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md`. Contiene anche il prompt d'avvio rapido, la rivalutazione preliminare criticabile, l'anomalia API documentata e la verifica Git/cloud live del checkpoint più recente. Questo documento rimane il mandato operativo integrale.

> **Destinazione:** incollare il testo di questo documento in una NUOVA CHAT con accesso al repository e agli strumenti di analisi. È il mandato operativo aggiornato del proprietario. Questo file prevale sui prompt brevi nel vecchio handoff in caso di divergenze, ma **non** abroga le condizioni di sicurezza, le prove di rilascio e le decisioni effettivamente documentate.

---

## MANDATO DEL PROPRIETARIO — LEGGI PRIMA DI OPERARE

Sei incaricato di fare una **revisione radicalmente critica e completa di Strumentini.it**, prima strategica e tecnica, poi di intervistarmi tramite la **skill DStack `plan-grilling`**, preferibilmente orchestrata da **`plan-grill-with-docs` + `plan-domain-modeling`** per conservare le decisioni. **SOLO DOPO** che hai studiato davvero il progetto e noi abbiamo chiarito le decisioni principali, il percorso dovrà portare a un **redesign integrale, sostanziale e implementabile dell'esperienza**, non a una passata di colore o a un'altra homepage generica.

Il mio giudizio sull'interfaccia attuale è molto negativo: **la trovo troppo basic, generica, ripetitiva, artificiale, da template/AI slop**. Non devi trattare il layout corrente come il sacro design system da ritoccare superficialmente. Devi capire perché siamo arrivati lì, cosa vale salvare e cosa andrebbe rifatto. **L'eventuale rispetto del brand, dei dati, delle funzioni funzionanti, dell'accessibilità e dei contratti tecnici è obbligatorio; la forma visiva attuale NON è intoccabile.** Il redesign è già una **direzione voluta**, non devi ridomandarmi se desidero un redesign. Devi invece propormi e farmi scegliere *che prodotto, quale struttura e quale direzione visiva*.

Non partire dalla premessa che 269 strumenti siano un vantaggio, che il primo prodotto debba rimanere un workspace persistente, che il precedente design sia buono o che continuare tutti i 43 ticket sia il piano giusto. Voglio anche che tu dimostri se **ci siamo persi librerie, interi repository, donor o fork** che avrebbero evitato settimane di codice e test. Esigi evidenze: niente complimenti generici e niente gate o certificazioni inventate.

### Regole di esecuzione inderogabili

1. **Audit prima, domande dopo.** Prima della sessione di grilling raccogli autonomamente i fatti dal filesystem, codice, sito LIVE, repository, catalogo, ticket, fonti esterne correnti. Non chiedere a me dati che puoi verificare tu. Non dare il via al grilling finché non hai un quadro argomentato delle principali contraddizioni e scelte aperte.
2. **Prima analisi, poi decisioni, poi redesign.** Non iniziare a riscrivere l'interfaccia, aprire decine di ticket, modificare font/colori, sostituire codec o fare un'altra campagna di test mentre stiamo ancora decidendo che prodotto deve essere. L'attuale produzione resta operativa. Quando approveremo il nuovo concept, il redesign va **davvero realizzato, end-to-end**, e non ridotto a documentazione.
3. **Fatti ≠ interpretazioni ≠ decisioni.** Ogni valutazione importante deve indicare se è `VERIFICATO` (codice, screenshot, test, deployment), `SUPPORTATO MA NON COMPLETO`, `IPOTESI`, `BLOCCATO` o `DECISIONE DA PRENDERE`. La mia percezione "sembra AI slop" è un input di gusto da analizzare e tradurre in difetti concreti, non la pretesa di una misurazione già svolta.
4. **Niente fake DONE/Gold.** I 17 ticket conclusi con refusal non equivalgono a tool consegnati. I test desktop con viewport 390 px non provano Safari su iPhone fisico o Chrome su Android fisico. Cloudflare `100%` non significa certificazione Gold. Non confondere codici esistenti, build, GitHub, servizio live e release gate.
5. **Proteggi produzione e proprietà.** Niente deploy automatico di prototipi non approvati; niente D1 migration, DNS, segreti, credenziali, dati dell'utente o rompere l'account. Niente `git push --force`, reset distruttivo, ripristini di vecchi branch o modifiche a progetti non pertinenti. Il nuovo agente deve offrire rollout/rollback tracciabile per ogni rilascio approvato.
6. **Rallentamento e processo sono una parte dell'audit.** Non aggiungere audit su audit senza una decisione concreta. Se trovi un bug ad alta severità in produzione, isolalo, documentalo e proponi la minima correzione sicura; non far partire un altro ciclo di refactor globale.
7. **Non delegare il ragionamento al proprietario.** Prepara un'opinione forte e verificabile: dire "dipende da te" a tutte le domande non è utile. Per ogni decisione sottoponi una raccomandazione e alternative con costi e compromessi.
8. Scrivi e conduci la sessione **in italiano**, con linguaggio professionale e concreto, nessuna retorica sull'AI, nessuna adulazione e nessun piano da 100 microtask. Il lavoro dovrà essere comprensibile anche a un agente che non ha letto questa chat.

## CONTESTO DI PARTENZA — DA RIVERIFICARE, NON INVENTARE

Repository canonico: `/Users/domenico/Code/Strumentini.it`
GitHub: `https://github.com/domenicomassafra/strumentini-it`
Sito live: `https://strumentini.it`
Sorgente realmente distribuito su Cloudflare il 10/10/2026: **`95be886`**.
Commit GitHub `main` successivo, con SOLI documenti di handoff/receipt: **`de2b1bc`**.
Worker live noto: `strumentini`, versione Cloudflare **`6a1a5eaf-1091-45a7-a7c8-635c321877be`**, 100% dopo canary 90/10. Non presumere che rimanga così senza una nuova interrogazione.

Ultimo conteggio verificato: **327 ticket**, **284 conclusi** (di cui **17 refusal**, NON shipped), **43 aperti**, suddivisi in **5 ready, 31 dependency, 2 official-source, 5 physical-device**. **269 tool nel catalogo**, build **291 pagine**, regressione **233 suite e 1.791 test**, `astro check` **1.949 file / 0 errori / 0 warning**, deploy static/dry-run PASS. Il `release:validate` era **BLOCKED** con 0 errori strutturali e 7 gate (Gold/source receipt vecchie, 10 tool senza Gold, 2 non Gold, prove fisiche e rollback source-bound), non diventato PASS solo perché il Worker è live.

Nell'ultima fase i quattro workstream #047 / #056 / #212 / #237 hanno realizzato miglioramenti veri; nessuno dei quattro ticket complessivi è stato falsamente chiuso. **#047: criterio PNG esatto/lossy + alpha dimostrato, altri codec ancora incompleti**. La route sperimentale redaction #237 e l'OCR PDF #247 sono **DEV-only / 404 in produzione**. 14 worktree e 16 branch locali obsoleti sono stati eliminati dopo inventario; al checkpoint finale esisteva solo `main`, pulito e sincronizzato. Non "ripulire" nuovamente senza verificare lo stato attuale.

### Fonti obbligatorie, in ordine

**Stato operativo e verità sul codice**:

1. `docs/HANDOFF-2026-10-10-RELEASE-INTERMEDIA.md` — come siamo arrivati fin qui, inventario tecnico e dipendenze.
2. `docs/PENDING-GRILLING-2026-10-10.md` — classificazione degli aperti, domande, donor.
3. `.scratch/strumentini-expansion-20261005/PRODUCTION-RELEASE-20261010-95be886.md` — prove live, SHA esatto, rollback disponibile e limiti.
4. `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md`, `TICKET-DAG.md`, `issues/*.md`, e i generatori `ticket_dashboard.py` — perché un ticket è aperto, checkboxes originali e dipendenze autentiche.
5. `git log`, `git status`, `git worktree list`, `git branch -avv`, `git stash list`, `git ls-remote --heads origin`; `package.json`, `wrangler.jsonc`, `worker/**`, `src/**`, `tests/**`, `quality/**`, `scripts/**`. Verifica gli elementi significativi anziché leggerli come una montagna indifferenziata.

**Contratto di prodotto e design precedente (potenzialmente in conflitto)**:

6. `PRODUCT.md`, `DESIGN.md`, `design/WORLD.md`, `PRODUCT-SPEC.md`, `docs/00-product-vision.md`, `docs/01-positioning-and-novelty.md`, `docs/04-decision-history.md`, `docs/06-go-to-market.md`, `docs/08-product-definition-pre-design-synthesis.md`, `docs/10-tool-expansion-result-system-v2.md`, `docs/11-format-operation-matrix.md`, `docs/12-cloudflare-custom-domain-cutover.md` e design lane 04.
7. `src/styles/global.css`, `src/components/tools/tool-surface.css`, `src/layouts/BaseLayout.astro`, `src/components/shell/**`, `src/components/home/**`, `src/components/catalog/**`, `src/components/search/**`, `src/components/onboarding/**`, `src/components/account/**`, `src/components/tools/**`, `src/components/results/**` (per le directory davvero esistenti).
8. `src/pages/index.astro`, `/strumenti/`, `/cerca/`, `/categorie/`, `/onboarding/`, `/preferiti/`, `/impostazioni/`, `/accedi/`, le principali `/tools/<slug>/` e il risultato realmente scaricato.

**Attenzione alle CONTRADDIZIONI già osservate:** `docs/08-product-definition-pre-design-synthesis.md`, datato settembre, dichiara che il prodotto non è ancora implementato: era vero allora, è **falso** come descrizione attuale. `DESIGN.md` e `PRODUCT.md` parlano ancora di **200** tool, mentre il catalogo live ne mostra **269**: separare target originario, design intenzionale e produzione, non aggiornare ciecamente vecchi ADR storici. `DESIGN.md` attribuisce a `design/WORLD.md` la visual authority: ciò rappresenta **lo stato corrente da sottoporre a revisione**, non la proibizione di rifarlo dopo il grilling. Individua altre discrepanze fra promessa anonimo/local-first, stato account, HEIC pubblico, ricevute Gold e UI effettiva.

### Skill locali da usare nel momento corretto

- Per analisi critica da founder: **`plan-ceo-review`** (dopo aver letto la repo); se serve prima una tesi commerciale e di domanda reale usa **`business-office-hours`**.
- Per interrogarmi: **`plan-grilling`**; per tenere **glossario, decisioni e ADR** durante la sessione, usa **`plan-grill-with-docs`**, che richiama la precedente con **`plan-domain-modeling`**. NON chiamare `/grilling` o `/grill-me` come comando DStack se non esiste: sono alias dei donor, non la skill pubblica installata.
- Per riprogettazione visiva: **`design-consultation`** per scegliere una nuova direzione e fissare `DESIGN.md`/`design/WORLD.md` coerenti; **`design-impeccable`** per implementare l'interfaccia completa al livello di craft promesso; **`design-review`**, **`inclusive-design`** e QA browser per una verifica indipendente dopo l'implementazione.
- **Rispetta la semantica della skill `plan-grilling`**: costruisce un **albero di decisioni** e, ad ogni round, presenta **l'intera frontier** di decisioni che hanno prerequisiti già risolti, con domande **numerate Q1, Q2...** e una **risposta raccomandata per ciascuna**. Non chiedere 40 domande tutte insieme ignorando le dipendenze; non farti bloccare da una decisione non pronta; ricostruisci la frontier dopo ogni risposta. La sessione termina solo quando l'albero è esplorato e l'utente conferma di condividere l'intesa. Le *domande di preferenza* sono nostre; i *fatti sull'app* li cerchi tu.

---

## FASE A — AUDIT PRELIMINARE TOTALE, AUTONOMO, PRIMA DI CHIEDERMI QUALSIASI COSA

Questa fase **non è facoltativa** e non è un altro banale `npm test`. Devi effettivamente conoscere il prodotto, non limitarti a ripetere il conteggio ticket. Puoi usare fino a quattro subagenti **se realmente disponibili** su compiti indipendenti e read-only; non spacciarli per attivi se non riescono a partire.

### A1. Audit del prodotto e dell'offerta reale

Inventaria ciò che un utente può veramente fare oggi: catalogo, categorie, strumenti maggiormente utili, ricerca, onboarding, salvati/recenti, account, login, preferiti sincronizzati, output/result/download, privacy, errori, file grandi, formati e limitazioni. Misura percorsi realmente riusciti e dove si inceppano, non solo il fatto che una route esista.

Classifica il catalogo in **(i) core realmente distintivo, (ii) commodity utile, (iii) accessorio per SEO, (iv) ridondante/duplicato, (v) incompleto/bloccato, (vi) pericoloso da promettere**. Per gli ultimi due gruppi spiega se disattivarli, renderli esplicitamente sperimentali o conservarli in un backlog separato. Non inventare "tool popolari" senza dati reali. Ragiona per lavori concreti (es. un freelance prepara un allegato PDF, una consulente sistema CSV, un marketer corregge un UTM) e verifica il numero di click, la qualità del risultato, la possibilità di tornare il giorno dopo con lo stesso contesto.

### A2. Audit visuale e UX *profondo* — obbligatorio

Apri `https://strumentini.it` nel browser e guarda/screenshot **desktop e mobile**, non soltanto il sorgente CSS. Almeno 320, 390, 768 e 1440 px (adatta se necessari); testa light e dark dove disponibili. Rappresentanti obbligatori: home, directory, categoria, search/command palette, onboarding, pagina di uno strumento leggero, pagina di uno strumento pesante (PDF/immagini), result/download/success/error, preferiti/workbench, login/account, impostazioni, vuoti/loading/abort e footer. Verifica *interazioni reali*, non fake click in immagini statiche.

Valuta con criteri specifici: **gerarchia e composizione, qualità tipografica, contrasto, griglia e ritmo degli spazi, navigazione, densità funzionale, leggibilità, call-to-action, relazione input→output, microinterazioni, leggibilità mobile, stati, consistenza, personalità memorabile, credibilità/trust, copy e categoria visiva**. Identifica ogni pattern riconoscibile come generic/AI slop: hero indifferenziato, banalità di copy, pill/gradient blob decorative, icone senza funzione, troppe card identiche, molto spazio senza contenuto, cornicette e ombre inutili, SEO text walls, trust badges ridondanti, form che sembrano demo generiche. **Non dare un punteggio senza osservazioni**; cita pagina/screenshot/componente/token CSS per ogni difetto significativo.

Guarda specificamente `src/components/home/HomeHero.astro`, `src/styles/global.css` e `design/WORLD.md`: la pagina attuale usa una hero con claim "Strumenti semplici, utili davvero.", blob/tiles decorativi e accenti blu/tinte numerose. È un **esempio concreto da giudicare**, non un requisito di preservazione. Verifica se la promessa vera di `PRODUCT.md` (workspace personale che ricorda gli strumenti) è percepibile o se sembra soltanto un catalogo di tool gratuiti. Il problema non si risolve con "più blu" o "raggio card più grande".

### A3. Audit strategico e concorrenza

Riformula e metti alla prova la tesi: **utility browser local-first, workbench personalizzato, directory SEO, business per freelancer/creator/agenzie**. Quale segmento pagherebbe, tornerebbe o consiglierebbe il prodotto? Quale parte è facilmente sostituibile con bookmark, browser, Raycast/Alfred, ChatGPT, Google, PDF24, iLovePDF, TinyWow, IT-Tools, CyberChef e prodotti italiani attuali? **Cerca concorrenti davvero correnti**, non supposizioni storiche. Segnala quali siti vincono per qualità di interfaccia, affidabilità e acquisizione. Distingui riferimenti visivi da competitor diretti.

Esamina SEO/discovery, canonical/sitemap/indexing, qualità pagine template, landing utili anziché testo inventato, internazionalizzazione, distribuzione, canali organici, analytics e privacy, limiti di monetizzazione. Nessuna promessa di ads: la scelta business va discussa, non automaticamente introdotta. Presenta tre possibili tesi prodotto **alternative autentiche**, con costi e un criterio falsificabile per 30 giorni.

### A4. Audit architettura, ticket e costo del progresso

Ricostruisci **perché siamo rallentati**: mix codice originale vs donor, dipendenze fiscali/HEIC/PDF/Office, numero di browser e matrici, tolleranza per refusal, QA fatto a ogni micro-edit, problemi del Mac quando girano simulatori e tanti agenti, WIP Git e merge storici. Non raccontare che il rallentamento è solo colpa della perfezione: quantifica dove possibile ore/linee/risultati, e indica i punti in cui abbiamo scelto di costruire componenti già disponibili.

Rileggi **tutti i 43 ticket aperti almeno attraverso il dashboard, e in dettaglio le cinque radici lavorabili, le due fonti e le cinque prove fisiche**; proponi la vera catena P0. Per ogni root scrivi cosa è stato verificato, cosa manca, cosa sarebbe sciocco implementare senza un donor e quale decisione sbloccherebbe valore reale. Distingui WIP attivo, backlog futuro e gate esterni: **in Git è stato eliminato il WIP storico**, ma gli originali non chiusi restano responsabilità del prodotto. Se la macchina è ancora pulita, non creare worktree per hobby.

### A5. Audit donor, fork, librerie, licenze e build-vs-buy

Cerca sul web/repos ufficiali aggiornati; confronta *almeno* jSquash (MozJPEG, WebP, OxiPNG, AVIF), Squoosh, libheif/heic-to, SVGO, Libre Convert/ZetaOffice/LibreOffice WASM, MuPDF.js, PDF.js, ed eventuali alternative **migliori e più recenti** da te scoperte. Prendi in considerazione anche donor per layout/component libraries e design systems **solo se consentono un prodotto coerente e non generico**.

Per ogni candidato serio documenta **licenza esatta e licenze transitive**, versione/recent activity, peso WASM/assets e tempi di warmup, capacità reale e sue assenze (WebP lossless effort, Office fidelity, multipagina/HEIC metadata, PDF secure redact), qualità API e test, CSP/COOP/COEP/SharedArrayBuffer, supporto static Cloudflare/offline, compatibilità worker/Vite/Safari, dimensioni memoria, costi/hosting, governance e rischio manutenzione. Non confondere la licenza MIT del wrapper Libre Convert con una possibile diversa licenza del runtime Office. MuPDF può richiedere conformità AGPL o licenza commerciale. Indica che cosa *elimineremmo* della codebase attuale se adottassimo il donor. Non trasformare questa ricerca in un nuovo coding sprint prima del grilling.

### A6. Audit operativo vero, produzione e sicurezza

Controlla `git`, CI/test, content hashing e source-fingerprint, stato Cloudflare live con `wrangler deployments status`, vecchia versione rollback, D1 auth, privacy file/client-only, lazy loading e fallback, tempo reale di avvio tool pesanti, 404 prototipi #237/#247, release gates Gold/source/browser/physical. Un checkout pulito o 1.791 unit test verdi **non** implicano un rilascio pronto di ogni altra funzione. Non leggere/mostrare segreti, non fare mutazioni D1.

### Output obbligatorio della FASE A, PRIMA delle mie risposte

Consegnami una **VALUTAZIONE INDIPENDENTE** lunga ma navigabile con:

1. **Executive verdict**: siamo nella direzione giusta? se sì, in cosa; se no, quali errori, con prove. Se l'idea non è forte, dillo.
2. **Mappa completa del prodotto**: cosa è live, cosa funziona bene, cosa non funziona/è incompleto, quali flussi sono importanti per utenti reali.
3. **Critica spietata ma concreta della UI**: screenshot/route, osservazione, impatto e radice di design, non complimenti. Indica se serve un rifacimento *di layout, IA, brand, interazione, tool workbench e content system*; io ti sto già chiedendo un redesign integrale.
4. **Scorecard** (0–5 con motivazione) per utilità, differenziazione, UX, UI craft, fiducia/trasparenza, perf/mobile, accessibilità, SEO, monetizzazione/retention, sostenibilità tecnica.
5. **Backlog triage**: cosa spedito, cosa sospendere/eliminare, quali originali # sono veramente bloccanti, e quali ticket vanno **re-scopati deliberatamente** anziché considerati finiti.
6. **Donor shortlist evidence-based**: almeno 3 candidati con utilità/costo/criticità e NO-GO chiaro.
7. **Contraddizioni nei documenti**: vecchio vs attuale, decisioni già prese vs ipotesi, certificazione vs live.
8. **Albero delle decisioni ancora aperte** per il grilling, con prerequisiti e raccomandazioni; solo a questo punto passare alle domande.

Se non riesci a osservare qualche superficie o fonte, annota `NON_VERIFICATO` e il motivo, non simularne la conoscenza. Conserva l'audit in un **documento versionato** e dammi anche un riassunto conversazionale; non spostare o sovrascrivere la documentazione di rilascio storica.

---

## FASE B — GRILLING CON ME, DOPO AVER VERIFICATO IL PRODOTTO

Avvia **`plan-grill-with-docs`** (che usa `plan-grilling` + `plan-domain-modeling`) **solo dopo** il report completo sopra. Presenta all'inizio quali fatti hai stabilito, in cosa hai cambiato opinione e su quali decisioni serve davvero la mia scelta.

Struttura l'albero di decisioni con prerequisiti espliciti. I macro-nodi obbligatori includono:

- **Identità e domanda reale:** per chi serve, quale job to be done primario, quale promessa credibile e perché tornare, top 3 use cases, italiano-first o internazionale.
- **Strategia business:** workspace persistente vs toolbox verticale di qualità vs directory SEO, retention, distribuzione, modelli di monetizzazione possibili e limiti espliciti.
- **Taglio scope:** quali 10–30 strumenti diventano "core" visibile, come cercare gli altri senza infliggere 269 card, cosa archiviare/noindex/downgrade, quali 43 ticket fermare con motivazione.
- **Donor e tecnica:** quale funzione va comprata/adottata/forkata, quale motore manuale dismettere, limiti di licenza e sicurezza, quali dipendenze sbloccano più prodotto.
- **UX e architettura informativa:** ingresso per ricerca, task, categoria o preferiti? differenza fra un utente anonimo e l'utente che torna? tra un tool individuale e una catena di workflow?
- **Brand ed estetica:** voglio un'interfaccia con carattere, moderna, professionale, chiara, distintiva, NON il generico SaaS gradient/pill/card. Metti sotto esame eventuali preferenze minimal black/white e alternative più editoriali o operative; non imporre un gusto senza mostrarmi differenze concrete.
- **Frontiere di prodotto:** iPhone/mobile-first, default light/dark, come mostrare privacy e rischi senza allarmismo o badge finti, livelli Gold, errori e rifiuti quando uno strumento non è supportato.
- **Esecuzione:** budget di tempo, soglia per dire STOP, owner di prodotto/release, due settimane/30 giorni, criteri di esito misurabile.

Per ogni round:

```
❓ Q1 — [Decisione già affrontabile]: [contesto, alternative chiare, costo del compromesso]
➡️ Raccomandazione: [tua proposta motivata su fatti osservati]

❓ Q2 — [Altra decisione già affrontabile, non dipendente da Q1]: ...
➡️ Raccomandazione: ...
```

La skill richiede **tutta la frontier affrontabile nello stesso round**; non fare una sola domanda artificiale per messaggio, né un form da 30 domande. Aspetta le mie risposte **prima** di avanzare nel design tree. Se emerge una contraddizione, confrontala col codice e proponi una precisazione. Salva glossario/decisioni/ADR dopo le risposte realmente date, non inventare la mia volontà. **Il grilling termina dopo conferma esplicita di shared understanding**, non dopo tre domande superficiali. Non scrivere ancora il redesign finito né fare deploy durante questa fase.

---

## FASE C — REDESIGN COMPLETO: ESITO CERTO, DIREZIONE DA DECIDERE INSIEME

Il rifacimento non è un "forse". **Il risultato finale deve includere una riprogettazione profonda e coerente di Strumentini.it**, eventualmente in fasi di rollout, con implementazione reale dopo accordo sulla direzione. La decisione aperta è *come* farlo senza perdere il prodotto funzionante, non *se* intervenire. Per questo voglio tre passaggi distinti:

**C1. Discovery e design alternative.** Dopo il grilling usa `design-consultation` e confronto di riferimenti autentici (es. precisione operativa di tool professionali, ritmo editoriale di prodotti curati, semplicità di SaaS ottimi; i nomi sono ispirazioni, non copie). Presenta **3 direzioni visive realmente diverse**, non tre variazioni di blu e radius, ciascuna con: home desktop/mobile, catalogo/search, tool operativo con input+result, account/workbench, palette/tipi/spazi/copy e stati. Mostra 2–3 veri mockup/board per variante **se gli strumenti e il contesto lo consentono**; altrimenti wireframe browser fattuali. Spiega quale scegli e perché. Non copiare fedelmente i siti citati. Il confronto deve contemplare almeno una variante più **minimalista e rigorosa**, una più **editoriale e riconoscibile** e una più **task/workspace-driven**: tutte ad alta qualità, non template AI.

**C2. Contratto di progetto approvato.** Dopo le mie decisioni, crea o aggiorna coerentemente la nuova design authority (`DESIGN.md`, `design/WORLD.md`, `PRODUCT.md`, `PRODUCT-SPEC.md` **solo per ciò che è realmente deciso**); specifica le invarianti da preservare (SEO URLs/redirect, correttezza engine, download, file locali, privacy, account, accessibilità, performance) e ciò che sostituirai senza nostalgia (hero, pattern card, navigazione, gerarchia, tipografia, componenti condivisi). La qualità va descritta con token/scale/spec e con veri componenti esemplari, non con aggettivi come "premium"/"modern".

**C3. IMPLEMENTAZIONE END-TO-END dopo approvazione.** Usa `design-impeccable` e sviluppo frontend: ricostruisci coerentemente **shell/header/footer**, homepage, directory/categorie, ricerca/command palette, tool wrapper/operazione/risultato/download, onboarding, workbench/recent/favorites, account/login/settings, informative/trust/error/empty/loading/success e soprattutto i dettagli dell'interazione mobile. Se i 269 tool condividono template, migliora i **componenti a monte** anziché incollare codice su 269 pagine. Mantieni e migliora gli elementi funzionanti; evita landing bellissima con strumenti ancora brutti. Esigi precisione di copy italiano: una promessa concreta, CTA utili, errori leggibili, privacy verificabile. Il redesign deve essere una **nuova esperienza completa**, non semplicemente una libreria di cards.

**Floor di accettazione visuale e funzionale**:

- 320/390/768/1024/1440 px, light/dark se disponibili, focus e tastiera, target touch, prefer-reduced-motion, WCAG 2.2 AA dove misurabile, semantica e screen reader.
- Nessuna rottura delle route storiche o redirect, canonical/metadata/sitemap/structured data, account local state e anonimato, tool che già completavano task, copy non misleading.
- Nessuna perdita di dati/file né upload accidentali; heavy tool e file selector devono continuare ad avere progress/cancel, output verificato e fallback/refusal corretti.
- Screenshots **before/after** per i template rappresentativi e almeno 3 veri user journey mobile+desktop completati; criteri di design QA non basati solo sull'opinione del nuovo agente.
- Unit/regression, `npm run check`, build, `npm test`, browser multi-engine rappresentativi **a batch**; performance iniziale/size e regressioni UX definite prima di modificare codice. Test fisici dichiarati NOT_RUN se non eseguiti.
- Release in preview/canary prima di un'eventuale promozione 100% autorizzata, rollback pronto; non trasformare redesign in scorciatoia per pubblicare PDF security non certificata.

Puoi **attuare realmente il redesign quando siamo arrivati a decisioni confermate e ti autorizzo all'esecuzione**. Non sostituire i consensi futuri su scelte non ancora definite con l'istruzione presente. Non fermarti a "preparerò il piano" se la fase di implementazione è stata approvata e gli strumenti lo consentono.

---

## FASE D — ROADMAP, REALISMO, COSTI E CONSEGNA FINALE

Una volta conosciuti il prodotto e le mie decisioni, dammi una roadmap **massimo cinque outcomes**, non 100 task, che distingua:

1. **Prodotto live da preservare** e hotfix veri.
2. **Redesign da fare obbligatoriamente** con una sequenza ragionevole di componenti, percorsi e QA, non un big-bang privo di rollback.
3. **R&D donor** da valutare soltanto se giustificata da bisogno reale e criteri `go/no-go`.
4. **43 pending originali**: cosa chiudere quando, cosa lasciare deliberatamente in attesa, cosa de-scope con ADR, cosa rifiutare in modo trasparente.
5. **Misurazione del prodotto**: 3–5 metriche semplici (time to first result, completamento job, scelta/search vs carte, ritorno d'uso, velocità, rifiuti/errore per tool), compatibili con privacy e dati effettivamente disponibili; no numeri inventati.

Per ogni outcome specifica: risultato visibile all'utente, ipotesi che verifica, decisione richiesta, costo/tempo **stimato e dichiaratamente stimato**, dipendenze, rischio, donor alternativi, criteri di accettazione, rollback e cosa togli dal backlog per fare spazio. Un progettino con 269 tool e tantissimi tests NON è validato commercialmente per questo solo fatto.

### Formato del primo messaggio del nuovo agente

**Prima di interrogarmi**, presenta:

1. **Che cosa hai realmente visto e verificato**, incluse route e dati attuali. Se manca qualcosa, elenco `NON_VERIFICATO` e come verificarlo.
2. **I cinque principali errori del progetto**, spiegando se sono errori di strategia, UI/UX, architettura, release/QA o scope.
3. **La tua tesi su quale Strumentini.it dovremmo costruire**, sostenuta da alternative e controargomentazioni.
4. **Come dovrebbe differire radicalmente il redesign** dal presente, senza fingere che hai già implementato o mostrato mockup non esistenti.
5. **Decision tree e primo round di `plan-grilling`**, con raccomandazioni. Chiedi solo decisioni che dipendono da me e i cui prerequisiti sono già verificati.

### Quando dichiarare completato il nuovo mandato

Non quando hai scritto molte pagine, ma quando: **audit fattuale concluso → grilling condiviso → design direction approvata → design system/IA nuova → redesign reale implementato e verificato nel perimetro autorizzato → backlog aggiornato per evidenze → produzione distribuita o esplicitamente bloccata per motivi fondati → report finale e nessun WIP non consegnato**. Tieni separata la fine della **fase decisionale** dalla fine della **fase implementativa**: se attendo una mia risposta del grilling, interrompi lì la modifica al codice e fai la domanda corretta.

Non finire questa discussione con "abbiamo 43 ticket". Aiutami a scegliere un **prodotto eccellente**, non semplicemente un repository più grande.
