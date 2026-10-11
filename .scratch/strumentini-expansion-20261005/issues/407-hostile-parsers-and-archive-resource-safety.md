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

## 2026-10-11 implementation wave 03 — scoped evidence

`src/runtime/file-threat-gate-407.ts` integrated with real `src/runtime/file-detection.ts` candidate screening and `tests/file-threat-gate-407.test.ts` 12/12 plus detector 18/18 PASS. Bounded ZIP symlink/traversal/descriptor/gaps/nested compressed XML/SVG/XXE/script, PDF risky tokens observed; signal cancellation/resource caps and no upload. It does not certify deep PDFs >256KiB/unparsed object streams, all parsers, full archive extraction or malicious file handling past detector; no full production Gold.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 09 — ZIP pathname normalization and Windows reserved targets

An independent hostile ZIP fixture demonstrated that two central-directory names `archive/report.txt` and `archive/ｒｅｐｏｒｔ.txt` were both accepted despite resolving to the same NFKC-normalized path, and `CON`, `NUL.txt`, `AUX.xml`, `COM1`, `LPT9.log` and fullwidth device aliases were accepted as members. A fullwidth separator `folder／file.txt` could also change path segmentation after normalization. These cases are not safe assumptions for consumers extracting onto different filesystems.

The bounded preflight now checks duplicate *canonical* member identities (`normalize('NFKC').toLowerCase()`), rejects reserved DOS/Windows device names with extensions in any segment, and rejects Unicode normalization that changes segment count or exceeds path-depth limits. No ZIP extraction, upload or new dependency was added. Two tests reproduced these failures **RED** before the fix; `vitest run tests/file-threat-gate-407.test.ts tests/file-detection-333.test.ts` **32/32 PASS** afterward, preserving ordinary ZIP and OOXML examples. This is an additional fail-closed pathname gate, NOT proof that every downstream extraction implementation is sandbox-safe, nor deep PDF/SVG analysis. Ticket remains `ready-for-agent`, with original global AC unmarked, release and Gold NO-GO.
