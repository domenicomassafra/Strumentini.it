# 407 — Hostile parsers and archive resource safety

**What to build:** File parsers refuse dangerous zip SVG XML PDF object graphs before materializing

**Traces to:** OWN-03 OWN-10; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-407.1: File parsers refuse dangerous zip SVG XML PDF object graphs before materializing.
- [ ] AC-407.2: Zip bombs XXE script/path traversal cannot escape sandbox/limits.
- [ ] AC-407.3: On the scoped input and failure cases, verify: Threat fixtures adversarial and resource tests. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Threat fixtures adversarial and resource tests; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.
