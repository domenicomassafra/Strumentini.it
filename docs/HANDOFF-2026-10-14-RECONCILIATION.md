# Strumentini.it — handoff operativo e riconciliazione
**Aggiornato:** 2026-10-14, Europe/Rome. **Documento locale per il prossimo agente.**
**Ambito:** `/Users/domenico/Code/Strumentini.it`; GitHub privato `domenicomassafra/strumentini-it`.

> Prima di agire, rieseguire `git status --porcelain=v1 --branch`, `git ls-remote origin refs/heads/main` e `gh pr list --state open`. Lo stato GitHub può cambiare durante altre conversazioni. Mai fare `git gc`/prune/distruzione di history prima di verificare ref, reflog e prove.

## 1. Stato e lavori già eseguiti

Il primo consolidamento del 14 ottobre ha riallineato il checkout canonico a `main` SHA `8cdd636959f80771b270929de185dacb60ec38f0`; 20 worktree aggiuntivi, 50 branch remoti, 36 branch locali e file temporanei specifici del progetto sono stati eliminati dopo audit. Il repository era pulito con un solo worktree e un solo branch. Ingombro nominale delle directory eliminate circa **6,07 GiB** (non misura diretta dello spazio APFS liberato e non raggiunge i 10 GB richiesti).

La PR #54 è stata **MERGED** il 14 ottobre 2026: `e9ed915868287996ba9b12c980f36560cc6a846f`, test `#369` e `#161` con timeout espliciti per le due verifiche reali pesanti. CI su main verde alla revisione. Le due suite mirate precedenti erano 13/13 PASS con `--maxWorkers=1 --testTimeout=30000`. Non abbassare le assertion per far passare un timeout.

La PR #55 `fix/350-table-chart-accessible-values-20261014` è stata **MERGED** il 14 ottobre su `main`, commit `b7148f8aed77735b61b2a4b36edd5f01777bade1`: recupera P2 dagli archivi di settembre per etichette screen-reader dei grafici e bordo controlli 3:1 in entrambi i temi. Commit `42a5d53b` e `bd938b1b`, head iniziale `bd938b1bfdd7d9c526daaf498fda4e0ace3346f4`; CI PR `changed-source` PASS (6m29s); review sorgente e 42/42 test mirati locali PASS, `npm run check` PASS con 0 errori e 0 warning (34 hint). Verificare comunque la CI cumulativa del nuovo SHA di main: non è una certificazione di deploy. PR #55 descrive test 36/36, build 293 pagine e accettazione browser 116 assertion, ma la certificazione di release non deriva dalla sola PR.

Il primo audit ha verificato il vecchio branch wave4: 74 commit ancestrali divergenti, 61 patch-id equivalenti e 13 semanticamente già presenti/superati in main; nessuna regressione utile da importare con bulk-merge. Il remoto dopo la pulizia conteneva solo `main`. Non ripristinare quelle refs senza dimostrare un bug sorgente oggi ancora presente.

**Tre tag Git d'archivio del 2026-09-24:** `archive/2026-09-24-a11y-wip`, `archive/2026-09-24-browser-acceptance-wip`, `archive/2026-09-24-performance-wip`. Il confronto semantico trova nell'archivio a11y le due correzioni P2 coperte da PR #55; nel tag browser nessuna nuova P1/P2, nel tag performance un'ottimizzazione P3 non provata necessaria. Preservare i tag come provenienza finché non si sceglie consapevolmente di archiviare tale storia in modo immutabile. Un audit read-only degli oggetti irraggiungibili ha trovato commit storici per lo più patch-equivalenti o superseded: non fare `git gc` per cosmetica.

## 2. Baseline tecnico non negoziabile

Dashboard canonica `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.json` e `.md`: **424 ticket, 307 completati, 117 aperti**. Fra gli aperti: 25 `ready-for-agent`, 85 `dependency-blocked`, 2 `external-source-blocked`, 5 `external-device-blocked`, zero mismatch. Il repository pubblica **269 tool** e attualmente **zero Gold SOURCE-CURRENT**; precedenti ricevute Gold e deploy non vanno attribuiti alla revisione corrente. Audit delle funzionalità originali: 200 record finali = 199 verificati + 1 rifiuto esplicito, non prova di rilascio degli altri ticket.

Eseguire e registrare per *esatto SHA*: `npm run tickets:check`, `npm run tickets:test`, `npm run check`, `npm test -- --maxWorkers=1`, `npm run build`, `git diff --check`, CI PR GitHub e CI cumulativa del push main. Acceptance browser genuine, sicurezza indipendente, provider e device solo quando accessibili e dimostrati; **mai** fabbricare ricevute Gold, attestazioni di rollback, sicurezza o mobile fisico. Il vecchio `HANDOFF.md` e il testo storico di `PROJECT-STATUS.md` riportano conteggi del 2026-10-08 (259/257 Gold): NON usarli come stato corrente; consultare esclusivamente il pannello generato.

## 3. Pending ad alta priorità, senza falsi completamenti

