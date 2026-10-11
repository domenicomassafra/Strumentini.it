# 340 — Cronologia in-session e cancella task

**What to build:** Tre operazioni consecutive con risultati recuperabili in sessione.

**Traces to:** OWN-08 OWN-09; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 337,338

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-340.1: Tre operazioni consecutive con risultati recuperabili in sessione.
- [ ] AC-340.2: Reload/memoria insufficiente dichiarano limiti e no fake undo.
- [ ] AC-340.3: On the scoped input and failure cases, verify: 3-stage chain with cancel and hash. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

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
