# 353 — IA e design system dopo scelta

**What to build:** Tokens/componenti/IA approvati sostituiscono baseline.

**Traces to:** OWN-16 OWN-17; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 352

**Status:** blocked

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** advanced

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-353.1: Tokens/componenti/IA approvati sostituiscono baseline.
- [ ] AC-353.2: Font licensing, contrasto, SEO e navigation preservati.
- [ ] AC-353.3: Dopo il record datato #352, documentare IA e token coerenti con la variante scelta e verificarli contro golden screen a 320/390/768/1024/1440, chiaro/scuro, focus/tastiera, zoom 200% e link esistenti; difformità blocca la migrazione.

**Verification:** Golden screens e style contract; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Approvazione #352 indispensabile, ma approvazioni hardware/server/licenze riguardano soltanto componenti downstream pertinenti.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## Owner round Strumentini — 13 ottobre 2026

Controlli professionali: l’integratore espone le azioni necessarie e principali, organizza progressivamente i dettagli secondo il caso. Non nascondere funzionalità essenziali o ridurre lo scope avanzato.

Decisione acquisita, non nuova implementation/runtime acceptance; status e checkbox esistenti invariati. Tutto il lavoro autorizzato resta nello scope, riuso prima del codice e gate originali preservati.
