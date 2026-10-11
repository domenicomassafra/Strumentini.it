# 408 — Independent output consumer proofs by family

**What to build:** Real PDF PNG CSV DOCX XLSX audio outputs reopen in independent consumers

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [x] AC-408.1: Real PDF PNG CSV DOCX XLSX audio outputs reopen in independent consumers.
- [x] AC-408.2: Wrong MIME truncated bytes and empty no fake success.
- [x] AC-408.3: On the scoped input and failure cases, verify: Cross-family fixture and binary checks. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Cross-family fixture and binary checks; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 02 — bounded local evidence

Independent offline consumer verifier `scripts/verify-output-consumers-408.ts` reopens real locally generated PDF (pdfjs-dist), PNG (sharp), CSV (independent CSV reader), DOCX (fflate+sax), XLSX (read-excel-file), WAV (strict RIFF PCM16 reader). `tests/output-consumers-408.test.ts` 8/8 PASS, command output six PASS_LOCAL with concrete metadata and SHA-256 per run; hostile wrong-MIME/extension, empty/truncated, ZIP expansion/CRC, malformed CSV fail-closed. Office desktop rendering, physical audio playback, UI download, mobile physical NOT_RUN. No Gold receipt written.

**Disposition:** implementation slice demonstrated locally only; do not infer original AC closure, Gold promotion, deployed feature or physical-device pass.

## 2026-10-11 wave 05 — source-local independent output-format acceptance completed

Reverified against current local source after commit `5f1c179` using `vitest run tests/output-consumers-408.test.ts --maxWorkers=2`: **8/8 PASS**, and standalone `tsx scripts/verify-output-consumers-408.ts`: **all six real locally generated families PASS_LOCAL**, independently read by pdfjs-dist (PDF), sharp/libvips (PNG), separate bounded RFC4180 decoder (CSV), ZIP+sax XML parser (DOCX), read-excel-file (XLSX), separate strict RIFF/PCM16 parser (WAV). Each passing readback records actual byte length, SHA-256 and structural data; no browser mock is substituted for the independent consumer. Explicit adversarial tests show wrong MIME/extension, empty/truncated, cross-labeled binary, malformed CSV, ZIP CRC and inflation-bomb refuse rather than falsely claim success.

**Closure scope:** These original AC describe *format-level independent reopening and binary checks*; those now pass. This is not a claim that Microsoft Word/Excel layout, native audio playback, all file/codec variants, physical devices or UI download across every tool passed. They are explicitly NOT_RUN in the verifier and remain separate product/release validation; no Gold promotion, server/network usage or deploy. The old wave02 disposition above predates this current independently repeated acceptance and is superseded for #408's bounded source-local AC.
