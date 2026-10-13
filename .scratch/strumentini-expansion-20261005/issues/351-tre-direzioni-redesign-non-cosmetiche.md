# 351 — Tre direzioni redesign non cosmetiche

**What to build:** Minimal/editoriale/workspace mostrano gli stessi journey desktop/mobile.

**Traces to:** OWN-16 OWN-17; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-351.1: Minimal/editoriale/workspace mostrano gli stessi journey desktop/mobile.
- [ ] AC-351.2: Confronto include IA/interazioni non solo colori.
- [ ] AC-351.3: Tre prototipi cliccabili eseguono gli stessi job PDF merge, CSV cleaning e UTM export con stati errore/progresso/risultato, testati a 320/390/768/1024/1440 e confrontati su IA, tastiera e rubrica predefinita.

**Verification:** Prototipi e rubric 320/390/1440; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Nessuna scelta visuale deve precedere la creazione dei tre prototipi. #352 seleziona soltanto dopo confronto; hardware/server non sono precondizioni dello studio.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## Owner round Strumentini — 13 ottobre 2026

Scelta del design rinviata alla fine e svolta manualmente dall’owner. Nessuna direzione scelta in questo round; continuare i ticket tecnici indipendenti senza imporre una scelta anticipata.

Decisione acquisita, non nuova implementation/runtime acceptance; status e checkbox esistenti invariati. Tutto il lavoro autorizzato resta nello scope, riuso prima del codice e gate originali preservati.
