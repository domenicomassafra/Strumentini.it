# Strumentini.it — incarico definitivo: completare tutti i ticket e il pacchetto operativo

<external-worker-contract>
Sei l'agente coordinatore lanciato personalmente dall'owner su ChatGPT. Operi nella repository /Users/domenico/Code/Strumentini.it tramite Chat On Steroids. Esegui l'incarico autorizzato e consegna gli artefatti reali, non un piano di ciò che potresti fare.

UNICO SCOPO: completare il pacchetto di pianificazione/esecuzione futura del prodotto: aggiornare e riconciliare tutti i ticket esistenti, creare i ticket mancanti e futuri pertinenti, specifiche, roadmap e prompt. Usa quattro subagenti NATIVI di Chat On Steroids. Non implementare il prodotto, non modificare codice/test applicativi e non distribuire produzione in questo incarico.

Authority: le istruzioni esplicite più recenti dell'owner e i contratti locali prevalgono. Il grilling è concluso e confermato. Non ricominciare audit generale o domande già risposte. Una nuova ambiguità fattuale si ricerca; una scelta futura non approvata si rappresenta con un gate preciso, continuando il resto del pacchetto.

Ownership: sei l'unico scrittore/integratore dell'archivio ticket e delle authority condivise. I quattro specialisti hanno directory disgiunte per proposte/documenti. Preserva diff concorrenti, non revertire altro lavoro. Non creare worktree, branch, repository o sistemi di ticket paralleli senza necessità provata. Nessun reset/clean distruttivo, force push, stash occulto, acquisto, upload di documenti privati o modifica di servizi terzi.

Prove: completed/Gold/live sono stati distinti. Non chiudere ticket implementativi perché hai scritto un piano. Non cambiare checklist, receipt o source fingerprint per far passare gate. Un refusal amministrativo non è una capacità spedita. La consegna è completa quando il pacchetto ha copertura e integrità verificabili.

Persistenza: continua fino a completare l'incarico. Non fermarti a un numero arbitrario di ticket, a una microtranche o alla fine di un singolo worker. Aggiorna il checkpoint del run per poter riprendere. Se un limite reale impone di finire, salva un handoff completo PARTIAL con prossimo passo esatto; non inventare un blocco globale mentre rimane lavoro indipendente.

Terminal handoff: come ultima scrittura filesystem della tua sessione, crea la response adiacente indicata in fondo, con stato veritiero, commit coperto, diff, prove, residui e prossima azione. I quattro subagenti usano esclusivamente task/messaggi/risultati nativi e non response Prompt2Prompt. Dopo la response, rispondi soltanto con il suo percorso assoluto.
</external-worker-contract>

## Missione e significato di “tutto”

L'owner vuole un prodotto gratuito utile ogni giorno o settimana a chi lavora al computer, soprattutto in ufficio, utile anche alle persone comuni. Vuole un catalogo ampio, un'esperienza eccellente e un'evoluzione concreta verso editor PDF/immagini professionali. Token quasi illimitati e riuso di progetti esistenti servono ad accelerare, non a moltiplicare artefatti inutili.

“Tutti i ticket presenti e futuri” significa:
1. Leggere e riconciliare ogni originale nel backlog attuale, compresi completed e refusal. Baseline 327, ma ricalcola.
2. Rappresentare ogni strumento del catalogo (baseline 269) con capacità base, prove/gap, evoluzione avanzata pertinente e ticket responsabili.
3. Coprire tutte le decisioni confermate OWN-01–20, i difetti concreti dell'audit, le famiglie/formati e i workflow richiesti.
4. Creare ticket reali per il lavoro mancante e per evoluzioni motivate; nessun titolo vago che nasconde molti lavori, nessuna quota numerica artificiale.
5. Migliorare la qualità del pacchetto attraverso riconciliazione di scope, AC, fonti, donor, dipendenze e prompt. “Migliorare tutto” qui non autorizza cambiamenti applicativi.

Il prodotto non è limitato ai PDF e non viene ridotto a 20 utility. Il lavoro base deve preservare e completare capacità utili dell'intero catalogo; la priorità concentra l'ordine, non cancella il resto.

## Repository, avvio e letture obbligatorie

Repository nativa: /Users/domenico/Code/Strumentini.it.
Leggi i contratti più vicini. Cerca prima tasks/index.md: se esiste, leggi goal/plan/worklog correnti; se manca, usa il checkpoint locale qui indicato, senza importare task DStack globali estranei. Per Chat On Steroids risolvi gli approved roots/mapping reali; non presumere che /domenico sia la root della repo senza enumerare i percorsi.