- **#404**: gate di rilascio con SHA esatto, source-bound receipts, indipendente audit sicurezza/CI, prova browser, rollback e physical devices; gli AC originali restano aperti. Con CI verde non è autorizzato il deploy Cloudflare.
- **#407 / #406 / #378**: corpus adversarial per HTML/SVG/XML/ZIP/OOXML/PDF, quote di risorse e redazione PDF forense. Le patch approvate rafforzano l'ammissione, ma gli AC originali non si chiudono automaticamente.
- **#394 / #047**: privacy dei metadati e protocolli codec reali (JPEG, WebP, SVG, PNG), output e browser/device. Proof WebKit/Chrome circoscritti non sono accettazione universale.
- **#397 / #117 / #115 / #396**: fonti fiscali e geografiche ufficiali, annualità 2026, regole legali e limiti. Non estrapolare anni o coefficienti da dati non ufficiali.
- **#328 / #329 / #350**: Turnstile reale, accessibility AA, tastiera, zoom, screen-reader e device; PR #55 migliora due P2 ma AC-350.1–3 non sono automaticamente soddisfatti.
- **#352, #353–361**: direzione visuale finale rimandata alla decisione esplicita dell'owner. Non scegliere un design per aggirare tale gate.
- **Dispositivi reali**: blocchi #229/#277/#278/#280/#281. Desktop Playwright non prova iOS/Android fisici.

I 25 ticket ready-for-agent rilevati nel dashboard comprendevano #47, #56, #212, #237, #246, #328, #329, #336, #349, #350, #352, #363, #366, #367, #368, #369, #370, #371, #378, #394, #396, #397, #404, #406, #407. L'etichetta significa assegnabile, NON funzione già completabile senza ulteriori prerequisiti.

## 4. Audit spazio quattro computer, perimetro sicuro

Accessibili al controllo precedente: Mac Studio `mac-studio-dodo`, MiniPC alias `minipc`, MateBook Linux `matebooklinux`, MacBook Air `macbookair`. Un eventuale ulteriore alias `matebook` Windows non rispondeva su SSH/22: non considerarlo scansionato. Nessun checkout Strumentini aggiuntivo rilevato nelle scansioni home/Code/tmp degli altri tre host; sul MiniPC resta un **bare Git mirror gestito da ControlCenter**, circa 69 MiB, da preservare (era stantio rispetto a main). Non eliminarlo né forzare ref collegate a un sistema di backup.

Dopo cleanup il checkout principale da solo occupava circa 1,11 GiB su Studio, inclusi `node_modules`, `dist` e dati di spike. `/private/tmp/strumentini-independent-audit` circa 22 MiB di prove indipendenti è stata preservata. La soglia >=10 GB non è supportata dalle copie e cache del progetto identificate. Non cancellare cache di altri repository, supporti o backup per raggiungere artificialmente 10 GB.

## 5. Debug Chat On Steroids: evidenze e fix da testare a parte

- Documentazione in `.scratch/.../MEGA-HANDOFF-GOAL-INFINITO-2026-10-09-20H-PRIME.md` e `docs/IMPLEMENTATION-WAVE-02-2026-10-11.md` registra worker che non si avviano/riprendono. Nel 14/10 si è osservato anche un worker di review che non ha riferito e un worker svegliato che non ha ripreso il composer.
- Connettore browser ha talvolta riportato `BROWSER_NOT_DISPATCHED` (estensione non prende la richiesta prima della scadenza). Alcune chiamate sono state rifiutate dai controlli upstream prima di arrivare al connector; un retry identico è riuscito. Distinguere errori gateway, browser-extension, provider, tool e contenuti.
- Un precedente errore OmniRoute HTTP 400 **non è stato attribuito a una causa riproducibile**: non asserire fix o colpa del provider senza evidenza.
- Soluzioni da provare nel progetto CoS (NON implementare nascostamente in Strumentini): state machine persistente dei worker con lease e heartbeat, resume-ACK verificabile, retry idempotenti con backoff, isolamento dei tool Git mutativi fra agenti, log correlati non sensibili e controllo di readiness dell'estensione. Prima RED riproducibile, poi GREEN e test failure-path. Non aprire più tab browser per ogni retry; riutilizzare una sessione confermata.

## 6. Procedura per prossimo agente

1. Leggere `git status`, PR e SHA attuali; mai ripristinare vecchio branch automaticamente.
2. PR #55 già integrata: verificare che il remoto sia sullo SHA `b7148f8a`, che il branch effimero sia eliminato e che il cumulativo CI su main abbia conclusione SUCCESS. Non replicare il merge.
3. Selezionare UN ticket ready realmente self-contained, scrivere test RED riproducibile, implementare minima patch, verificare target + CI, non dichiarare chiuso l'AC senza tutta l'evidence.
4. Aggiornare la documentazione datata e il pannello generato senza modificare artefatti di prova storica. Conservare niente temp o worktree non necessari.
5. Stato finale: elenco delle modifiche, SHA, PR, test, failure, dati di storage prima/dopo, esito device/provider, backlog aperto e motivi specifici.

**Regola di reporting:** `source merged` ≠ `all acceptance passed` ≠ `release authorized` ≠ `production deployed`. Conservare questa distinzione senza eccezioni.
