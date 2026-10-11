# 340 — Cronologia in-session e cancella task

**What to build:** Tre operazioni consecutive con risultati recuperabili in sessione.

**Traces to:** OWN-08 OWN-09; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 337,338

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-340.1: Tre operazioni consecutive con risultati recuperabili in sessione.
- [x] AC-340.2: Reload/memoria insufficiente dichiarano limiti e no fake undo.
- [x] AC-340.3: On the scoped input and failure cases, verify: 3-stage chain with cancel and hash. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** 3-stage chain with cancel and hash; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## Proof parziale del 2026-10-11 — perimetro Workbench

Implementato `src/workbench/session-history-340.ts` come archivio **esclusivamente in memoria di pagina**, senza IDB, sessionStorage, rete o sincronizzazione. Conserva al massimo **tre snapshot binari indipendenti** (1 MiB per risultato, 3 MiB complessivi), SHA-256 verificabile a ogni recupero, legame al digest del risultato precedente, numero massimo di tre task simultanei, cancellazione per task con `AbortSignal`, rifiuto delle risposte tardive, eliminazione esplicita dei soli dati in memoria (`forget`), invalidazione con `dispose`. Quota insufficiente o hash non disponibile lasciano intatti gli snapshot precedenti; nessuna promessa di undo di effetti esterni. Una nuova istanza/reload parte vuota e dichiara `reload: cleared` e `undoSupported: false`.

Test RED iniziale: `npx vitest run tests/session-history-340.test.ts` falliva con `Cannot find module` prima dell'implementazione. Test GREEN: **6/6 PASS** dopo la creazione del modulo. Il caso principale esegue **tre motori locali reali** in catena (`normalizeWhitespace` → `convertTextCase` → `encodeBase64Bytes`) e recupera il risultato finale `QUJD`; il digest SHA-256 del primo risultato `abc` coincide con il noto vettore `ba7816bf…15ad`. Negativi: cancellazione e successo tardivo scartato, digest falsificato e antenato mancante, errore del motore, payload invalido, limite numero/byte, numero massimo di task, memoria scaduta dopo nuova istanza, copia recuperata mutabile senza alterare lo snapshot originale.

**Stato AC:** `AC-340.1` **PARTIAL** (prove con motori locali reali nel modulo, ancora **NOT_RUN** nel percorso UI); `AC-340.2` **PARTIAL** (quota e reload verificati nel modulo, informazione/focus utente **NOT_RUN**); `AC-340.3` **PARTIAL** (catena/cancel/hash con test automatizzati, prova UI/browser reale **NOT_RUN**). **Status invariato:** `ready-for-agent`; criteri originali non spuntati, nessuna prova di integrazione con un tool visibile all'utente. Il modulo è pronto per una successiva integrazione UI isolata, con controllo della semantica della cancellazione e dell'accessibilità, prima di qualsiasi chiusura del ticket.

## Accettazione UI indipendente — 2026-10-11, wave successiva a `cb575662`

**Evoluzione delle prove:** la nota precedente descriveva il solo engine e il blocco UI **prima di questa wave**. Ora esiste un'interfaccia pubblica reale nella **rotta canonica già registrata `/preferiti/`** (`src/pages/preferiti.astro`, unica nuova importazione dell'isola client `src/components/workbench/SessionChain340.tsx`; nessuna nuova pagina o modifica al catalogo/manifest). La sezione «Catena di tre operazioni locali» espone campo testo con label, tre comandi eseguibili in sequenza e singolarmente annullabili, tre ricevute SHA-256 con digest del predecessore, recupero verificato di ciascun risultato in campo readonly, annunci `role=status` e tasti nativi utilizzabili anche con tastiera. Nessun account richiesto. La lista «Recenti» esistente è separata: l'isola non invoca gli hook di persistenza, la telemetria o `recordCompletedTool`.