Prima di qualunque mutazione:
- git status --short --branch, git log -5 --oneline, git worktree list;
- leggi integralmente docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md;
- leggi integralmente docs/HANDOFF-FINALE-RIVALUTAZIONE-E-GRILLING-2026-10-10.md e docs/PROMPT-NUOVA-CHAT-STRUMENTINI-AUDIT-GRILLING-REDESIGN-2026-10-10.md: sono il mandato precedente, con il delta confermato in questo prompt;
- leggi integralmente docs/AUDIT-INDIPENDENTE-STRUMENTINI-2026-10-10.md, docs/audit-2026-10-10/README.md e ticket-triage.md; guarda le screenshot rappresentative per comprendere le cause del redesign;
- leggi CONTEXT.md e docs/PENDING-GRILLING-2026-10-10.md;
- leggi PRODUCT.md, PRODUCT-SPEC.md, PRODUCT-MARKETING-CONTEXT.md, IMPLEMENTATION-PLAN.md, DESIGN.md, design/WORLD.md;
- leggi docs/10-tool-expansion-result-system-v2.md e docs/11-format-operation-matrix.md;
- leggi .scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.json, CURRENT-TICKET-DASHBOARD.md, TICKET-DAG.md, SKILL-ROUTING.md, validate_backlog.py e ticket_dashboard.py;
- leggi TUTTI i file issue originali, non solo i titoli. I quattro specialisti possono aiutare a partizionare la lettura, ma la copertura deve essere comprovata e tu integri i risultati;
- leggi package.json, manifest/catalog generation, runtime/result/handoff/persistence/account e gli engine interessati quanto basta a scrivere ticket precisi;
- rileggi le note più recenti degli originali #047/#056/#115/#117/#212/#229/#237/#246/#247/#277/#278/#280/#281;
- usa quality/oracles/, quality/fixtures/, quality/receipts/, research/lanes/06-09*, research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md e spikes/ come evidenza da riutilizzare.

I run settembre in tasks/prompt2prompt/ sono storici secondo il loro README. Il nuovo run ha un ledger che li riconcilia: non rilanciare vecchi incarichi/worktree. Eventuali nuove mutazioni concorrenti richiedono lettura fresca, non riscrittura cieca.

Ordine authority: ultimo owner/OWN-01–20 e questo perimetro > nuovi documenti di decisioni confermate > originali AC e evidenze > product/design aggiornabili > raccomandazioni storiche. I fatti dell'audit rimangono fatti al loro snapshot; le proposte di restringere catalogo o sospendere fiscalità non sono decisioni dell'owner.

## Quattro subagenti NATIVI — Chat On Steroids

Usa le capacità realmente esposte da Chat On Steroids. Il contratto osservato durante la preparazione aveva un tool agents del connettore Core, talvolta esposto anche via Plugins, con action=spawn|message|status|finish. Il nome esatto può cambiare namespace; scopri lo schema corrente invece di inventare comandi.

Procedura:
1. Interroga agents action=status una volta per conoscere worker adatti riutilizzabili.
2. Se ci sono sleeping worker pertinenti, riattivali con message, mantenendo quattro ruoli distinti. Altrimenti spawn con quattro task in un'unica richiesta, nei limiti reali dell'app. Ometti model e reasoning_effort: valgono i default salvati, nessuna domanda all'owner sui modelli.
3. Conta QUATTRO specialisti oltre al coordinatore. Se gli slot simultanei sono meno di quattro worker, usa disponibilità/riuso nativi per completare i quattro incarichi senza mentire sulla concorrenza; niente processi terminali che simulano subagenti.
4. Registra ID/ruolo/write set nel checkpoint. Usa messaggi nativi per correggere o richiedere approfondimenti. I risultati arrivano sul canale nativo: non fare polling ripetuto o inventare report mancanti.
5. Ogni worker termina con RESULT / CHANGES / VALIDATION / BLOCKERS nel canale nativo, indicando i propri documenti, scope letto e residui. Non crea *.response.md e non lancia altri subagenti.
6. Integra serialmente ogni contributo accettato. Un report worker non sostituisce verifica di file, diff, riferimenti e prove.
7. Se la capacità agents è realmente assente/disabilitata, documenta il nome/capability mancante e l'esatta azione abilitante. Completa intanto il lavoro indipendente consentito, ma lascia il requisito “quattro nativi” incompleto; non dichiarare quattro agenti partiti.

Struttura indicativa della richiesta nativa, da adattare allo schema osservato:

~~~json
{
  "action": "spawn",
  "context": "Repo /Users/domenico/Code/Strumentini.it. Planning/tickets only. Leggi owner decisions e audit. Nessun codice, test, dipendenza, deploy o acquisto. Scrivi solo nella directory assegnata. Ritorna handoff nativo RESULT/CHANGES/VALIDATION/BLOCKERS. Nessun subagent ulteriore.",
  "workers": [
    {"label": "Prodotto e copertura", "task": "Incarico A definito sotto"},
    {"label": "UX e redesign", "task": "Incarico B definito sotto"},
    {"label": "Motori e donor", "task": "Incarico C definito sotto"},
    {"label": "Qualità e gate", "task": "Incarico D definito sotto"}
  ]
}
~~~

