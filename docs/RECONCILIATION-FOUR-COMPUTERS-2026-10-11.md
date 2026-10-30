# Strumentini.it — riconciliazione a quattro computer

**Snapshot:** 2026-10-11, circa 16:29–16:34 Europe/Rome. **Modalità:** inventario conservativo, confronto del codice presente, nuova verifica dei gate locali, nessun push/deploy/fetch/reset/clean/stash o modifica a ricevute Gold. Quattro subagenti nativi Chat On Steroids hanno esaminato indipendentemente le postazioni; il coordinatore ha controllato Git, suite e release gate sul Mac Studio.

## 1. Inventario verificato degli host

| Computer / identità di accesso | Accesso e perimetro | Esito Strumentini.it |
| --- | --- | --- |
| **Mac Studio**, `mac-studio-dodo`, `/Users/domenico` | Core locale, repository e Git verificati | Unico checkout operativo identificato: `/Users/domenico/Code/Strumentini.it`, `main` HEAD **`833db38d680f69b162d9bd622a1524f3b806e494`** |
| **MiniPC**, `minipc`, `/home/udodo` | SSH online; `~/Code`, home, mount locali e percorsi progetto/documentazione mirati | Nessun checkout, worktree o ticket Strumentini individuato nei percorsi ispezionati; nessun HEAD confrontabile |
| **MateBook**, `matebooklinux`, `/home/matebooklinux` | SSH Linux online; home, cartelle di progetto e `find` mirati | Nessun checkout/worktree Strumentini individuato; nessun HEAD confrontabile |
| **MacBook Air**, `macbookair`, `/Users/domenicomassafra` | SSH online; `~/Code`, home, cartelle di lavoro/documenti mirate | Nessun checkout/worktree Strumentini individuato; nessun HEAD confrontabile |

Il MateBook **Windows** è un profilo separato dall'installazione Linux: l'alias SSH `matebook` è andato in timeout sulla porta 22. Lo stato di eventuali file sul Windows **non è stato verificato**. Le ricerche sulle altre macchine non sono scansioni di ogni byte del disco né degli archivi offline; "non rinvenuto" non significa assenza assoluta.

**Conseguenza:** non sono emersi branch o WIP concorrenti da fondere da MiniPC/MateBook Linux/MacBook Air. L'unica fonte Git corrente e ispezionabile per Strumentini è il Mac Studio. Non trasferire o sovrascrivere dati di altre macchine per forzare una falsa sincronizzazione.

## 2. Stato Git sul Mac Studio

- `HEAD`: `833db38` su `main`. Il tracking locale `origin/main` è `d0947cc`; `git rev-list --left-right --count origin/main...HEAD` restituisce **0 behind / 12 ahead**. Un solo worktree per il repository è elencato da `git worktree list --porcelain`.
- `git branch -avv` mostra `main` e il tracking `origin/main`; `git for-each-ref` elenca anche riferimenti archiviati del 24 settembre per accessibilità, browser acceptance e performance. Non sono branch attivi di Strumentini da integrare nella working tree.
- `git stash list` è vuoto. Gli elementi ignorati rilevati (`node_modules`, `dist`, `.astro`, log e cache sotto `.scratch`) sono artefatti locali e non lavoro Git da eliminare indiscriminatamente.
- Il delta rispetto al tracking locale comprende **369 file**, **76.278 righe aggiunte** e **389 rimosse**: soprattutto archivio ticket/documenti, ma anche test, codice applicativo, worker, script e CI.
- **Nessun file tracked modificato** al momento dell'inventario e dopo test/build. Un solo file `??` era deliberatamente intatto: la risposta del coordinatore del 10/10 relativa al commit `4c9f4b5`. Era un handoff storico, non WIP implementativo; il corpus dei prompt è stato poi ritirato in #498, con originali conservati in Git.
- Il vecchio checkout QA `Strumentini-prime-cleanqa-20261009` citato negli handoff non figura tra i worktree attuali del repository; non ricrearlo né ripulirlo sulla base del solo riferimento storico. Gli eventuali `node_modules`, log e cache ignorati non vanno confusi con modifiche da committare.
- Verifica *live* di GitHub **non riuscita**: `git ls-remote origin` su HTTPS ha risposto con errore di credenziali; lettura SSH separata ha risposto `Permission denied (publickey)`. Il dato `origin/main` è dunque il tracking **locale**, non una conferma dell'HEAD remoto al 2026-10-11. Nessun fetch/push effettuato.