**RED→GREEN:** creato `tests/session-chain-340.browser.mjs`; il RED iniziale su vecchia build falliva per `locator('[data-session340]')` assente. Test GREEN **PASS** in Chromium Playwright reale, viewport **390×844**, su nuova build statica locale. Test eseguito con `node tests/session-chain-340.browser.mjs`, exit 0, pagina `/preferiti/`, input effettivo `"  abc    "`: motori di produzione **`normalizeWhitespace` → `convertTextCase({mode:'upper'})` → `encodeBase64Bytes`** producono e recuperano indipendentemente i byte UTF-8 **`abc` → `ABC` → `QUJD`**. SHA-256 delle tre ricevute verificato dal test contro digest calcolati indipendentemente con Node `crypto.createHash`, due digest `parentSha256` visibili; recupero per ciascuno verificato come contenuto reale di textarea readonly, ultimo risultato esattamente **4 byte**. Prima operazione attivata da tastiera; tre step usabili senza overflow orizzontale a 390 px.

**Annullamento/limiti reale UI:** dopo svuotamento esplicito della sola cronologia (nessun rollback esterno promesso), avvio del task 1 e pressione «Annulla» → stato annullato e **zero ricevute anche dopo attesa superiore alla finestra di esecuzione**; il task 2 resta disabilitato senza genitore verificato. Nuovo input di **60.000 caratteri**: i primi due risultati vengono conservati, la Base64 (80.000 byte) supera la quota **64 KiB per risultato** scelta per UI mobile (192 KiB totali; inferiore ai massimali 1 MiB/3 MiB del motore), viene rifiutata senza eliminare i due risultati validi; il risultato del secondo task è recuperato con 60.000 caratteri esatti. Reload: **zero ricevute, zero contenuto recuperato e task successivi disabilitati**, nessuna falsa funzione undo o persistenza. L'interfaccia avvisa esplicitamente che cambiare pagina/ricaricare cancella tutto. Browser registrato con strumentazione **post-idratazione** delle API Storage (`localStorage`/`sessionStorage` + apertura IndexedDB), `fetch`/XHR/`sendBeacon`: **zero accessi Storage e zero chiamate di rete aggiuntive durante la catena, cancellazione, rifiuto, recupero**; la pagina esterna all'isola può normalmente usare account GET e membership IDB al caricamento, e il test non confonde queste attività col nuovo componente. Zero `pageerror`.

**Verifiche e integrità:** `./node_modules/.bin/vitest run tests/session-history-340.test.ts` → **6/6 PASS**; `./node_modules/.bin/vitest run tests/design-system.test.ts tests/session-history-340.test.ts` → **20/20 PASS**; `tsc --ignoreConfig --noEmit --skipLibCheck --pretty false --strict --jsx react-jsx --jsxImportSource preact --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom src/workbench/session-history-340.ts src/components/workbench/SessionChain340.tsx` → **PASS**; `node --check tests/session-chain-340.browser.mjs` e `git diff --check` → **PASS**. **Un solo** `./node_modules/.bin/astro build` → exit 0, **292 page(s) built**, rotta `dist/preferiti/index.html` presente, identico conteggio statico pre-modifica di 292; nessun catalogo o generatore modificato. Dopo la build, solo CSS dell'isola è stato riallineato ai token esistenti (`--border-width`, `--focus-*`, `--font-weight-bold`, ecc.); il test browser che ha superato la prova eseguiva gli **stessi asset JS/markup funzionali** appena compilati, mentre un'eventuale verifica bit-per-bit del CSS finale spetta al gate globale del coordinatore.

**Criteri originali ora soddisfatti nel perimetro di accettazione dichiarato:** AC-340.1 = **PASS UI 3 motori reali con recupero byte e hash**; AC-340.2 = **PASS limite + reload + avviso e no fake undo**; AC-340.3 = **PASS annullamento, prove SHA, negativo e test browser vero**. **NOT_RUN:** dispositivi fisici iOS/Android, browser WebKit/Firefox, deploy ed esecuzione sulla produzione. La presente accettazione locale non costituisce certificazione Gold né approvazione al deploy; il coordinatore esegue l'ultimo controllo di integrazione comune prima della distribuzione. Nessun commit, push o deploy eseguito da questo worker.