### A — Prodotto, catalogo, livelli e fiscalità

Write set esclusivo:
tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/product/.

Leggi il catalogo completo e gli originali di prodotto/famiglie/Italia; ricostruisci bisogni/operazioni, base/avanzato, gap, refusal, capacità utente. Definisci due percorsi fiscali (privati/dipendenti e partite IVA), annualità e fonti per tutti i calcoli offerti; note normative verificate da fonti ufficiali, nessun dato inventato. Non sospendere fiscalità/CF per seguire la vecchia tesi del reviewer.

Output: proposta requisito→strumento→ticket per tutto il catalogo, perimetro base/avanzato, ordine PDF→immagini e crescita dati, ticket mancanti/aggiornamenti motivati, esatta disposizione di ogni famiglia e normative. Niente nuova coda ufficiale né assegnazione autonoma di ID finali.

### B — UX, redesign, motion, sound, mobile

Write set esclusivo:
tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/design/.

Leggi screenshot e componenti reali. Progetta ticket per tre alternative davvero diverse, confronto e scelta owner, design system/IA e rifacimento di tutte le superfici; non scegli palette/font definitivi e non implementi mockup/prodotto ora. Copri file-first/search-first, picker mobile, risultati verificati, azioni consecutive, recenti/preferiti, memoria locale opt-in, suggerimenti spiegabili, account opzionale, personal brand discreto, motion e sound opt-in.

Obiettivo mobile: quasi tutto/possibilmente tutto anche nell'avanzato. Traduci questo in AC per lavori reali e in studi misurabili di memoria/performance; non etichettare desktop-only per comodità. Specifica drag alternativa touch/tastiera, reduced-motion, contrasto/focus/semantica e output/download.

Output: proposte ticket per ogni template/stato/percorso, prototipi futuri con floor condiviso, rubric visuale osservabile e gate di scelta non globale, aggiornamenti DESIGN/WORLD da integrare solo per decisioni confermate.

### C — Motori, architettura, donor, fork e costi

Write set esclusivo:
tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/engineering/.

Leggi engine/runtime/worker/persistence interessati, dipendenze installate, provenance, spike e shortlist. Per ogni classe seria confronta native/local reuse/installed dependency/maintained donor/commerciale/minimo delta. Cerca ulteriori donor per PDF ricco, immagini con layers/masks/history, Excel/CSV/tabelle, OCR, Office e fonti/calcoli italiani.

Riusa prove esistenti e aggiorna solo evidenza decisiva: licenza diretta/transitiva/asset/codec, versione/pinning, manutenzione, API/capacità mancanti, dimensioni reali, memory/mobile, CSP/COOP/COEP/worker/hosting. Codice proprietario è vincolo. Fork e reverse engineering non autorizzano copia di sorgente chiuso. Nessun clone massive/install/patch/fork remoto/acquisto in questa lane. Scelta commerciale con proposta e gate.

Output: donor matrix evidence-backed, cosa sostituisce, ticket di adozione/fattibilità/migrazione con go/no-go, local/server e cost ceiling zero, lifecycle file server, limiti e fallback trasparenti, frontend e backend freshness corrette. Non riscrivere lo stack per gusto.

### D — Qualità, sicurezza, backlog e release futura

Write set esclusivo:
tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/quality/.

Leggi tutti i 43 open, i 17 refusal e i contratti/generatori di qualità. Parti da #237 sicurezza PDF, #115/#117 fonti, #229/#277/#278/#280/#281 hardware, badge/fingerprint/telemetria/account. Registra prova corrente vs storica e prossima azione per ogni gate. Definisci acceptance della pianificazione e della futura implementazione senza confonderle.

Output: checklist completa originali/gate/AC/prove, proposte di ticket P0, corpus/validator indipendenti, matrice desktop/mobile/fisica, verifiche per batch e release scope, piano CI e rollback futuri, controlli di copertura/DAG e zero falsi “done”. Device non disponibile limita un preciso AC futuro, non la possibilità di scrivere il ticket.

### Coordinatore — integrazione unica

Tu leggi i quattro report, riconcili le sovrapposizioni e assegni gli ID serialmente. Sei l'unico writer delle issue ufficiali, delle spec condivise e delle proiezioni. Tutti possono leggere; nessuno modifica il write set di un altro. Non delegare la responsabilità della copertura finale e non chiudere dopo la sola ricezione dei report.

## Skill routing proporzionato

Risolvi le skill correnti dai root esposti (filesystem /Users/domenico/.codex/skills, /Users/domenico/.agents/skills o root /skills realmente disponibile). Leggi il SKILL.md prima di applicarlo. Nessuna installazione automatica o alias donor obsoleto.

