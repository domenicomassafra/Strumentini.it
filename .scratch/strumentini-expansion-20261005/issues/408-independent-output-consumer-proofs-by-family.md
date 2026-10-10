# 408 — Independent output consumer proofs by family

**What to build:** Real PDF PNG CSV DOCX XLSX audio outputs reopen in independent consumers

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

- [ ] AC-408.1: Real PDF PNG CSV DOCX XLSX audio outputs reopen in independent consumers.
- [ ] AC-408.2: Wrong MIME truncated bytes and empty no fake success.
- [ ] AC-408.3: On the scoped input and failure cases, verify: Cross-family fixture and binary checks. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Cross-family fixture and binary checks; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 02 — bounded local evidence

Independent offline consumer verifier `scripts/verify-output-consumers-408.ts` reopens real locally generated PDF (pdfjs-dist), PNG (sharp), CSV (independent CSV reader), DOCX (fflate+sax), XLSX (read-excel-file), WAV (strict RIFF PCM16 reader). `tests/output-consumers-408.test.ts` 8/8 PASS, command output six PASS_LOCAL with concrete metadata and SHA-256 per run; hostile wrong-MIME/extension, empty/truncated, ZIP expansion/CRC, malformed CSV fail-closed. Office desktop rendering, physical audio playback, UI download, mobile physical NOT_RUN. No Gold receipt written.

**Disposition:** implementation slice demonstrated locally only; do not infer original AC closure, Gold promotion, deployed feature or physical-device pass.
