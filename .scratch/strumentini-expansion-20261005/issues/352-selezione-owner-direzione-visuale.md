MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 352 — Selezione owner direzione visuale

**What to build:** Owner approva o chiede revisione fra prototipi equivalenti.

**Traces to:** OWN-17; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 351

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** cross-cutting

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-352.1: Owner approva o chiede revisione fra prototipi equivalenti.
- [ ] AC-352.2: Senza decisione nessuna palette/font finali.
- [ ] AC-352.3: Decisione owner datata con link alle tre alternative comparabili, punteggi della stessa rubrica, motivazione e scelta A/B/C oppure richiesta di iterazione. Senza decisione la selezione resta PENDING e non viene simulata.

**Verification:** Record approvazione e rubric; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** La decisione umana esplicita dell'owner e solo quella è il gate del ticket; niente auto-approvazione, dipendenza circolare, dispositivo fisico o server richiesti per valutare un prototipo.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.