Per questo incarico:
- plan-domain-modeling: lessico confermato, CONTEXT solo glossario; ADR solo trade-off significativi e confermati;
- plan-spec e plan-tickets: specifica/traceability, tranche verticali, constraints, AC, DAG e coverage; il grilling è già svolto. La richiesta esplicita dell'owner autorizza scrittura/aggiornamento locale senza una nuova approvazione per ogni ticket;
- plan-ceo-review, plan-design-review, plan-eng-review e plan-devex-review: controlli mirati dei contributi, evitando un secondo ciclo di audit generale;
- code-architecture-review, research-primary-sources, security-audit, inclusive-design, interaction-design, communication-error-messages: dove la lane ne beneficia concretamente, in sola lettura/pianificazione;
- design-impeccable, design-review, qa-browser e code-implement: routing dei ticket/prompt FUTURI; nessuna implementazione anticipata;
- design-consultation solo se esiste come skill corrente; altrimenti usa la capability design realmente disponibile e classifica l'alias mancante, senza fermare il resto;
- Prompt2Prompt è il trasporto owner→coordinatore di questo file, non il trasporto dei quattro nativi. Non auto-invocare la skill manuale dentro i worker.

Ponytail/native-first: prima di decidere un nuovo modulo/dipendenza, capire il percorso toccato, evitare speculazione e riusare codice locale, Web Platform e dipendenze mantenute. Il limite “planning only” vale anche quando una skill generica propone di implementare.

## Lavoro obbligatorio in ordine

### 1 — Delta e registro requisiti

Consolida OWN-01–20 nel sistema di spec esistente con ID stabili, evitando collisioni con C-/US-/AC-/DEC- storici. Puoi usare un namespace distintivo per questa revisione, documentato; non rinumerare storici. Distingui:
- decisione confermata;
- specificazione tecnica da provare con ticket;
- scelta visuale futura;
- acquisto futuro;
- evidence external/physical.

Scrivi l'esatta origine di ogni nuovo requisito; questo prompt e le risposte owner incorporate sono authority. Le raccomandazioni storiche non accettate non possono diventare constraint.

### 2 — Riconciliazione dell'intero archivio

Archivio unico: .scratch/strumentini-expansion-20261005/issues/.
Non creare una seconda queue “redesign-v2”, “base”, “advanced” scollegata. Aggiorna gli originali pertinenti, crea nuovi ID successivi in modo continuo. I 327 baseline devono avere ciascuno una disposizione in una matrice:
ID/path/hash letto; ruolo; lifecycle reale; livello; capacità; AC coperti/aperti; prova/date/fingerprint; aggiornamento necessario o nessuna modifica motivata; relazione con nuovi ticket.

Per i 284 completed non riscrivere tutti i file inutilmente: conserva storia e prova, classifica freschezza/nuove evoluzioni separatamente. Se un difetto attuale mostra una regressione, crea follow-up collegato o riapri con evidenza e spiegazione; non modificare una vecchia ricevuta per rappresentare la nuova realtà. Per i 17 refusal prevedi soluzione futura o limite esplicito per la capacità richiesta: non cancellare la refusal, non contarla come shipped.

Per i 43 open: leggi l'intero corpo e gli ultimi progress, riallinea con bisogno/donor/AC/mobile/fonte, assegna prossima azione, aggiorna dipendenze soltanto quando sono realmente sbagliate. Decomposizione base/avanzato conserva tutti gli AC e il significato di completamento del parent. Ogni requisito trasferito a un child deve essere rintracciabile e ancora aperto finché non verificato.

Il validator esistente usa blocked/completed/ready-for-agent e dipendenze numeriche a 1–3 cifre. Base/advanced/R&D/gate sono metadati separati, non lifecycle inventati. Non oltrepassare silenziosamente il parser; l'esempio 2.000 dell'owner non è una quota obbligatoria. Se fosse necessario estendere il sistema, scrivi un ticket specifico, senza modificare ora codice del validator.

### 3 — Catalogo, formati e livelli

Matrice uno-a-uno per tutti i manifest correnti:
tool ID/route/engine; job; input/output; base promesso; prova esistente; gap; advanced pertinente; locale/server; mobile/physical; ticket che copre; motivazione per eventuale advanced non applicabile.

Non confondere “non applicabile advanced” con dimenticato. Un convertitore semplice può restare semplice; gli editor pro non richiedono trasformare ogni utility in un IDE. Mappa anche famiglie non prioritarie: testo, date/business, developer/web, marketing, ricerca, archivi, audio/video, barcode e privacy, senza estrarre nuove feature casuali.

Matrice formato-operazione: PDF/JPEG/PNG/WebP/HEIC/AVIF/GIF/SVG/DOCX/XLSX/PPTX/CSV e altri formati già dichiarati. Distinguere direzione, multipagina/animazione, precisione, metadata, contenuto originale/overlay/raster, errori e grandi file. Nessuna “conversione universale” come AC.

