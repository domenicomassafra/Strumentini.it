# 363 — Budget memoria mobile editor reali

**What to build:** Misurare device memoria/frame/input S M L per editor futuri.

**Traces to:** OWN-06 OWN-05; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/manifest.json; desktop browser 390px is not physical iOS/Android memory and crash acceptance. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-363.1: Misurare device memoria/frame/input S M L per editor futuri.
- [ ] AC-363.2: OOM e cancel non devono corrompere risultato.
- [ ] AC-363.3: Misurare su iOS Safari e Android Chrome fisici con modello/OS/browser/revisione noti fixture sintetiche S/M/L di PDF, immagini e CSV; acquisire budget/process evidence disponibile, cold/warm, background, annullamento e reopen output. Hardware assente resta NOT_RUN senza simulare soglie universali.

**Verification:** Real device traces con dati sintetici; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Servono dispositivi reali per chiudere la misurazione; non è richiesta né scelta visual #352 né modalità server #348. Hardware assente: NO-GO/NOT_RUN soltanto per le prove fisiche.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.
