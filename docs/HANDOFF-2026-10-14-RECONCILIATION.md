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


## 2026-10-15 — Lane 01 / WAVE 001: preparazione del passaggio umano CoS

Mandato corrente: UNA tranche con quattro subagenti nativi CoS oltre al coordinatore; trasporto umano Codex→CoS→questa chat Codex, senza avvio di worker da Codex. Windows escluso. Questo checkpoint integra il registro originale, non crea nuovi ticket.

### Active workflow

Skill applicata: `/Users/domenico/.codex/skills/skill-writing-for-agents/SKILL.md`; passo completato: preparazione e review documentale del prompt autocontenuto. Workflow assestato, nessun worker avviato e nessuna domanda owner pendente. Frontiera successiva: dispatch umano del solo `01-WAVE-001-COS.prompt.md`, poi verifica della risposta CoS in questa chat Codex. Nessuna attività in background. La skill di scrittura termina con questa consegna.

Verifica 15 ottobre ~07:42 Europe/Rome: candidata `review/strumentini01-clean-candidate-20261014`, locale/remota `15b445435d4bd40c387895622509e504abb9206c`, pulita; main effettivo remoto `9906d6a6e4332ad2db79389750fb8f0f1d5b483f`; zero PR aperte. GitHub run 38620746485 completed/success sull'esatto candidato. `npm run tickets:check` sulla candidata PASS: 424 totali, 307 completed (17 refusal), 117 open, 25 ready-for-agent, 85 dependency-blocked, 2 external-source-blocked, 5 external-device-blocked, mismatch 0. Sono prove di sorgente/tracker, non release. Auto-review repository resta EXTERNAL_AUTOREVIEW_SETTING_UNVERIFIED / PR_HELD_AUTOREVIEW_BILLING_GUARD; nessun consenso a costi.

Non esistono `tasks/index.md`, `goal.md/plan.md/worklog.md` del task indicato in Ops, né un file STATE nel backlog indicato: si usano questo handoff e issue/dashboard originali. Il vecchio prompt Ops 297 è stato letto PARZIALMENTE (testa/appendici selezionate, output troncato); SHA e stati contraddittori sono risolti dai readback freschi. Non si dichiara lettura integrale di sorgenti/storia/receipts. Letti architettura iniziale, indice, contratti, AC/ultime evidenze dei verticali e seam sorgente pertinenti; lettura dei branch remoti aggiuntivi limitata a diff/patch GitHub, da completare durante acquisizione CoS.

### Piano della tranche e responsabilità

- Worker CoS A: #235, acquisire `fix/235-images-pdf-heic-refusal-20261014` / `f90b6725ea7474e747e36657b9a22ec1fb24f78f`, verificarne il rifiuto HEIC prima del decode e PDF reali di controllo. #235 resta formalmente dipendente da #212 fisico; evitare chiusura implicita di #58/#212.
- Worker CoS B: #350, acquisire `fix/350-axe-wcag-floor-20261014` / `5cac93d9701b5e5d5da327dce89c2b4315cb8f23`, eseguire axe reale sul build corrente e conservare fix focus/header già integrati. AT/zoom/device restano esatti residui se non provati.
- Worker CoS C: #378, verificare chiusura originale proposta da `fix/378-forensic-real-export-and-signed-20261014` / `f860413f7f8b76d469751b265c380def5f0ba8af`. Confrontare AC e prove reali PDFKit/Poppler su stessi byte, firma CMS e rifiuti; acquisire subito solo se completamente provate. Non estendere questa closure a #406/#237.
- Worker CoS D: #370, completare prove già predisposte sui motori correnti: oracle openpyxl opt-in effettivo, benchmark installato/donor e disclosure aggiornata, senza nuovi motori. AC-370.2 già checked; .1/.3 restano aperte finché manca prova. Assenza oracle/mobile/diritti ha owner/unblock preciso, non giustifica nuovo hardening incidentale.
- Coordinatore CoS: unico writer iniziale candidata/index e tracker generati; lease brevi trasferibili. Acquisizione finding, review locale, pubblicazione tempestiva per ticket, coorti/pin #348 e indici generati, prova cumulativa finale, riconciliazione dei 69 WIP sotto. Mantiene responsabilità #406 remoto `5ec7916652b9274daf3fb937bd56dbe6c662e595`: diff raw diverge ma il contenuto è in gran parte già integrato tramite cherry-pick; confronto semantico, niente bulk merge. File-hash remoto più recente `8aa9a24dba165e39bf8e35573461c669c0cf5359` è antenato candidato. Due varianti WIP locali rimangono da riconciliare, conservando i test inherited-packet/reentrant-abort/late-event e valutando gestione terminate/strict-progress; nessuna sostituzione integrale non revisionata.