### 4 — Ticket mancanti e miglioramento dei presenti

Copri almeno queste capacità, riusando ticket esistenti quando coprono davvero il lavoro:
- hotfix account Turnstile, contrasto, recenti realmente alimentati e copy coerente;
- ingresso file-first + search-first, riconoscimento locale formato e azioni compatibili, picker/touch/tastiera;
- catene di operazioni, risultati verificati, preview/download/reset/undo dove pertinente;
- cronologia locale e file opt-in, quota/eviction/storage denial, salvataggio/export/import sicuro;
- area personale adattiva spiegabile e stabile, niente upload/LLM obbligatorio;
- compressione/conversioni immagini/PDF, codec e fidelity Office, OCR e testo/tabelle;
- oscuramento irreversibile con verifica di non recuperabilità, distinto da overlay/annotazione;
- suite fiscale completa per scope dichiarato, fonti/anno/date, casi limite, freshness/rollover;
- editor PDF avanzato: page workspace, annotazioni, modifica testo originale/layout/font quando supportato, immagini, moduli, scansioni/OCR, redaction, export e history;
- editor immagini avanzato: layers, selections/masks, crop/resize/color, compositing, history/undo, file/project export, qualità/mobile/memory; capability non scelta va proposta con traccia, non aggiunta come promessa arbitraria;
- dati: Excel/CSV import/export, schema/formati, formule/celle/precisione quando previsti, pulizia, confronto/join/split/transform, workflow e automazioni;
- server opt-in solo gratis inizialmente: quota hard, retention/delete, no silent fallback, local equivalent o indisponibile;
- provenance/donor integration/upgrade, licenze commerciali eventuali, nessuna dipendenza “perché popolare”;
- quality architecture: freshness per scope incluso worker/backend, badge coerenti, telemetria privacy-safe realmente misurabile, CI utile, QA per batch, release/rollback future.

Ogni ticket implementativo è una slice con risultato osservabile e scope affrontabile in un fresh context. Gli epics coordinano children; non sostituiscono ticket di capacità. Prefactor solo se indispensabile alla slice successiva.

Template compatibile con l'archivio:
~~~text
# <ID> — <Titolo>
**What to build:** risultato concreto per l'utilizzatore
**Traces to:** requisito/spec/AC/OWN pertinenti
**Constraints:** privacy, licenze, precisione, mobile, risorse, budget e vincoli ereditati
**Blocked by:** ID numerici realmente bloccanti, o None
**Status:** ready-for-agent | blocked | completed (solo con prova)
**Suggested skills:** skill pertinenti
**Level:** base | advanced | feasibility | cross-cutting
**Priority:** motivata sul risultato e rischio
**Current evidence:** file/route/receipt/data/commit; fresh o historical
**Donor / reuse decision:** candidati, existing implementation, cosa sostituisce, go/no-go
Acceptance criteria numerati e verificabili
Verification: fixture, input→output, controllo indipendente, browser/device necessari
Failure / resource / cancel / recovery cases
External / owner gate: ragione, evidenza mancante, prossima azione, perimetro bloccato
Rollback / migration: proporzionato
Out of scope: confini veri
Execution prompt / related children: riferimenti risolvibili
~~~

Non generare AC soggettivi come “premium”, “completo”, “funziona ovunque” o soglie prestazionali inventate. Per limiti ancora ignoti, primo ticket misura e fissa soglie, secondo ticket applica; dipendenza esplicita.

### 5 — Redesign completo nei ticket

È obbligatorio. La direzione è ancora da scegliere e tu non la scegli al posto dell'owner. Prepara:
1. Discovery visuale con benchmark e tre direzioni: minimal/rigorosa, editoriale/riconoscibile, task/workspace-driven.
2. Ogni alternativa rappresenta gli stessi lavori con home desktop/mobile, catalogo/search, tool input/operazione/result/download, area personale/account e stati. Mockup interattivi futuri dove consentiti; immagini da sole non provano comportamento.
3. Rubric di confronto: gerarchia, tipografia, carattere, operatività, densità, mobile, movimento, errori/trust/accessibilità, output; differenze di IA/interazione, non sole palette.
4. Ticket di selezione owner della direzione; PENDING-OWNER solo quel gate.
5. Design system/IA/token/componenti esemplari dopo scelta.
6. Rifacimento shell/header/footer, home/directory/categorie/search/palette, wrapper/operazione/result/download, onboarding/personale/account/settings, privacy/informative/error/empty/loading/cancel/success.
7. Migrazione condivisa a monte, con tranche e compatibilità route/SEO/engine/local state; niente 269 patch CSS indipendenti.
8. Motion e sound: utili e riconoscibili, sound off/opt-in, reduced-motion e feedback alternativi, performance.
9. Mobile anche avanzato: file picking, Photos/Files, gesture non obbligatorie, tastiera/touch, progress/abort/share/export, grandi file e memoria misurati.
10. Before/after e input→output su almeno tre journey rappresentativi, 320/390/768/1024/1440, temi, keyboard/focus, WCAG 2.2 AA dove misurabile, browser e device reali.
11. Preview/canary/rollback e futura promozione autorizzata; nessuna scorciatoia per esporre #237 non certificato.

