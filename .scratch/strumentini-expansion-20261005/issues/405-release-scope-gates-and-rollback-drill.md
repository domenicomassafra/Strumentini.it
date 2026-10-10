# 405 — Release scope gates and rollback drill

**What to build:** Promotion requires current source receipt for chosen scope and proven rollback

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** 347,404

**Status:** blocked

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-405.1: Promotion requires current source receipt for chosen scope and proven rollback.
- [ ] AC-405.2: Stale Gold or missing physical receipt prevents relevant release.
- [ ] AC-405.3: On the scoped input and failure cases, verify: Staging canary rollback restore and evidence manifest. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Staging canary rollback restore and evidence manifest; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 03 — scoped evidence

Read-only `scripts/verify-release-scope-405.ts` with `tests/release-scope-405.test.ts` (8/8 PASS), full source/Worker+D1 fingerprint, scope IDs, Gold/browser/physical/rollback/cumulative/staging receipts and artifact fingerprints all fail closed. Isolated previous→candidate→previous rollback drill has authority LOCAL_FIXTURE_ONLY and refuses tamper/missing/cancel. Actual repo CLI `--scope=pdf-rotate` NO_GO: stale evidence/physical/staging/cumulative missing, worktree dirty. No live stage or promotion; AC-405.3 real canary NOT_RUN.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.