### Progressione dopo l'ultimo handoff

Il precedente checkpoint `9a3cb1f` non è l'HEAD corrente. I commit successivi presenti in `main`, in ordine, sono:

1. `5f1c179` — flussi file locali e rifiuto di badge Gold storici non più attestabili.
2. `07739ad` — accettazione file-first e prove producer/consumer su sei famiglie di output.
3. `a6dfcdc` — suggerimenti CSV, preview e risultati telemetrici privacy-safe.
4. `e3af0d1` — inventario per-tool dei claim/limiti/prove ancora mancanti.
5. `833db38` — download CSV manuale/automatico soltanto opt-in e verificato.

Wave documentate: `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` fino a `-05`, e `-07`; **nessun file wave-06** trovato nella sequenza corrente. Questo è un salto documentale da chiarire, non prova autonoma di una tranche mancante.

## 3. Ticket: registro canonico, non conteggi storici

Authority: `.scratch/strumentini-expansion-20261005/issues/`, `CURRENT-TICKET-DASHBOARD.{json,md}`, `TICKET-DAG.md`, script `ticket_dashboard.py` e `validate_backlog.py`.

| Stato | Conteggio corrente |
| --- | ---: |
| Ticket totali | **424** |
| Completati nel registro | **293** |
| Tra i completati, chiusi per rifiuto esplicito (non spediti) | **17** |
| Aperti | **131** |
| Pronti per assegnazione/indagine | **32** |
| DAG-ready in senso puramente numerico | **39** (non tutti assegnabili, per gate ulteriori) |
| Bloccati da altre dipendenze | **92** |
| Bloccati da fonti ufficiali | **2** (`#115`, `#117`) |
| Bloccati da prove su dispositivi reali | **5** (`#229`, `#277`, `#278`, `#280`, `#281`) |
| Mismatch tra stato issue e dashboard | **0** |

Rispetto a `9a3cb1f` (**286 completati / 138 aperti**), sono stati chiusi ulteriori **sette ticket**: `#331`, `#333`, `#334`, `#335`, `#338`, `#346`, `#408`. Restano aperti anche quando hanno una tranche di codice già funzionante `#336`, `#337`, `#339`, `#341`, `#347`, `#415` e diversi gate trasversali: le AC residue non devono essere segnate verdi retroattivamente.

Il pacchetto Prompt2Prompt originario è **completo come pianificazione**, non come prodotto: aveva creato 97 ticket `#328–424`, matrice catalogo/donor, roadmap e prompt. I suoi vecchi conteggi `284/140` non sostituiscono quelli attuali. Consultare anche `docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md` e `ROADMAP.md` per le decisioni owner, senza ripetere il grilling.
Gli 11 prompt esecutivi e alcuni handoff/ledger di pianificazione mantengono necessariamente quello snapshot storico: rileggere il dashboard prima di distribuirli, non reinterpretarne i vecchi numeri come dato fresco.

## 4. QA rieseguita su HEAD `833db38`

| Comando/controllo | Esito fresco |
| --- | --- |
| `npm test -- --maxWorkers=2` | **PASS**, 256 file / **1.937 test**; ticket check, formato, catalogo, certificazione e original-200 inclusi |
| `npm run check` | **PASS**, controllo Astro/TypeScript riuscito |
| `npm run build` | **PASS**, **292 pagine**; inspector: 683 asset JS, 7.915 B JS iniziale, 285 entry sitemap |
| Original-200 audit | **PASS**, 199 casi verificati e 1 rifiuto esplicito |
| Catalogo e badge fonte-bound | **269 route**, **0 Gold correnti** dimostrati |
| `tsx scripts/validate-release.ts --no-write-receipt` | **BLOCKED**, **8 blocker**, 0 errori generici; receipt non scritta |

Gli otto blocchi release sono: evidenza browser legata a sorgente precedente; 10 receipt Gold mancanti; 2 non Gold; 259 receipt source-stale; prova fisica Android mancante; prova fisica iOS mancante; ricevuta rollback source-stale; working tree non pulita (handoff storico untracked). I test locali e la build non annullano questi blocchi.