Non bloccare bug live, ricerca donor o completamento ticket perché la palette non è stata scelta.

### 6 — Roadmap e prompt futuri

Roadmap massimo cinque outcomes principali, con children sufficienti:
1. affidabilità base/live e percorso primo risultato;
2. redesign completo e area personale/file-first;
3. completamento delle famiglie base e suite fiscale con fonti;
4. avanzato PDF→immagini e crescita dati/automazioni;
5. prova mobile/qualità/operazioni e release per scope.

L'ordine può sovrapporre lavori indipendenti, senza dipendenze artificiali. Indica frontier reale, parallelismo possibile, un integratore, costo/tempo stimati e incognite. Non usare la ricerca utente come veto generico all'ambizione già scelta; misurazione e validazione sono attività utili, non nuova domanda sulla legittimità del progetto.

L'owner ha chiesto anche prompt futuri: prepara un bundle di prompt esecutivi per tranche/famiglie reali, derivato SOLO dal backlog integrato. Non serve un prompt diverso per ogni microticket se una tranche ha ownership coerente; ogni ticket deve avere un prompt applicabile o routing esplicito.

Per ogni prompt: repo/authority aggiornate, ticket ID/livello, prerequisiti da verificare, stato, scope/write set, comportamento richiesto, reuse/donor, AC, test pertinenti, verifica real consumer/output, cleanup/rollback, handoff e gate. Marca chiaramente:
- pronto a essere assegnato sotto un incarico implementativo autorizzato;
- attende scelta visuale;
- attende prova/fattibilità;
- attende acquisto/owner;
- attende physical/external.

Non presentare tutto il bundle come “lancia ora”. Non congelare prompt per child non ancora definiti da discovery: crea prompt per il lavoro di discovery e template parametrico per il downstream, con fonte/binding/regen espliciti. Native worker tasks sono messaggi, non file Prompt2Prompt manuali.

### 7 — Authority e artefatti finali

Aggiorna gli authority esistenti solo nelle parti decise; documenta ogni supersessione. PRODUCT/SPEC/MARKETING/IMPLEMENTATION possono recepire OWN; DESIGN/WORLD ricevono requisiti e stato di scelta pending, non una nuova skin inventata. Mantieni originali audit/receipt immutati.

Nello stesso archivio backlog crea o aggiorna, senza duplicare artefatti equivalenti:
- OWNER-DECISION-COVERAGE.md: tutti OWN con spec/AC/ticket;
- TICKET-RECONCILIATION.csv: tutti originali e disposition;
- TOOL-CAPABILITY-COVERAGE.csv: tutti tool e base/advanced/mobile/network/ticket;
- FORMAT-OPERATION-COVERAGE.md: compatibile con matrice canonica;
- DONOR-ADOPTION-MATRIX.md: evidenze/candidati/go-no-go/obblighi/costi;
- EXECUTION-PROMPTS.md + bundle files dove appropriato, con stato di assegnazione;
- PLANNING-ACCEPTANCE.md: comandi fresh, coverage, conti, DAG, zero duplicati e residui;
- ROADMAP.md root aggiornata, massimo cinque outcomes;
- TICKET-DAG.md e CURRENT-TICKET-DASHBOARD.{md,json} rigenerati con generatori esistenti;
- checkpoint/run COORDINATOR aggiornato con ownership e risultati.

Se questi nomi duplicano una fonte canonica equivalente, aggiorna quella e registra il mapping in PLANNING-ACCEPTANCE invece di creare un'altra fonte di verità.

## Verifiche di accettazione dell'incarico

Non rieseguire 1.791 test/check/build a ogni modifica documentale: non stai implementando. Esegui e leggi:
- git diff --check, incluse nuove superfici prima del commit;
- npm run tickets:check dopo rigenerazione;
- validator del backlog esistente con il comando effettivamente supportato;
- checks di link/ID/spec/AC/constraint tra documenti e ticket;
- confronto insiemi: tutti i ticket originali sono riconciliati, nessun ID perso/duplicato; tutti i manifest presenti hanno una riga; OWN-01–20 coperti; tutti AC/spec nuovi coperti; nessun ticket orfano;
- tutti i 43 originali baseline e i 17 refusal presenti nella riconciliazione, con aggiornamenti non fittizi;
- grafo aciclico, riferimenti risolvibili e almeno una frontier davvero eseguibile; dependency numeriche separate dai gate owner/device/source;
- nessuna modifica a sorgente/test/config/package/lock/quality receipt o produzione;
- tutti e quattro gli incarichi nativi realmente svolti e integrati, oppure requisito esplicitamente incompleto;
- tutti i prompt futuri esistenti, completi, non contraddittori e con gate/ownership corretti;
- ledger/matrice contain exact observed counts, not promised counts.

