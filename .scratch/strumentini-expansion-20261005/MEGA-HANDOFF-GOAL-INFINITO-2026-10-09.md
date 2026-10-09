# STRUMENTINI.IT — MEGA HANDOFF / GOAL «INFINITO» / MISSIONE FINO A ESAURIMENTO BACKLOG

**Versione:** 2026-10-09, circa 10:40 Europe/Rome. **Destinatario:** una nuova chat di coding, in ruolo **PRIME / integratore unico** con **due subagenti** disponibili. **Questo documento è una consegna operativa**, non una lista di idee, e deve essere aggiornato dopo ogni tranche verificata. Per lo stato corrente, al momento della ripresa, i file e il Git reali prevalgono sui numeri fotografati qui.

## 0. ORDINE ESECUTIVO PER LA PROSSIMA CHAT — LEGGI E AGISCI

> **GOAL INFINITO (interpretazione operativa):** prosegui in maniera autonoma, ripetendo ricognizione → scelta ticket → implementazione in due corsie → accettazione → integrazione → dashboard → prossimo ticket, per tutto il lavoro concretamente possibile. **Non terminare con un mero rapporto di stato, non chiedere «continuo?», non aspettare un altro «continua».** Sfrutta **due subagenti in parallelo**, riusandoli ad ogni tranche, mentre il PRIME integra e prepara la successiva. Gli aggiornamenti di avanzamento sono intermedi e **non sostituiscono l'esecuzione**. Usa tutte le iterazioni utili consentite dalla sessione. Quando devi passare a una nuova chat o finisce la finestra di lavoro, crea/aggiorna un handoff altrettanto concreto, con SHAs, file, comandi, test, blocchi, prossimo passo immediato. Non promettere attività in background che non siano realmente in corso.
>
> **Obiettivo finale reale:** portare i **327 ticket** a esito motivato e tracciato, con implementazione funzionante e prove dove tecnicamente realizzabile, distinguendo in modo non falsificabile capability **SHIPPED**, capability **REFUSED**, **BLOCKED** esterno e Gold. Chiudere i ticket bloccati senza fonti, hardware o motore approvato sarebbe una falsificazione: in tal caso esaurire il restante lavoro eseguibile, lasciare il blocco documentato e chiedere solo la dipendenza fisica/ufficiale davvero indispensabile.
>
> **PRIORITÀ ASSOLUTA DELLA RIPRESA:** ci sono **due commit di subagenti PRONTI ma NON integrati**: `c714c8b` (#243) e `aeb73b3` (#237). Hanno **collisione di ID oracle `cand-269`**. Fare triage e integrazione controllata prima di aprire altre nuove funzionalità PDF. **#237 è security-critical** e non va pubblicata come vera redazione se manca la necessaria controprova indipendente o audit di sicurezza. Evitare cherry-pick in massa, reset, pulizia degli untracked, promozione Gold o deploy implicito.

## 1. REPOSITORY E STATO REALE VERIFICATO ALLA CONSEGNA

**Repository PRIME:** `/Users/domenico/Code/Strumentini.it` su Mac Studio (macOS). `origin` HTTPS: `https://github.com/domenicomassafra/strumentini-it.git`.

**Git:** `main` HEAD = `2c434f3` (`integrate(pdf): certify bounded ruled table XLSX workflow without Gold`), **identico a `origin/main`**, `git status --short --branch` pulito, `git rev-list --left-right --count origin/main...HEAD` = `0 0` (verificato all'inizio del handoff).

**Catalogo:** **268 tool**, dei quali **257 GOLD storici**, **2 PARTIAL** e **9 IMPLEMENTED_UNVERIFIED**; **nessuna promozione Gold** degli ultimi candidati. Build **288 pagine** (287 con metadata unico), JS iniziale route 7.144 B. Ultima QA integrata dopo #254: **1.370/1.370 test PASS in 177 file**, `npm run check` **0 errors, 0 warnings, 17 hints** su 1.782 file, `npm run build` PASS (288 pagine), browser #254 PASS su Chromium 390×844 con reale XLSX da 3.022 B riaperto indipendentemente, zero richieste esterne.

**Dashboard canonica (verificata `--check`):**

| Grandezza | Conteggio |
|---|---:|
| Ticket totali | **327** |
| Completed | **261** |
| Completed con `REFUSED` esplicito (NON capability consegnata) | **18** |
| Completed senza REFUSED esplicito | **243** |
| Open | **66** |
| Ready-for-agent reale | **13** |
| Numeric DAG ready (include gate esterni) | **21** |
| Bloccati da dipendenze | **45** |
| Bloccati da fonti ufficiali | **2** |
| Bloccati da prove su dispositivo fisico | **5** |
| Bloccati da capability rifiutata/non approvata | **1** |
| Disallineamenti status memorizzati | **0** |

**Authority (aprire dal disco, non riutilizzare copie nello storico):**

- `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md` e `.json` — classificazione attuale di tutti i 327 ticket.
- `.scratch/strumentini-expansion-20261005/TICKET-DAG.md` — grafo di dipendenze, 327 ID continui e aciclici.
- `.scratch/strumentini-expansion-20261005/issues/NNN-*.md` — requisito originale, 3 AC o altri checkbox, limiti, implementazione ed evidenze, `**Blocked by:**` e **status canonico**.
- `.scratch/strumentini-expansion-20261005/ticket_dashboard.py`, `validate_backlog.py` — parser e categorie; modificare gate solo con evidenza reale.
- `.scratch/strumentini-expansion-20261005/SKILL-ROUTING.md` — instradamento competenze; `docs/10-tool-expansion-result-system-v2.md`, `docs/11-format-operation-matrix.md` — design della family/coverage.
- `quality/oracles/registry.json` — authority **append-only** per nuovi candidati; `quality/fixtures/index.json`, `quality/receipts/expanded-catalog-certification.json` — fixtures/receipts, **non fabbricare**.
- `src/i18n/it/tool-copy.ts`, `src/catalog/result-v2-inventory.generated.ts`, `src/generated/catalog*` e script generatori — solo PRIME integra; evitare edit manuali a generated.
- `.scratch/strumentini-expansion-20261005/IMPLEMENTATION-CHECKPOINT-2026-10-09-267-TOOLS-67-OPEN.md` — storia esatta della giornata, fino a #254. Questo documento ne è il successore, non sostituisce la dashboard generata.

**Comandi di scoperta all'avvio:**

```bash
cd /Users/domenico/Code/Strumentini.it
git status --short --branch
git log -8 --oneline
git rev-list --left-right --count origin/main...HEAD
git worktree list
npm run tickets:check
git -C /Users/domenico/Code/Strumentini-wt-218 status --short --branch
git -C /Users/domenico/Code/Strumentini-wt-232 status --short --branch
```

Non presumere che un commit worker sia già integrato guardando soltanto il nome del branch. Confrontare `git merge-base`, `git log`, `git show`, `git branch --contains` e patch; commit worker rebase possono essere differenti pur descrivendo identica funzionalità.

## 2. DUE WORKTREE E SUBAGENTI GIÀ ESISTENTI (RIUTILIZZARE, NON SPAWNARE NUOVI A CASO)

**Stato dell'ultima ispezione subagenti:** `worker-1` e `worker-2` **sleeping/revivable**; hanno terminato i rispettivi ticket e sono riutilizzabili con `agents(action="message", to="worker-N", text=...)`. In una nuova chat il `run_id` potrebbe essere diverso: controllare `agents status` ed eventualmente avviare due lavoratori solo se non ci sono worker riutilizzabili nella propria run. Il PRIME è **l'unico publisher/integratore**.

| Subagente | Worktree e branch | SHA consegnato, NON in prime main | Stato |
|---|---|---|---|
| worker-1 | `/Users/domenico/Code/Strumentini-wt-218`, `sprint/str-254-pdf-tables` | **`c714c8b`** — #243 fill/annotate/write overlays, subset **FLATTENED ONLY** | Done nel worker, da integrare/verificare |
| worker-2 | `/Users/domenico/Code/Strumentini-wt-232`, `sprint/str-232-video` | **`aeb73b3`** — #237 true redaction via raster nuovo + proof, security-critical | Done nel worker, da valutare sicurezza prima di pubblicare |

Worktree #218 conserva untracked `.vitest/`, `node_modules`, `scripts/acceptance-pdf-image-aware-218.worker4-preserved.txt`; worktree #232 conserva untracked `node_modules`. **NON eseguire** `git reset --hard`, `git clean -fd`, `rm -rf`, `git stash` indiscriminato, worktree remove o rebase su modifiche tracked non verificate. Preservare tutto il materiale di altre corsie; nuovi worker si assegnano solo file propri, mai collisioni su parser/writer/catalogue shared.

### 2A. #243 — implementazione pronta (worker-1, `c714c8b`)

**Scopo reale:** overlay testo, evidenziatura gialla e compilazione limitata di AcroForm **solo `/Tx`** con widget terminale singolo, rettangolo valido, non interattivo, senza JS/signatures/azioni. Scrive contenuti sulla pagina e **appiattisce**: il PDF esportato **NON conserva campi modificabili né annotazioni editabili**. Overlay non è redazione sicura. Rifiuta `Sig`, `Btn`, AP/XFA/actions, forme ambigue, pagine ruotate, non-ASCII, annotazioni extra, certificazioni e firma digitale. UI con thumbnail PDF.js, pointer/touch e coordinate tastiera X/Y/size. Prove worker: **3/3 Vitest**, `tsc --noEmit` PASS; Chromium 390×844 con vero PDF `/Tx` -> valore visibile `ACRO 001`, testo `OVR 002`, `PDF.js getAnnotations=0`, pixel highlight `[255,242,166]`, emoji rifiutato, nessun vecchio link download, zero offsite. Issue `243` **`completed` per il SUBSET ristretto**, non supporto editable completo.

**File owned:** `src/engines/pdf/fill-overlays-243.ts`, `src/components/tools/pdf/PdfFillOverlays243Tool.tsx`, `src/pages/tools/pdf-fill-overlays.astro`, `src/tools/pdf-fill-overlays/{manifest,module}.ts`, `tests/pdf-fill-overlays-243.test.ts`, `scripts/acceptance-pdf-fill-overlays-243.ts`, issue #243. Manifest **`gold.oracleEntryId: "cand-269"`**, ma questa ID collide con #237.

**PRIME TO DO:** verificare il commit e la semantica bounded, integrare #243 per primo se la source safety regge; assegnargli `cand-269` una sola volta, con oracle entry append-only e `IMPLEMENTED_UNVERIFIED`, registrazione/copy italiana e route **esattamente un** `client:load` sotto `ItalianToolPage`. Non fare claim "annotazioni editabili". Rivedere se la chiusura `completed` è coerente con tutte le AC originali oppure lasciare issue aperto con dettaglio ciò che manca. Test browser post-build comune e controllo che non sia lasciato un duplicato di componente nel branch `ItalianToolPage`/fallback, altrimenti il generatore fallisce.

### 2B. #237 — REDAZIONE PDF DAVVERO IRRECUPERABILE, proof bounded (worker-2, `aeb73b3`)

**Scopo reale del subset:** interi fogli sorgente PDF rasterizzati ex novo tramite PDF.js, sostituzione di ogni pixel selezionato con RGB = (0,0,0), compressione lossless Flate, **NUOVO PDF image-only da `PdfBuilder` vuoto**; nessun contenuto, XObject, Info/XMP o stream sorgente clonato. Vietato/REFUSED input annotato, criptato, con campi, actions, JS, file embedded, layer e modello non supportato. Max **4 pagine**, **8 MiB** input, **12 aree**, **1,6 MP per pagina**. Verificatore indipendente legge output finale, impone whitelist fissa degli oggetti (Catalog + Pages + 3/page), nessun oggetto orfano, no byte dopo EOF, decomprime tutti i pixels e verifica **OGNI pixel annerito** prima del download; nessun search text, vettori, link, metadata rimangono. È una distruzione **voluta** di testo selezionabile, qualità vettoriale, interattività e metadati dell'intera pagina.

**Prove worker:** 15/15 Vitest incl. tamper (un pixel recuperabile, JS orphan, post EOF); browser Chromium 390×844 su fonte reale 2 pagine testo/immagine/meta: **8 oggetti output**, **45.000 pixel neri** e blue/green non selezionati invariati, testo segreto/Info/XObject raw bytes non recuperabili da parser/estrattore, zero offsite; Astro noindex upload/preview/download e re-open PASS; TS PASS. Issue **`ready-for-agent`** anche se 3 AC del subset marcate: **manca audit di sicurezza indipendente, corpus complesso avversario (ruotato/scansionato) e fisico iOS/Android memoria/cancellazione**. Non è certificazione sicurezza generale né Gold.

**File owned:** `src/engines/pdf/secure-raster-redaction-237.ts`, `src/components/tools/pdf/PdfSecureRedaction237Tool.tsx`, `src/pages/tools/pdf-secure-redaction.astro`, `src/tools/pdf-secure-redaction/{manifest,module}.ts`, `tests/pdf-redaction-237*.ts` e fixtures, issue #237. Manifest **`cand-269` in collisione con #243**.

**PRIME SECURITY GATE:** prima di registrare/pubblicare nel catalogo, revisionare la sicurezza degli input, incluso parsing di content dictionary/nested actions, ordine rendering, emissione byte, regioni, escape/encoding, output oracle, mask bounds, cancellazione/errore senza stale link, grandezze e decompression bomb, comportamento su PDF con form/raster/rotazioni e dati privati. Non basta sovrapporre neri nel PDF originale. Richiedere confronto con parser indipendente, fonte vs output, ricerca del testo/bytes originali, PDF.js real pixels e output oggetti. **Se non c'è sicurezza dimostrabile: NON rendere pubblica la route, NON dichiarare ticket completed, lasciare subset/source e refusal trasparente.** Se accettata la route separata, cambiare qui l'ID a **`cand-270`** e aggiungere distinta entry append-only; `cand-269` spetta a #243. La numerazione `cand-NNN` dell'oracle NON corrisponde ai ticket #NNN.

**Precedenti commit già integrati — NON cherry-pick due volte:** `12fc0d2` #037 real PTS CFR/VFR, `dedc4cc` correzione 9 assertion #232, `b9394fb` browser UI video, `4309965` #254 PDF grid→XLSX, `2c434f3` integrazione candidati fino a 268. Worker precedenti `979a9d3`, `1a018a9`, `29e9c98`, `0be958e` sono già rappresentati in main con hash diversi. Il ramo prime ora è pulito a `2c434f3`.

## 3. PRIMA SPRINT DA ESEGUIRE SUBITO (NON SOLTANTO DESCRIVERE)

1. **Ricognizione/ripresa:** `git status`, `git log`, `git worktree list`, `agents status`, `npm run tickets:check`; `git show --stat c714c8b` e `git show --stat aeb73b3`. Verificare che nessun altro abbia toccato main e preservare worktree/untracked. Fare un checkpoint backup se ci sono conflitti.
2. **Integrazione #243 isolata:** cherry-pick selettivo **solo** il commit `c714c8b` quando main è adatto; se conflitto nell'issue, merge semantico preservando titolo, `**Blocked by:**`, status corretto, tutte le evidenze; evitare overlay falso editable. Registrare candidate `cand-269` in `quality/oracles/registry.json` **in append-only**, copia IT, un solo rendering; aggiornare solo test di inventario/certification che assumono 268 tool; rigenerare catalog/certification e dashboard. Non modificare deliberatamente vecchie Gold. Run targeted/unit, `npm run check`, build, browser con PDF form `/Tx`, parsing output; dopo QA verde fare commit integrazione.
3. **#237 sicurezza in corsia separata:** audit prima del cherry-pick o cherry-pick source-only senza route pubblica (attenzione: il catalog generator potrebbe scoprire automaticamente il manifest). Il PRIME deve controllare `scripts/tool-factory/generate-catalog.ts` prima di aggiungere il manifest al main; un manifest in `src/tools` può diventare pubblicamente discoverable. Se audit incompleto, preservare worker commit e proseguire su altri ticket **senza registrarlo**. Se proof realmente sufficiente, cherry-pick `aeb73b3`, sanare conflitti, manifest `cand-270`, oracle append-only, nessun nuovo Gold, route truthfully raster-only; unit+browser su output reale con prove no recoverability, 0 offsite. Non riusare `cand-269` per entrambi!
4. **Due worker subito occupati:** mentre PRIME integra, riutilizzare sleeping worker con nuova corsia senza file condivisi (ad esempio #231 DSP audio e #234 video transform feasibility — entrambi ready-for-agent — oppure #047 compressione immagini e #236 PDF→image). **Non assegnare stessa area condivisa ad entrambi, né alla PRIMER integration**. Incarico definisce file OWN, AC, fixture, tests, SHA, no Gold/push/deploy/full-suite e punto di refusal. Se mancano tools per i worker in nuova chat, procedere sequenzialmente ma non fingere parallelismo.
5. **QA principale dopo ciascun blocco integrato:** `npm run tickets:sync`, `npm run tickets:check`, `npm run catalog:build`, `npm run certification:build`, `npm run certification:check`, `npm run check`, `npm run build`, `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`; i browser mirati che aprono il vero output, non solo mock. Ai conflitti di stato/registry e test, **risolvere la causa**, non togliere assert.
6. **Commit/push solo dopo prove verdi:** commit mirati al main e push `origin main` solo con divergenza remota zero (`git rev-list --left-right --count ... = 0 N`), verification Git SHA locale/remoto e worktree pulito. Non fare deploy, DNS, account OAuth/prod, mail, provider, device o fonte ufficiale senza approvazione/evidenza pertinente.
7. **Aggiornare contatori veri:** una volta integrati #243 e/o #237, rigenerare dashboard, non stampare numeri inventati. **Fino a quel punto il dato certo resta 327 / 261 / 66, 268 tool, 257 Gold.** #243 `completed` nel worker NON ha ancora aggiornato il dato sul main; #237 worker rimane aperto. Non dichiarare il passaggio a 262 completati prima di merge + `tickets:check`.

## 4. TUTTI I 66 TICKET APERTI: ELENCO COMPLETO, CLASSI, COSA BLOCCA COSA

I gruppi che seguono derivano dall'ultima dashboard vera. **Prima di usarli per assegnare ticket, rifare `tickets:check`** perché #243 e #237 potrebbero essere stati integrati successivamente.

### 4A. 13 ready-for-agent: lavorabili ORA, ma fattibilità da dimostrare

| Ticket | Lavoro e utilità | Strategia / limite non negoziabile |
|---|---|---|
| **#037** | Ispezione video + sottotitoli | PTS/stts/ctts reali, SRT/VTT e frame già implementati; mancano prove mobile/seek/performance dove richieste. No frame-perfect fittizio. |
| **#047** | Compressioni JPEG/PNG/WebP/SVG | Separare supporti browser reali da codec/refusal, SVG optimizer rifiutato #209. Matrice e firme verificabili. |
| **#056** | Office→PDF e stampa | #256 text→PDF implementato; DOCX/XLSX/PPTX PDF fidelity gates #257–259 con REFUSAL. Non chiamare conversione semantica una fedele. |
| **#059** | Minifier JSON/XML/CSS/HTML/SVG | CSS/HTML/XML download cross-browser 18/18; SVG optimizer #209 REFUSED; completare subset o mantenere refusal. |
| **#212** | HEIC, AVIF, GIF | GIF timing, animazione persa dichiarata; HEIC real iPhone/approved codec non dimostrati. |
| **#218** | Compressione PDF image-aware scans | JPEG predictor Flate opt-in increment; DPI/mixed scans, object fidelity e target-size restano. Sblocca #219/#249/#265/#051. |
| **#231** | Audio edit timeline DSP | Implementare segmenti reali, timebound, fade/amplificazione, precisione, cleanup, samples, ASR? No claim senza decode/encode. Sblocca #036. |
| **#234** | Video transform worker | Lazy cancellable real MP4 compress/trim/audio extraction con A/V sync, codec, size, memory, physical. Sblocca #306/#038. |
| **#236** | PDF→image avanzato | Già range/PNG/JPG/WebP e browser 69/69; mancano physical mobile/performance/corpus. Sblocca #255. |
| **#237** | True PDF redaction | Worker `aeb73b3` proof source-only; security review + broader corpus; no overlay concealment; non pubblica fino ad audit. Sblocca #032. |
| **#241** | Posizionamento firma PDF | Distinguere immagine firma visiva da firma crittografica; non alterare certificazioni digitali, verificare PDF output. Sblocca #032. |
| **#243** | Fill/annotate/write PDF | Worker `c714c8b` flatten-only bounded, non editable; prova form/evidenziatura/posizionamento; integrabile dopo QA. Sblocca #032. |
| **#246** | OCR immagini locale | Real Node spike Tesseract IT text `Fattura numero 12345 - Totale euro 678,90`, 6/6; **refused production** senza #271 gate fisico RAM/WASM/cancel, no false OCR. Sblocca #247/#031 quando approvata. |

### 4B. 45 dependency-blocked: implementare figli prima di chiudere genitori

| Gruppo | Ticket ancora bloccati | Dipendenza / effetto |
|---|---|---|
| Italia e CalcolaTutto | **#008, #011, #012, #013, #014, #015, #018** | CF/IVA/IRPEF/netto/forfettario/TFR; dipendono da reference #115/#117 e focus children #121,#122,#126,#127,#128,#130,#133,#134,#135. |
| Grandi family e discovery | **#024, #028, #031, #032, #033, #035, #036, #038, #040, #045, #046** | Sono parent/closure gate, non feature primitive. #045 discovery, #046 certificazione release sono gli ultimi nel DAG, NON chiudere prima dei figli. |
| Product matrix/upgrade gates | **#049, #051, #057, #058, #062, #065, #066, #069** | Format conversion/compression/Original-200, cross-format file size; 200-audit non dimostra fedeltà format. |
| Italia source-dependent focus | **#121, #122, #126, #127, #128, #130, #133, #134, #135, #152, #158** | Fonte ufficiale comuni/stati e anno fiscale (#115/#117): identificare anno, fonte/sha/licenza/verifica vigenza; non inventare aliquote. |
| PDF focus | **#219, #235, #247, #249, #255, #265** | Target-size→#218; Images→PDF→#212; OCR PDF→#246; Split by size→#218; PDF→PPTX→#236; analyzer→#218. |
| Certificazione fisica | **#279** | Gate Gold image-resize dipende da #277/#278 reali. |
| Video | **#306** | Video→GIF necessita #234 true codec/worker. |

**Elenco esatto dei 45:** #008, #011, #012, #013, #014, #015, #018, #024, #028, #031, #032, #033, #035, #036, #038, #040, #045, #046, #049, #051, #057, #058, #062, #065, #066, #069, #121, #122, #126, #127, #128, #130, #133, #134, #135, #152, #158, #219, #235, #247, #249, #255, #265, #279, #306. Per ogni ticket usare `TICKET-DAG.md` / issue per i blocker numerici esatti; NON concludere dal nome che il genitore sia pronto.

### 4C. Gate ufficiali/fisici/capability: NON bypassabili con un test mock

| Tipo | Ticket | Requisito vero |
|---|---|---|
| Fonte ufficiale, 2 | **#115, #117** | Comune/stato codice storico e set fiscale IVA/IRPEF/forfettario per uno stesso anno ufficiale, licenze, versioning, digest, test. Non screenshot casuali o aliquote inventate. |
| Hardware fisico, 5 | **#229, #277, #278, #280, #281** | Microfono reale e permessi; Android Chrome/iOS Safari hardware reale e misure per image-resize/heavy tool, picker/Inspector memoria, cancellazione e network. Emulator/Playwright/mock **non** equivalgono. |
| Capability rifiutata, 1 | **#053** | #320/#242 closed REFUSED per password-supplied PDF decrypt. Non usare bypass password, parser insicuro o claim fake; chiedere motore approvato o cambiare perimetro solo con esplicito assenso. |

**Nota conteggi:** 13 ready + 45 dependency + 2 official + 5 physical + 1 capability = 66 OPEN. I 18 `closedWithRefusal` (`#150,#207,#208,#209,#222,#223,#224,#230,#242,#244,#245,#253,#257,#258,#259,#262,#263,#320`) non sono funzioni spedite. Una eventuale copertura 327/327 amministrativa non significa 327/327 capability reale.

## 5. PIANO DI ATTACCO AL DAG — MASSIMIZZARE TICKET SBLOCCATI PER ORA, NON PER FACILITÀ DELLA DEMO

**Dopo prime #243/#237:** tener occupate **due corsie indipendenti**. Preferire figli che sbloccano molti discendenti, mantenendo un portafoglio di quick wins + critical path; evitare simultanea scrittura su parser/writer, catalog, dashboard, same UI.

**Ondate suggerite (ricalcolare il DAG dopo ogni commit):**

1. **PDF critical path:** audit #237/#243 (sicurezza e semantica), poi #241; worktree indipendente #218 (compressione image-aware) e #236 (PDF→images). Solo dopo sbloccare #219 (target size), #249 (split by size), #265 (file-size analyzer), #255 (PDF→PPTX), quindi genitori #051/#058/#057/#032/#033/#069.
2. **Media DSP critical path:** #231 audio timeline reale → #036; #234 video worker → #306 → #038. #037 chiudibile solo accettando esattamente evidence di corsia; #229 hardware mic resta blocked senza accesso reale.
3. **Immagini/formati:** #047 & #212 e #059 con support capability reali e NO SVG optimizer fake; poi #049/#028 e #065. Lavori su GIF/AVIF/HEIC devono verificare frame/loss/dimensions/mime, non output falsamente etichettato.
4. **Office:** #056 e #024 solo quando matrici Office-to-PDF si risolvono con supportato o *REFUSED* esplicito; #255, #235 per produttività non confondere semantica testo vs fedeltà screenshot.
5. **Italia:** reperimento #115/#117 da fonti istituzionali versionate. Se non disponibili, completare framework, manifests, tests e ricerca a prova di fonte, poi lasciare blocked; quando sbloccati realizzare #121/122 e #126/127/128/130/133/134/135/#152/#158 → #008/#011...#018/#040/#062.
6. **Global gates alla fine:** #065 matrice input→operazione→output e #066 tutti gli upgrade funzionali, #045 IA/catalog discovery, #046 release/certification. Non fare un closing a cascata se il sottoticket è solo refusal o il target della famiglia richiede capability disponibile.

**Algoritmo di scelta automatico:** leggere JSON dashboard + issue; filtrare category `ready-for-agent`; per ogni candidato assegnare punteggio [discendenti sbloccati, valore utente, rischio di regressione, fattibilità offline, grandezza test] e scegliere la miglior coppia con **file ownership disgiunta**. Su `blocked` non sprecare tempo ripetendo tentativi senza nuova evidenza; raccogli evidenza/new corpus se fattibile, poi passa al prossimo. Alla fine di ogni tranche rifai ranking e assegna subito due nuove corsie. Se una corsia finisce prima dell'altra, riutilizza la slot nell'immediato.

## 6. «GOAL INFINITO» = CICLO DI ESECUZIONE AUTONOMA AD OGNI RIPRESA

**Loop per ogni tranche, ripetere finché lavoro eseguibile:**

```text
READ real status/main/DAG/worker state
  → FIX any in-flight integration failure and pending commits
  → CHOOSE 2 independent highest-unlock ready tickets (or meaningful proofs)
  → DISPATCH/reuse workers with exclusive file scope and strict acceptance
  → PRIME integrates previously completed lane(s), adds authority/copy/registry
  → RUN focused regression, real output/browser, check/build/full suite batch
  → UPDATE issues + checkbox + status only from evidence; tickets:sync/check
  → COMMIT selective + PUSH only after green and no remote divergence
  → LOG exact SHA/PASS/blocked/gaps, no invented Gold
  → RE-RANK 66→... ticket backlog; assign next immediately
  → REPEAT
```

**Nessun rapporto di stato come task finale se ci sono azioni eseguibili.** Dare all'utente aggiornamenti sintetici **durante** il lavoro, ad es. ogni integrazione significativa, con `completati/aperti`, quale bug risolto, test/QA e SHA; NON chiedere permesso a ogni passo. I ticket con accesso a remoto, deploy, DNS, OAuth, email, produzione, credenziali, pubblicazione, spesa o hardware altrui necessitano naturalmente l'autorizzazione corrispondente. Il normale source-only locale e test fixture possono proseguire senza micro-approvazioni.

**Subagente contract (da inserire in ogni prompt):**

```text
Sei worker del progetto /Users/domenico/Code/Strumentini.it.
OWN SOLO file esplicitamente assegnati, preferisci nuovi isolati; rispetta
worktree/branch esistente; preserva ogni untracked, non usare reset/clean/stash.
Leggi issue NNN, DAG e engine già esistenti; implementa bounded REAL acceptance.
Le 3 AC sono checklist verificabili: output reale, unit adversarial, browser
download + re-open indipendente, no offsite, onesto about lossy/unsupported.
Non modificare registry/oracle/generated/dashboard/shared writer/parser,
né source di altri worker; non fare Gold, main, push, deploy, full-suite.
Se capability non provabile REFUSE/ready, mai successo simulato.
Esegui targeted test/tsc selettivo, git diff --check; commit SOLO OWN file.
Consegna: SHA, elenco file, AC PASS/gaps, test numeri e comandi, browser proof,
limitazioni, issue status e causa blocker. Poi action=finish.
```

**PRIME contract:** unico responsabile dell'integrazione shared: `catalog:build`, oracle append-only, Italian copy, Gold/certification gating, dashboard, issue statuses, HTML routes, layout SEO, full QA, Git remote publish quando già autorizzato dal flusso. Per ogni nuovo tool un solo candidate ID univoco e una sola route/client component; non ereditare Gold da vecchia denominazione.

**No fake closure:** se 3 AC passano solo per uno scope limitato, scrivere in issue esattamente **quale subset** è implementato e quali casi sono esclusi. Se quei casi fanno ancora parte degli AC originali, status resta `ready-for-agent`/`blocked` anche se esiste codice dimostrativo. Non cambiare il testo AC per dichiararle passate. Distinguere `completed`, `completedWithRefusal`, `ready-for-agent`, `dependency-blocked`, `external-source`, `external-device`, `capability-blocked`.

## 7. TEST, SECURITY, RELEASE E VERIDICITÀ

**Comandi ordinari consigliati dopo ogni merge batch:**

```bash
npm run tickets:sync
npm run tickets:check
npm run catalog:build
npm run catalog:check
npm run certification:build
npm run certification:check
npm run audit:original-200:final
npm run check
npm run build
npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000
git diff --check
```

Alcuni di questi script hanno output generati; controllare status e includere solo file dovuti. `npm run check` invoca Astro check (tipicamente 17 hints tollerati, ma 0 errors/warnings obbligatorio), non equivale al `tsc` generico; usare anche `npx tsc --noEmit --pretty false` quando utile. Non lanciare full test/astro build simultaneamente su stesso `dist`/generated o con due browser Playwright concorrenti; browser su porta singola isolata e stop pulito server alla fine. In Mac shell zsh `status` è variabile speciale di sola lettura: non usare `status=$?`, usare `rc=$?`.

**Browser prove che già funzionano da build statica** (richiamare quelle interessate dal cambio):

- `npx tsx scripts/acceptance-pdf-booklet-interleave-251.ts` — 14/14 pagine, PDF.js pixel colors, white blanks, zero offsite.
- `npx tsx scripts/acceptance-pdf-table-xlsx-254.ts` — vera anteprima 3×3, workbook 3022 B riaperto indipendente, hash+provenance, formula-safe, zero offsite.
- `node tests/video-inspector-232.browser.mjs` — 36 check, VFR/CFR veri, no offsite.
- `node tests/video-frame-camera-305.browser.mjs` — 27 check, webcam **mock**, non prova fisica.
- `node tests/video-contact-sheet-308.browser.mjs` — 28 check, real 2-frame PNG ZIP.
- `node scripts/acceptance-developer-transform-download.mjs` — 18/18 download tra Chromium/Firefox/WebKit per #059.
- `npm run acceptance:pdf-export-compression`, `npm run acceptance:pdf-image-aware` — fonte → output PDF reali con pagina, geometria, cromia e trasparenza, ma non sostituiscono device fisici.
- Dopo #243 usare `npx tsx scripts/acceptance-pdf-fill-overlays-243.ts`, dopo #237 gli `tests/pdf-redaction-237*.browser.ts` (verificare import, port e generated build). Eseguire sempre nuovamente nel PRIME; le prove worker su dev server non equivalgono al bundle finale.

**Security defaults:** motori esclusivamente `LOCAL`, senza cloud salvo tool esplicitamente network-gated e consenso. Input sempre size/pages/pixels/time/memory bounded; support reali da capability probes; no upload implicito. Firme PDF digitali e password non falsificate; PDF security sensitive **fail-closed**; nessuna UI che traveste copertura grafica per rimozione contenuti. File di terzi con metadata/excerpts/privacy e licensing devono rispettare provenienza/digest/diritti. PDF→XLSX non inventa celle; OCR no testo finto; video no FPS/codec/seek false; Office raster vs semantica chiara; HTML non viene eseguito durante conversione. Sui generatori certificazioni append-only e Gold receipts esistenti non si ricalcola una promozione senza prova.

**Controllo di qualità di ogni nuovo strumento:** route risponde 200; UI italiana leggibile, 320/390/430 mobile e desktop 1440 quando pertinente; tastiera e touch/focus, aria label; input invalidi rifiutati, cancellation/stale-run fail-closed; download ext/MIME/firma/numero pagine e contenuto reale verificati **indipendentemente**; rete zero su tool locali; non confermare success se ZIP/PDF/XLSX/prova parser output non si riapre; nessun horizontal overflow.

**Gold e release:** `257` è il baseline Gold reale al 2026-10-09. Le entries `cand-265..268` e future sono **IMPLEMENTED_UNVERIFIED**, non certificazioni nuove. Chiudere issue non autorizza Gold automaticamente. `npm run release:validate` e il vero dry-run Cloudflare/physical source gate si eseguono solo in tranche di release con dipendenze idonee; **NO deploy automatico**, no domain/email/DNS/Cloudflare mutations senza richiesta esplicita. Non modificare receipt storiche o fingere device test.

## 8. ROADMAP DI LUNGO PERIODO: CRITERI DI CHIUSURA PER TUTTI I 327

Il conteggio non deve mai essere gonfiato dai parent ticket. Sequenza corretta: soddisfare o rifiutare *esplicitamente e in modo appropriato* la capability figlia, produrre fixture/evidenze, solo poi revisionare parent. Alcuni parent richiedono capacità non approvata, per cui potrebbero legittimamente restare blocked fino ad esplicita decisione sul perimetro. Il progetto ha già 200/200 original-functional audit Gold/frontier parziali e 268 tool inventariati: **non** riaprire indiscriminatamente tutto; usare test/regressioni mirate, investire su 66 aperti.

Per ogni ticket chiuso scrivere nella issue: implementazione reale vs rifiuto; esatta AC con prove `source → transformation → output → independent reopen`; browser/performance dove rilevante; limiti/bounds, source provenance, MIME; cosa non si supporta; SHA commit; nessuna forma di Go/Gold in assenza gate. Dopo ogni blocco, `npm run tickets:sync` aggiornando `CURRENT-TICKET-DASHBOARD.json/md` e `TICKET-DAG.md`; il count verificato deve tornare senza mismatch. Per fonti #115/#117 salvare URL ufficiali e materiali versionati, non testo allucinato. Per fisici #229/#277/#278/#280/#281 è necessaria prova da veri dispositivi, non da strumenti simulatori.

**Stop condition possibile A (successo finale):** 0 ticket aperti, tutte le capability dichiarate con output reale/rifiuti approvati chiaramente distinti, issue e DAG con status canonico, release blockers/gold separati, `tickets:check`, `certification:check`, `catalog:check`, full suite, browser matrix e release gates applicabili PASS, main sincronizzato, nessuna pendency. Solo allora scrivere "tutti i 327 ticket hanno esito" (NON necessariamente 327 strumenti).

**Stop condition B (impossibilità esterna):** nessun lavoro tecnicamente eseguibile resta, ma ci sono ticket che richiedono fonte ufficiale, fisico, capacità non approvata o autorizzazione. Documentare ESATTAMENTE IDs e test mancanti, eventuale decisione richiesta all'utente, non mentire chiudendoli. Produrre nuovo handoff con prossimo passo reale, lasciando i blocker aperti. Può essere un esito temporaneo, non dichiarare completamento 327/327.

**Stop condition C (limite sessione/chat):** prima di esaurire contesto, salvare nuovo handoff *con stato fresco* e mini prompt da copiare; non lasciare un agente successivo a indovinare `git log` o a recuperare file WIP da ricostruire. Il lavoro non si svolge magicamente in background fra chat: l'esecuzione riprende quando un nuovo agente riceve il handoff e ha accesso ai tool.

## 9. FORMATO OBBLIGATORIO DI REPORT AL TERMINE DI OGNI TRANCHE, SENZA BLOCCARE IL LAVORO

Mostrare in prosa concisa questi fatti, quando verificati:

```text
Strumentini.it — YYYY-MM-DD HH:mm Europe/Rome
Main locale / origin: <SHA> / <SHA>, stato clean|pending, ahead/behind.
Ticket: 327 totali — X completed (Y REFUSED non-shipped), Z aperti:
  R ready / D dependency / S source / P physical / C capability; mismatch M.
Catalogo: N tool / 257 Gold storici / P PARTIAL / U IMPLEMENTED_UNVERIFIED.
Integrato: #NNN descrizione vera e bounds, worker SHA -> main SHA.
Test: targeted n/n; check errors/warnings; build pages; full suite a/b; browser.
Non integrato: #NNN branch/SHA e motivo; eventuali conflitti/gate.
Lavoratori: worker1 su #X file OWN; worker2 su #Y file OWN.
Prossima azione ESEGUITA (non solo promessa): <comando/file/task>.
Bloccanti insuperabili: <ticket/evidenza/azione user se serve>.
```

**Non usare la frase «finito tutto»** finché i conteggi e i gate non lo consentono. Non usare aggiornamenti come sostituto delle commit/test. I commit selettivi prevengono sovrascrittura concorrente. Se un test fallisce, fare debug, correzione, retest, e continuare. Se uno scope comporta enorme rischio di sicurezza/capability, fare REFUSAL conservativa e passare al backlog utile.

## 10. PROMPT DA INCOLLARE COME PRIMO MESSAGGIO NELLA PROSSIMA CHAT

```text
SEI IL PRIME UNICO INTEGRATORE DI STRUMENTINI.IT, MISSIONE GOAL INFINITO.
Leggi INTEGRALMENTE questo file nel repo:
/Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/MEGA-HANDOFF-GOAL-INFINITO-2026-10-09.md
Poi verifica git/dashboard/DAG/agents dal vero filesystem PRIMA di assumere i numeri.

GOAL: continuare autonomamente fino a finalizzazione verificata di tutti i
327 ticket, senza fermarti a un rapporto parziale e senza chiedermi
«continua». Usa SEMPRE due subagenti in corsie disgiunte se disponibili;
riusa sleeping worker, tu sei unico integratore/publisher. Non cancellare
node_modules/.vitest, untracked o lavoro preesistente. Mantieni test, build,
QA browser/output reale e dashboard in sync, commit selettivo e GitHub push
soltanto dopo PASS e no-divergenza, mai Gold fake o deploy non autorizzato.

STATO PINNED AL HANDOFF: main/origin 2c434f3 CLEAN; dashboard 327 totali,
261 completed (18 REFUSED/non-shipped), 66 open; 13 ready, 45 dependency,
2 official-source, 5 physical, 1 capability; 268 tool, 257 Gold, 2 partial,
9 unverified; QA globale 1370/1370 test, check 0 errori, build 288 pagine.
Questi numeri cambiano SOLO con nuovi check reali.

PRIMA INTEGRAZIONE: #243 worker1 c714c8b (flatten-only form/overlay)
e #237 worker2 aeb73b3 (SECURITY-CRITICAL raster-only true redaction).
I DUE manifest dichiarano cand-269 -> collisione da risolvere!
Assegna cand-269 a #243 se valida integrazione; #237 solo dopo security
audit e separato cand-270, oppure lascia source-only/refused non pubblicato.
Esegui i test veri e i gate prima di chiudere/pubblicare. Non dichiarare #237
completed/sicuro solo per neri visibili. Aggiorna issue, authority, copy,
dashboard e generated SOLO dal PRIME. Tieni due worker occupati su altri
ready-for-agent indipendenti (#231/#234/#047/#236 o ranking DAG migliore).

DOPO: ricomincia automaticamente il loop di selezione/implementazione/
integrazione/test/push per tutti i 66 ticket e i genitori sbloccati.
Se trovi un gate esterno, lascia blocker vero, massimizza altro lavoro
locale, non richiedere hardware/fonte inventata. Quando la chat raggiunge
il limite salva un nuovo mega handoff fresco e immediatamente eseguibile.

INIZIA SUBITO DA git status, agents status, worker commit review e
prima integrazione: non rispondere con il solo piano.
```

---

**Firma del handoff:** basato sulla dashboard reale `tickets:check` PASS e sul Git main `2c434f3` pulito, con messaggi finali dei due worker #243/#237 acquisiti dal coordinatore. Questo handoff non integra quei commit e non autorizza di propria iniziativa un deploy. **Il primo fatto che la chat successiva deve verificare è sempre lo stato filesystem/Git presente in quel momento.**