### Manifest dei 69 WIP canonici all'avvio

Owner di riconciliazione: coordinatore CoS lane01. Destinazione per 67 IDENTICAL: candidata remota 15b44543 (bytes SHA256 uguali); preservare i file originali finché la riconciliazione è attestata. Destinazione dei due SEMANTIC_REVIEW_REQUIRED: stessa lane, commit review remoto da assegnare dopo review/test, senza perdere delta esclusivi. I 69 file sono preservati: questo doc non li stagea, modifica o elimina. Dopo la tranche ciascun residuo mantiene path/hash/owner/destinazione e prossimo passo; nessuna pulizia implicita.

| File | SHA256 WIP | Stato rispetto candidata |
|---|---|---|
| `.scratch/strumentini-expansion-20261005/issues/246-local-image-ocr.md` | `f30d3fac06086aa4ce113097bf236c27b4ecc8ed9ab2d83f7c2c280a94a4dcb4` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/328-p0-account-turnstile-login-reale.md` | `3e6b69d3c03d9d0998f1c139c3191ed8a172d32fee033c83946ccb14a18edf6f` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/329-p0-contrasto-accesso-e-errori-wcag.md` | `cb0bc2b1ce954ffa47901cff014a50cd81f43eb86e31d1d2348fe265ed3ddcc9` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/336-picker-iphone-android-e-touch-equivalente.md` | `62b9043bfa2dd7711710d840de8db4fb34665d03f0fceea7ffb66a065afb9d2c` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/347-p0-badge-gold-fingerprint-frontend-backend.md` | `69c31761a7e1d2fd6aa502c44ff44e81f6e1cce13d427a6584a39c636faf35e1` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/348-server-opt-in-gratis-feasibility.md` | `25d4a512152401b158dacdadbb860a2fa040100381628807106e86e4a67f1f0c` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/350-p0-accessibilit-aa-di-base-e-advanced.md` | `17c75c0a58ea63cdba0f08ef8b50175dd555e6fae8ec678d1b84c54027a658ab` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/363-budget-memoria-mobile-editor-reali.md` | `bbe57cff3473a42949b6c147981908d40941baa79ed336b5393f4318873d205b` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/366-licenze-e-provenance-donor-pinning.md` | `8c05f54d86f8b565bdf649883a727888abac2f9a35d54ea01ada8306c791dc1f` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/368-office-rich-docx-xlsx-pptx-donor-spike.md` | `519c4db6f6f4fcb9afdeeb5fc2f69b2dfcbffe8cfddabab5f593362c78223af0` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/369-motore-pdf-editor-proprietary-safe-confronto.md` | `1fcb07ec8a2db5d680514665d1ec34840480e245466ef7957ad4e138dbbe8977` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/370-spreadsheet-csv-excel-donor-fidelity.md` | `4cd0ae0e9c9e69145c8015e09339941fdf353ac7b1583457dfd0658c76daed0b` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/371-ocr-multilingual-donor-and-quality-study.md` | `c00dbdccfd1ed975f6037c221494375b4ae512d5e16391f17e6ac715d28a10ae` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/394-metadata-stripping-with-after-export-forensic-inspection.md` | `d6a0a868e1b23a100b0575de7f133c7b3f1e62b89dc4551d1067f103570410a1` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/396-two-italian-tax-journeys-privati-piva.md` | `1d410a75eb3a8cb5fd945a604f411e82086d8d2a89c8f594018144a628dcd0ec` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/397-official-annual-tax-source-inventory.md` | `8e94ec061594407d1869e87402750c3aa9406532eae7e149d5285108311f505f` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/404-change-scoped-ci-and-cumulative-release-validation.md` | `b1b054ce76d874ba2aa2ccc510d9169d5ad19cc6f6918920d8c0349560d3eefd` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/406-independent-pdf-redaction-attack-corpus.md` | `52db9482fb9d2b119ad08930f77582fe47a0ce572c89da9227fc63a8e7019c1c` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/407-hostile-parsers-and-archive-resource-safety.md` | `c50d3f64abce42b099656e5b4a1a0791dfdab411cbf6ab99af2a8a2720503a3b` | IDENTICAL |
| `.scratch/strumentini-expansion-20261005/issues/56-office-to-pdf-printable-export-pack.md` | `a49b27c4fc8ceb5c9a92213ea06745f3000231522813cf0474cba92606e16393` | IDENTICAL |
| `scripts/ci-change-impact-404.ts` | `efcc1ea7b520f912a185d782142c5a553096e90feaed0ea18e53bf834eee26b1` | IDENTICAL |
| `scripts/donor-provenance-366.ts` | `b646cf18754e96f929e6b3a02ebf3ae075c8a99d2940182b0b8632959776a82b` | IDENTICAL |
| `scripts/feasibility-server-optin-348.ts` | `866e5abb9022a038ade187a36a253e590da113c02302a07b2c08713a4bb0c7fd` | IDENTICAL |
| `scripts/ocr-language-audit-371.ts` | `63aaa856247be12953f303fed6ef0da9f419ce7551ea0f60516825d51c8b7bc9` | IDENTICAL |
| `scripts/validator/audit-397.ts` | `ae6cd196a697e4917871b67673dfff467008795cd42adc7d68c0ea5aa126b049` | IDENTICAL |
| `src/components/account/auth-client.ts` | `b32363ed352edf1a2b97c5f1cfc4650c0d46d55731cdf2e11e2fc354fb8b8f21` | IDENTICAL |
| `src/components/home/HomeFileEntry.astro` | `a8827e565ab434304c468333675c6c6c9d727647dad5480d79c6b3e367f0c93e` | IDENTICAL |
| `src/components/shell/SiteHeader.astro` | `709a7d1efa38aecf16adfccbc6277d4d1b4ee2e6a4072418c7ebfff921be79eb` | IDENTICAL |
| `src/components/tools/PrintablePdfTool.tsx` | `82a0340455bcd698b3ada7687e9492d52058e4b49c45f91f3cdb047f9b494fee` | IDENTICAL |
| `src/engines/file-hash/worker-client.ts` | `f168843f72064f23feffa4cd69ebae4633f75601d4939ac8333a54ff0f34ae34` | SEMANTIC_REVIEW_REQUIRED |
| `src/engines/image/metadata.ts` | `c70bc6172aa33cef285a22c8d4406978550747fb694173d0c72d8a94adc8b09d` | IDENTICAL |
| `src/engines/image/portable-decode.ts` | `a9602d9b72b2b4f904819dae6be80d2ae8add16497b1325fd2d5c5152da03f3e` | IDENTICAL |
| `src/engines/ocr/local-italian-246.ts` | `b0b42dc39b6b26989282bac11d1f1f1d251ae85e5e07156731da70ffb5f6738f` | IDENTICAL |
| `src/engines/ooxml/office-semantics.ts` | `54551b58146b764ee0a3afa00fc6f653494ce83615a3dbeb162bb3b306bb37d5` | IDENTICAL |
| `src/engines/pdf/inflate.ts` | `74abf385aad0a77f64d014739dc109c1343320cae97d6ef51357fb5f4cef3fb9` | IDENTICAL |
| `src/engines/pdf/parser.ts` | `e20315b28a64a846a0714712644e5322278e3029d26525f36ba29bd29cdaf93c` | IDENTICAL |
| `src/engines/pdf/secure-raster-redaction-237.ts` | `a82516e332724f6ff55ad3d824274e1fc933a28fa477a2dc6a43405377449250` | IDENTICAL |
| `src/engines/table/spreadsheet-interchange.ts` | `798e912e37e4350ed099cfcc2090d99f399cf4ba2a2b5098ded8da0e744ef827` | IDENTICAL |
| `src/pages/impostazioni.astro` | `ddc8798d4aacbf5023dd1ef46430168aae5cd5f0bcde213af871f0e4dc8f9793` | IDENTICAL |
| `src/pages/tools/codice-fiscale.astro` | `b08136a0b40053dc9215f29311077451a7134f48e6e112bf17f9da8c24d65614` | IDENTICAL |
| `src/runtime/heavy-local-job.ts` | `c45596b7edd24c67ef957fa03a191eaffead9c5feaf65fe3aec20f1069d758c6` | IDENTICAL |
| `tests/account-page-turnstile-328-329.browser.mjs` | `7e339cf57ce0c1e902726d6c424c7a64f4e936378055ffbaa0168ed8873178fc` | IDENTICAL |
| `tests/audit-397.test.ts` | `ab1f403f995d23dadea696adb5f0e3cbeebc1aa66f642239e8d4d36c82b12bf8` | IDENTICAL |
| `tests/audit-pdf-engine-provenance-369-20261013.test.ts` | `edf5d0ae7e112feea0cfc59af48f9fb83680a67ba0bda0730e91b9d677c1247b` | IDENTICAL |
| `tests/browser-evidence-fingerprint-347.test.ts` | `ff023360a267bed069daec21d534e409544951f97df85fab574886372ccbf59d` | IDENTICAL |
| `tests/ci-404-20261013-release-admission.test.ts` | `f054bb7a829f1912e0a457b1e9926a7aafe45d8dfabdce25b250846fa92c18e8` | IDENTICAL |
| `tests/donor-spreadsheets-370.test.ts` | `eaaf377384a0fdad7447028cb81132d6090acac02bc97bac85b0a250bdd9641a` | IDENTICAL |
| `tests/feasibility-server-optin-348.test.ts` | `9a1d09fade94dc61c92a78cc9719ab8671b7216e2d398724bda464821dd0e6d8` | IDENTICAL |
| `tests/tax-journeys-396.browser.mjs` | `8a08c42a7a2a7f7a0d2e2500b03204e870fd8de7e7dd1ad22975cb577a6a0f2c` | IDENTICAL |
| `tests/account-329-20261014-retry-focus.browser.mjs` | `f6e932dcc2d0f01b892fce23cc6e36a965264b7edd59cfde679aba43170e001e` | IDENTICAL |
| `tests/donor-provenance-366-20261014-spdx-grammar.test.ts` | `268a4ed4f562621e49962b36d31ef321bee752c60f6952abf15f6d4dc5f59ca6` | IDENTICAL |
| `tests/file-hash-worker-protocol-20261014.test.ts` | `a865fda719d71e1099567111bee6c1742dbc492a2cf9adad890755e796fef4a2` | SEMANTIC_REVIEW_REQUIRED |
| `tests/file-threat-407-20261014-pdf-objstm-resource.test.ts` | `4c151d43a599ddb638256a232c46d062c25ab2b70db6bd2a892daf7799fe84c8` | IDENTICAL |
| `tests/heavy-local-memory-363-20261014-resource-action.test.ts` | `b3dce7163c64890259eb4911e702fde64cc1e95b154a9dce2e4b5514648a0f7b` | IDENTICAL |
| `tests/home-picker-336-20261014-multifile-drop.browser.mjs` | `84f96802a86c44f82048e2f53dfe28bc07bcd45d311b05fef82a0b8af14463e7` | IDENTICAL |
| `tests/image-directional-212-20261014-animated-avif.browser.mjs` | `4a08ed1efdb91189611b3f2a938d0db75cd4e46922a13c10b72bdaa79bac1192` | IDENTICAL |
| `tests/metadata-394-20261014-unused-dht.browser.mjs` | `63ec1a836d6c08b614f9b20987272855a07f598753915d34928aae17eeb87b34` | IDENTICAL |
| `tests/metadata-394-20261014-unused-dht.test.ts` | `aeffb88cf7993e15c5f1a5f021cf10d09f76664e4fbf8ba9aaa9e31c5c957d8d` | IDENTICAL |
| `tests/ocr-246-20261014-apng-guard.test.ts` | `6a7fc9cfe8d51de1a20bdf94d708dc87b057f8d62db4fd91f5717af4558ce970` | IDENTICAL |
| `tests/ocr-246-20261014-apng.browser.mjs` | `dfd28aa97abd74721b3b399f8caf0328234607d6a6b7a2fa29137488c282d202` | IDENTICAL |
| `tests/ocr-371-20261014-worker-integrity.test.ts` | `a2b58b06aead1003bc24f401471bac1f20e15b19c70eb55168efd0b6a05a596b` | IDENTICAL |
| `tests/office-rich-368-20261014-relationship-semantics.test.ts` | `a6fab3b24f5cd2b445a8cbd374c749ccacf292d6887863b675abb4e6c1529364` | IDENTICAL |
| `tests/pdf-redaction-406-20261014-flate-tail.test.ts` | `e0159651b5c803b264c4deb5b4b3b4d893987dfbd63e7c966c0823a3a432f7c0` | IDENTICAL |
| `tests/pdf-redaction-406-20261014-objstm-budget.test.ts` | `2b5ee5b01583b79ee8a094a13e957958320a6830fb8cae130f0f15e7f6c92b87` | IDENTICAL |
| `tests/printable-pdf-56-20261014-upload-order.browser.mjs` | `dade569751899900ffa6467450486b51d1e7afe481656b94a8638a39b8218a97` | IDENTICAL |
| `tests/site-header-350-20261014-desktop-escape.browser.mjs` | `de1ecce1d862343fc0c0c72d03c9f0e03091f2cdda002301d2c95ae74b1e8049` | IDENTICAL |
| `tests/turnstile-328-20261014-cookie-session.browser.mjs` | `869156b2e95d1fd85b4c41910383c5e575ea318c21fb2ea6f33360fdc54cc401` | IDENTICAL |
| `tests/xlsx-370-20261014-formula-precision.test.ts` | `e407b8b3dde2462985e0aaccbde565c28479bb18c17b7e2e02c49aca30d3a8f1` | IDENTICAL |
| `tests/xlsx-370-20261014-import-numeric-worker6.test.ts` | `549480a7a2fd6462064aaa4541c97d65e7ceca5c103458707c064405577f9e09` | IDENTICAL |

### Consegna del checkpoint

Questo checkpoint documentale viene salvato su change branch `docs/lane01-wave001-handoff-20261015`, non su main applicativo. Il prompt di trasporto è `/Users/domenico/ControlCenter/src/controlcenter-ops/tasks/20260929-main-release-closure/310-prompt-to-prompt-20261015/01-WAVE-001-COS.prompt.md`. È owned lane01, locale e NON_PUSHED nella superficie Ops: nessuna lease Git Ops concessa a questa chat. Responsabile integrazione Ops Core07, prossimo passo acquisizione del solo file prompt sotto lease nominativa; preservare il WIP 297 di altro owner. Il file non sostituisce questo checkpoint o il tracker. Review documentale: quattro ticket originali/path disgiunti, gate closure #378 circoscritto, billing/public release, schema risposta e lifecycle verificati; nessuna suite applicativa eseguita da Codex per soli documenti.