Puoi usare uno script locale inline/temporaneo per controllare documentazione/coverage e salvarne il risultato. Non aggiungere framework/nuovo toolchain o tests applicativi per documenti. Se il validator esistente presenta una regressione inattesa causata dai ticket, correggi i ticket; una modifica del validator/source rimane fuori scope e diventa un ticket delimitato.

Prima di dire completo confronta l'intero requisito del pacchetto con artefatti reali. Non basta un report di quattro worker o un DAG che passa.

## Politica per ostacoli e autonomia

Non chiedere conferma per letture, documenti, aggiornamenti ticket locali e rigenerazione già autorizzati. Non chiedere budget token, piattaforma, pubblico, modello economico o numero di tool da capo.

Un gate reale riporta: requisito esatto, cosa manca, tentativo/evidenza, alternativa compatibile, prossimo passo, owner e lavoro indipendente che continua. Licenza, fonte ufficiale, sicurezza PDF e prova fisica non si eliminano per ottenere un verde. NON_BLOCKING per la pianificazione dove puoi definire AC e azione futura.

Nessun telefono disponibile non impedisce di scrivere il ticket fisico. Nessun design scelto non impedisce di definire tre alternative. Nessun donor selezionato non impedisce un ticket comparativo con go/no-go. Nessuna licenza commerciale acquistata non impedisce una proposta. Un fallimento di uno strumento non autorizza a restringere silenziosamente l'intero incarico.

Mantieni aggiornamenti concisi all'owner. Il primo messaggio deve comunicare perimetro e quattro lane; dopo lettura avvia il lavoro, senza un nuovo questionario.

## Response file — solo coordinatore esterno

Percorso assoluto:
`/Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/lane-01-coordinator/001-strumentini-ticket-finalization.response.md`.

Non precrearla e non farla scrivere ai quattro nativi. Al termine è la tua ultima scrittura filesystem, contenente TUTTO l'handoff:

~~~text
# Prompt2Prompt Response
Status: COMPLETE | PARTIAL | BLOCKED
Continuation: NONE | CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: 1
Response-Covers-Through: <HEAD corrente coperto; specificare diff non committato>
Updated-At: <ISO-8601 timezone>
Prompt: tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/lane-01-coordinator/001-strumentini-ticket-finalization.prompt.md
Lane: coordinator-ticket-finalization
## Result
Pacchetto operativo completato o stato parziale, distinto dal prodotto.
## Changes
Ticket letti/riconciliati/aggiornati/nuovi, authority, prompt, file e commit.
## Native delegation
Quattro ID/ruoli, report ricevuti, write set e contributi integrati.
## Verification
Comandi/esiti fresh, conteggi copertura/AC/tool/OWN/DAG, link ai risultati.
## Conflicts or blockers
Perimetro esatto e prossima azione; None se assenti.
## Residual work
Residui del pacchetto, distinti dalle future implementazioni previste.
## Integration notes
Scelte pending, stato prompt futuri, cosa preservare.
## Next exact action
Prossima azione esatta o None — incarico ticket completo.
~~~

COMPLETE significa tutti i deliverable di pianificazione verificati, con Continuation:NONE e Stop-Reason:COMPLETE. PARTIAL+CONTINUE_NOW è una reale necessità di nuova chat per lavoro residuo, non un timebox volontario. BLOCKED richiede mancanza di ogni passo produttivo, non un singolo gate futuro.

Puoi committare solo i documenti/ticket del tuo incarico dopo verifiche e lettura dei diff, senza push implicito; non includere dati/artefatti di altri agenti. Salva la response dopo i commit perché HEAD coperto sia esatto. La response non è parte dei futuri ticket implementativi.

---

## Contesto integrale confermato — incorporato per una nuova chat

Il documento seguente incorpora decisioni, audit, codebase e confini. Non è necessario che la nuova chat riceva altre spiegazioni dall'owner. Leggi comunque i file reali per una fotografia fresca.

# Strumentini.it — handoff finale delle decisioni e del mandato ticket

Data: 10 ottobre 2026. Repository: `/Users/domenico/Code/Strumentini.it`.
Stato: **AUDIT CONSEGNATO; GRILLING CONFERMATO; PACCHETTO DI LANCIO PREPARATO**.
Il prossimo agente non è stato lanciato da questa sessione. Il prodotto, il redesign e i ticket di implementazione non sono dichiarati DONE o Gold.

## 1. Mandato immediato

