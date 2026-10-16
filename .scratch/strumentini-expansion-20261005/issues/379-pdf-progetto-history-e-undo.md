MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 379 — PDF progetto history e undo

**What to build:** Progetti edit PDF opt-in con undo redo e restore

**Traces to:** OWN-05 OWN-09; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** 372

**Status:** blocked

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** advanced

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-379.1: Progetti edit PDF opt-in con undo redo e restore.
- [ ] AC-379.2: Version mismatch e tab crash non cancellano originale.
- [ ] AC-379.3: On the scoped input and failure cases, verify: Save reload restore hash tests. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Save reload restore hash tests. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## Owner round Strumentini — 13 ottobre 2026

Preparare un documento da inviare è un primo percorso esemplare, non l’unico deliverable. Scope completo PDF, incluse aggiunta/annotazione e correzione del testo esistente quando tecnicamente supportata; capacità distinte e prove proprie. Parallelizzare ticket ready disgiunti con subagenti nativi entro capacità reale; nessuna falsa promessa di completamento o downgrade a una sola verticalità.

Decisione acquisita, non nuova implementation/runtime acceptance; status e checkbox esistenti invariati. Tutto il lavoro autorizzato resta nello scope, riuso prima del codice e gate originali preservati.
