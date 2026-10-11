# 404 — Change scoped CI and cumulative release validation

**What to build:** Affected engine and integration tests run each batch, cumulated release gates before publish

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-404.1: Affected engine and integration tests run each batch, cumulated release gates before publish.
- [ ] AC-404.2: Safety/physical checks cannot be waived by labels.
- [ ] AC-404.3: On the scoped input and failure cases, verify: Synthetic UI/Worker/engine diff pipeline mapping. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Synthetic UI/Worker/engine diff pipeline mapping; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 01 — bounded evidence

Git-aware source change-impact and non-deployment GitHub CI workflow created; eight focused tests PASS; GitHub remote workflow and mandatory physical/security/official-source release gates NOT_RUN.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 follow-up — fail-closed scope mapping, still OPEN

Independent audit identified two holes in the source-change classifier: executable Python/JS ticket validators beneath `.scratch/` were treated as docs-only, while the actual `image-visual/`, `image-resize/` and top-level `Pdf*` tool components were not all mapped to the image/PDF device gates. Regression tests reproduced both false classifications **before** the fix. The path classifier now treats executable ticket generators as CI code (full source regression), and real image/PDF component families as frontend + their engine domain, preserving affected test selection and physical-device `NOT_RUN` gates. `tests/ci-change-impact-404.test.ts`: **10/10 PASS** on the local checkout.

The GitHub branch `main` was read independently via authenticated API and matched local `origin/main` at `d0947cc` before this change. However the updated CI workflow has **not run remotely** and no release candidate or real browser/physical/security gate was approved. `AC-404.1` remains open for cumulative release validation before publication; the scoped test demonstrates correct mapping rather than production readiness. Do not close the ticket, issue a Gold receipt, push or deploy based on this follow-up alone.

**Independent security review follow-up:** the first patch still omitted the actual `src/runtime/ephemeral-file-handoff-337.ts` from the mandatory security-review gate. A test reproduced this omission (RED), then the classifier added this specific cross-window capability protocol to security-sensitive runtime inputs: focused CI tests **11/11 PASS**. This flags the required external security review as `NOT_RUN`; it does not perform that review or declare a release ready.
