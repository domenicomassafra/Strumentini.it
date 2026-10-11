# 348 — Server opt-in gratis feasibility

**What to build:** Comparare locale/server per quota hard costo e consenso.

**Traces to:** OWN-10 OWN-14; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-348.1: Comparare locale/server per quota hard costo e consenso. **Feasibility/NO_GO:** confronto e fonti ufficiali del 2026-10-11 in `docs/feasibility-server-optin-348-2026-10-11.md`, con piano/account/costo reale esplicitamente sconosciuti.
- [x] AC-348.2: Over-quota fallback locale o indisponibile, mai upload silenzioso. **Verificato nell'ambito feasibility:** checker statico blocca nuove route e primitive di trasporto, simulatore quote rifiuta con fallback `local`/`unavailable`, senza introdurre alcun server job. Runtime end-to-end, vendor e azioni future `NOT_RUN` (non è un certificato di assenza universale di upload).
- [x] AC-348.3: On the scoped input and failure cases, verify: Budget/stress/threat model. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent. **Verificato:** test negativi, limiti CPU/byte/D1/requests, minacce e casi non verificabili con decisione `NO_GO`, nessun deploy.

**Verification:** Budget/stress/threat model; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

**Proof 2026-10-11:** `npx vitest run tests/feasibility-server-optin-348.test.ts` **11/11 PASS**; `npx tsx scripts/feasibility-server-optin-348.ts` **PASS** con `baselineSafe=true`, `serverMode=NO_GO`, 19 route, 0 violazioni, 1.620 file ispezionati nella sorgente first-party in scope. Studio e limiti in `docs/feasibility-server-optin-348-2026-10-11.md`; implementazione eseguibile in `scripts/feasibility-server-optin-348.ts`. **Il ticket è chiuso come studio di fattibilità negativo**, non come autorizzazione all'esecuzione server; verifiche live/consenso fisico/quote account assenti sono etichettate `NOT_RUN`.
