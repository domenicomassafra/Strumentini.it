# 406 — Independent PDF redaction attack corpus

**What to build:** Adversarial signed/hybrid/incremental metadata PDFs produce safe refusal or proven post-export erasure

**Traces to:** OWN-04; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-406.1: Adversarial signed/hybrid/incremental metadata PDFs produce safe refusal or proven post-export erasure.
- [ ] AC-406.2: No recovery via alternate parser viewer byte grep or thumbnail.
- [ ] AC-406.3: On the scoped input and failure cases, verify: PDFKit PDFium Poppler forensic differential. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** PDFKit PDFium Poppler forensic differential; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 — Independent source-trailer contradiction / forensic output wave (worker-14)

**RED functional defect:** A genuine incremental PDF with two valid xref sections and /Prev in its effective trailer was accepted by the PDF secure-redaction pre-render source gate if a later harmless-looking PDF comment contained a decoy trailer dictionary without /Prev. The internal parser chose the last literal word trailer; independent strict pypdf followed the real /Prev, and PDF.js extracted the recoverable hidden source text. Test tests/pdf-redaction-attack-406.test.ts reproduced **RED** (expected refusal, source gate accepted one page). All bytes were synthetic and derived from the existing checked-in adversarial fixture, with unchanged effective xref offsets; the issue is misleading **source admission**, not evidence of sensitive bytes in a produced export.

**GREEN bounded fix:** The approved source-only engine src/engines/pdf/secure-raster-redaction-237.ts now refuses anything other than one syntactically recognized startxref and one %%EOF marker before trusting the in-house trailer. It does not modify the shared parser or allow unsigned/unparsed multiple revisions. Focused tests #406 (2) and existing #237 (18 + 15) **35/35 PASS**; scoped strict TypeScript with Astro module types PASS.

The new adversarial case also calls the actual redactPdfRaster237 export function with hostile bytes and proves a rejected Promise before it can produce a PDF artifact (not just helper-function refusal).

**Real exported output independently re-opened:** The existing DEV-only browser forensic runner scripts/acceptance-pdf-redaction-237-dev.browser.mjs **PASS, exit 0** on current engine. Two genuine PDF downloads (ordinary two-page and covered hidden text with orphan bytes) were independently checked by PDF.js, pypdf + decoded Flate RGB pixel inspection, pdfminer.six, and macOS PDFKit/CoreGraphics copy/print/reopen. Selected pixels black, source-only secrets absent from output, unaffected visual pixels present, malformed-source refusal and zero offsite browser requests. This is current desktop local proof for two supported examples, **not** an export from the rejected incremental attack and **not** production/physical-mobile approval. Detailed receipt docs/PDF-REDACTION-ATTACK-406.md.

**Original AC-406.1–3 remain OPEN / unchecked:** PDFium, Poppler, physical iOS/Android, more signed/hybrid/metadata variants, alternate-editors and total corpus leak-proofness are NOT_RUN. No Gold/receipt promotion, release, commit, push or deploy; only approved #406 source/test/docs/ticket files edited.