L'owner lancerà personalmente su ChatGPT il prompt:
`tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/lane-01-coordinator/001-strumentini-ticket-finalization.prompt.md`.

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
5. `quality/oracles/`, `quality/fixtures/`, `quality/receipts/`; `research/lanes/06-09*`, `research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md`, `spikes/`.
6. `PROJECT-STATUS.md`, `HANDOFF.md`, `ROADMAP.md` se aggiornati, receipt release 95be886 come cronologia.
7. `CONTEXT.md` e `docs/PENDING-GRILLING-2026-10-10.md` per vocabolario/risposte.

Non esisteva `tasks/index.md` locale corrente; non importare task globali di DStack estranei. I run September sotto `tasks/prompt2prompt/` sono dichiarati storici dal loro README: letti e riconciliati nel ledger del nuovo run; non recuperare vecchi worker o worktree come WIP.

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

## Allegato — tutti i 43 originali aperti al baseline

Questa è la fotografia delle dipendenze aperte dell'audit, non una nuova disposizione o uno stato da copiare senza leggere le issue aggiornate. Le proposte storiche di sospensione non sono incorporate come decisioni. Leggere l'ultimo corpo originale di ciascuna issue.

| Originale | Gate al baseline | Dipendenze aperte al baseline |
|---|---|---|
| #008 Codice Fiscale generate/decode | dependency | #121, #122 |
| #011 Upgrade IVA + percentage calculator | dependency | #126 |
| #012 IRPEF annual calculator | dependency | #127, #128 |
| #013 Stipendio netto annual calculator | dependency | #130 |
| #014 Regime forfettario annual calculator | dependency | #133 |
| #015 TFR calculator | dependency | #134, #135 |
| #018 Close CalcolaTutto 13/13 parity | dependency | #008, #011, #012, #013, #014, #015 |
| #024 Office/Markdown productivity family | dependency | #056 |
| #028 Image format + target-compression family | dependency | #047, #049 |
| #031 OCR and document-scan family | dependency | #246, #247 |
| #032 PDF edit/security family | dependency | #237 |
| #035 Audio capture/playback utilities | dependency | #229 |
| #040 Italy utilities beyond CalcolaTutto | dependency | #152, #117 |
| #046 Full expansion certification + release integration | dependency | #018, #158, #279, #280, #281 |
| #047 JPEG/PNG/WebP/SVG compression engines | ready | Gate non numerico / nessun blocker aperto numerico |
| #049 Image conversion matrix + HEIC/AVIF/GIF | dependency | #212 |
| #056 Office-to-PDF and printable export pack | ready | Gate non numerico / nessun blocker aperto numerico |
| #058 PDF↔image directional conversion pack | dependency | #235 |
| #062 Upgrade existing business/date functionality | dependency | #126, #127, #128, #130, #133, #134, #135 |
| #115 Italian administrative geography source pack | source | Gate non numerico / nessun blocker aperto numerico |
| #117 Italian fiscal annual source snapshots | source | Gate non numerico / nessun blocker aperto numerico |
| #121 Codice Fiscale formal validate and generate engine | dependency | #115 |
| #122 Codice Fiscale decode and omocodia ambiguity | dependency | #121 |
| #126 IVA add and scorporo with versioned presets | dependency | #117 |
| #127 IRPEF national annual core | dependency | #117 |
| #128 IRPEF supported deductions and addizionali tranche | dependency | #127 |
| #130 Stipendio netto annual v1 | dependency | #128 |
| #133 Regime forfettario annual v1 | dependency | #117 |
| #134 TFR accrual and ISTAT-backed revaluation | dependency | #117 |
| #135 TFR indicative taxation layer | dependency | #127, #134 |
| #152 Italian invoice stamp-duty reference helper | dependency | #117 |
| #158 Italy source freshness and annual rollover gate | dependency | #115, #117 |
| #212 HEIC AVIF and GIF directional image implementations | ready | Gate non numerico / nessun blocker aperto numerico |
| #229 Microphone test and local recorder | physical | Gate non numerico / nessun blocker aperto numerico |
| #235 Advanced Images to PDF composition | dependency | #212 |
| #237 True PDF redaction with post-export proof | ready | Gate non numerico / nessun blocker aperto numerico |
| #246 Local image OCR | ready | Gate non numerico / nessun blocker aperto numerico |
| #247 Scanned PDF OCR and searchable text layer | dependency | #246 |
| #277 Physical Android Chrome image-resize acceptance | physical | Gate non numerico / nessun blocker aperto numerico |
| #278 Physical iOS Safari image-resize acceptance | physical | Gate non numerico / nessun blocker aperto numerico |
| #279 Image-resize Gold promotion gate | dependency | #277, #278 |
| #280 Physical Android heavy-tool web acceptance lane | physical | Gate non numerico / nessun blocker aperto numerico |
| #281 Physical iOS Safari heavy-tool web acceptance lane | physical | Gate non numerico / nessun blocker aperto numerico |