**#347**: il controllo pubblico fail-closed evita badge Gold falsi, ma la costruzione di un nuovo receipt positivo presenta una dipendenza circolare fra fingerprint sorgente e file generato `src/generated/quality.ts`. Richiesta soluzione con scope versionato non auto-riferito e nuovo test E2E positivo, senza togliere `worker/` e migrazioni D1 dal fingerprint.

**#415**: inventario delle 269 route/manifest presente; tutte **269/269** risultano `PENDING` per la dimostrazione source-bound per singolo tool. I sei readback di formato (PDF, PNG, CSV, DOCX, XLSX, WAV) non certificano automaticamente tutti i 269 strumenti.

## 5. Punto di ripartenza esecutivo

1. **Non eseguire merge/reset/clean** tra le macchine: nessuna seconda copia attiva è stata rinvenuta. Conservare la response storica non tracciata e gli eventuali archivi ignorati. Prima di qualsiasi push, ripristinare l'accesso GitHub e leggere/fetchare `main` remotamente, confrontando davvero il merge-base; niente forza-push.
2. **P0 trust & release:** riprendere `#347` con scope hash non auto-riferito e proof positivo; completare prove `#328` (Turnstile/account), `#329` (contrasto), `#330` (recenti) e `#350` (AA), senza richiamare PASS inesistenti di browser/device. Continuare `#404` (CI scoped e cumulativa) e `#405` (rollback/versione) come gate distinti.
3. **Esperienza file local-first:** `#337` resta completo soltanto per catena PDF ristretta; implementare e testare PNG→compressione e CSV→export, limiti 64 MiB/scadenza, cancellazione, origine e zero upload. Proseguire `#339` per risultati PDF/PNG/WAV/ZIP, `#341` per storage non-PDF, `#336` sui device fisici, `#407` con corpus file ostili. Prima di segnare DONE, rileggere tutte le AC originali.
4. **Prove per tool e sicurezza:** `#415` dovrebbe accompagnare i nuovi engine e i limiti runtime; `#237/#378/#406` non devono rendere pubblica una falsa redaction PDF; fonti fiscali ufficiali `#115/#117/#397` e diritti donor/licenze `#366+` conservano i loro gate.
   Anche `#332` ha migrazione D1 `0003_favorite_sync.sql` e prove locali, ma schema-first su staging e sincronizzazione autenticata fra dispositivi non sono evidenze correnti: non migrare D1 di produzione da questo audit.
5. **Redesign/avanzato:** i tre percorsi `#351` precedono la scelta owner `#352`; non applicare un restyling arbitrario. Editor PDF, immagini, dati, fiscalità e altri ticket futuri restano nel DAG canonico; non crearne duplicati prima di controllare `#328–424` e gli AC esistenti.

Per continuare senza falsi avanzamenti: scegliere uno dei **32 ready-for-agent**, assegnare write-set esclusivi, usare test unitari + un browser reale dove richiesto, riaprire l'output con lettore indipendente, aggiornare l'issue esatta e rigenerare la dashboard; una sola integrazione coordinata per batch, poi `npm test`, `npm run check`, `npm run build`, release gate senza receipt. Solo commit locali mirati e mai promuovere Gold, cancellare WIP, fare push/deploy o alterare D1 di produzione senza gate positivi.

## 6. Limiti della presente riconciliazione

- Non è stata eseguita una scansione forense integrale di dischi, archivi, volumi offline o cartelle protette sulle altre macchine.
- Windows MateBook e GitHub remoto non sono stati raggiunti; i loro contenuti e lo stato del server remoto restano **UNKNOWN**.
- Versione Cloudflare live e workflow CI GitHub non sono stati verificati in questa sessione. I receipt/handoff anteriori restano testimonianze del loro snapshot, non prova della release attuale.
- Nessuna verifica fisica iOS/Android o rollback in produzione è stata eseguita in questo audit.
- L'audit non chiude alcuno dei 131 ticket aperti senza implementazione e acceptance aggiuntive. La produzione resta **NO-GO** finché tutti i gate richiesti non sono dimostrati sulla build esatta.
