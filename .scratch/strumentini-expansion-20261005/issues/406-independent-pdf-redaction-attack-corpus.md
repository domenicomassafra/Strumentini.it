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

## 2026-10-13 native Chat On Steroids wave4 — single-revision hybrid xref hidden by trailer comment

**New independent RED, different from the prior two-EOF attack:** `tests/pdf-redaction-406-20261013-hybrid-single-revision.test.ts` constructs an actual single-revision PDF with exactly **one** `startxref`, **one** `%%EOF`, a genuine binary `/Type /XRef` cross-reference stream, and a classic cross-reference table whose **effective** trailer contains `/XRefStm <real stream offset>`. A later PDF **comment** contains a decoy `trailer << /Root ... >>` without `/XRefStm`. The current in-house parser used the last occurrence of the word `trailer`, not the effective cross-reference table, so the pre-render `assertSupportedSource237` **accepted** the dangerous unreviewed hybrid variant (actual Vitest RED: `expected function to throw; received undefined`). Independently, **pypdf PdfReader(strict=True)** read its one page, followed the effective `/XRefStm`, and extracted the hidden source-only text; **PDF.js** read/extracted the same source text; **macOS PDFKit** independently read its page/text. The fixture is structurally valid under those independent consumers, not an authenticated digital signature. No PDF output was created from the hostile source.

**Smallest source-only GREEN:** In `src/engines/pdf/secure-raster-redaction-237.ts` the deliberately bounded admission profile now reads the numeric `startxref` byte offset and requires it to point at an actual classic `xref` table. It requires exactly one unambiguous trailer line in that table's footer and refuses when the global parser's last literal `trailer` points instead to a later comment. This is **fail-closed** on xref streams/hybrid ambiguity, not a generic xref-stream implementation; the shared `parser.ts`, raster writer and verification path are unchanged. The real public `redactPdfRaster237` entrypoint also rejects the hostile file before rendering and cannot return an artifact. The harmless classic PDF source still admits one page. A pre-aborted redaction returns `AbortError`, followed by fresh clean source admission; a complete post-abort browser export was not rerun here.

**Fresh focused evidence:** `./node_modules/.bin/vitest run tests/pdf-redaction-406-20261013-hybrid-single-revision.test.ts tests/pdf-redaction-attack-406.test.ts tests/pdf-redaction-237.test.ts tests/pdf-redaction-malicious-corpus-237.test.ts` **PASS 38/38** (new three tests, old #406 two, existing #237 18 plus hostile corpus 15). Scoped `tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --types node,astro/client --skipLibCheck --allowImportingTsExtensions` against the changed engine/new test **exit 0**. No real export was intentionally made from rejected hybrid input; **PDFium/Poppler/qpdf not installed on this Mac, NOT_RUN**. No new Gold, complete forensic erase claim, public release, native mobile/device matrix or CI acceptance; original **AC-406.1–3 OPEN** and #237 security gates unchanged. Integration/PR/preview/merge belong to prime.

**Wave4 integration follow-up (fresh):** The integrator independently found four `astro check` TS diagnostics in the first version of the fixture builder due to potentially absent regexp capture groups. Added a concrete fail-closed fixture invariant requiring both the xref-entry table and effective trailer before any access, without suppressions or loosening the source admission. Re-ran the actual independent readers and entire focused suite: **38/38 PASS**; scoped strict `tsc` **exit 0**; full `./node_modules/.bin/astro check` **exit 0, 2043 files, 0 errors, 0 warnings, 24 unrelated hints**. Neither #237 engine correctness nor original #406 security AC is overstated by those tool-level passes.

## 2026-10-13 — PR #18 independent P2 follow-up: legal trailer trivia and bounded scan (worker-4)

**Real RED on prior PR head `13343d68`:** Two independent byte-level variations of the existing authentic one-revision classic-xref PDF place permitted PDF lexical trivia between the effective `trailer` keyword and `<<`: (a) `trailer % benign legal comment\n<<`, (b) `trailer\f<<`. Both were parsed as one page by `pypdf.PdfReader(strict=True)`, PDF.js and the existing `parsePdf`, and previously by macOS PDFKit; the new `assertSupportedSource237` guard instead refused them with `REDACTION_REFUSED: Trailer PDF ambiguo`. Separately, 500,000 `trailer\n` tokens in a malformed xref footer yielded a roughly 4 MiB source and exhausted the V8 heap of an **isolated** Node child capped at 48 MiB due to materializing every regexp match. New `tests/pdf-redaction-406-20261013-trailer-lexical-bounds.test.ts` first produced **RED: 3 failures / 4 tests**, with two false refusals and one child-process OOM; the second-trailer refusal remained green. This was a synthetic attack/compatibility test, not an OS/device OOM measurement or redaction leak.

**Small source-only GREEN:** `src/engines/pdf/secure-raster-redaction-237.ts` uses bounded first/second regexp `.exec()` rather than materializing matches for `startxref`, `%%EOF`, and effective xref-table `trailer`. The exact byte-offset requirement for one classical xref table and global final-trailer equality remain unchanged. Between the unique trailer token and `<<`, its lexical scan now tolerates the same PDF whitespace and `%` comments already recognized by the shared parser. A second effective trailer, any later decoy `trailer` masking `/XRefStm`, multiple xref/EOF sections and the unsupported `/Prev`/`/XRefStm`/linearized models remain fail-closed. The shared PDF parser, output writer and full-byte canonical erasure verification are untouched. This deliberately is **not** broad support for any otherwise ambiguous PDF or a guarantee against unreviewed parser differentials.

**Verification / remaining gates:** Focused regression includes actual strict pypdf, PDF.js and on macOS PDFKit parsing of the two new admissible sources, a rejected second trailer, plus the genuine existing one-EOF hybrid stream with comment decoy and rejected incremental revision. Source-level bounded stress now refuses the 4 MiB malformed input under a 48 MiB child-process V8 heap; an independent post-fix sample of 500,000 candidates refused in ~23 ms with negligible observed heap growth, versus the previous measured ~69 MiB allocation. **All five focused Vitest files 42/42 PASS** (38 previously passing + 4 new) and scoped strict TypeScript PASS. These results are local source/consumer proof only, not PDFium, Poppler, physical device, current production PDF Gold, release, rollback, or whole-corpus irreversibility. **AC-406.1–3 remain unchecked and original ticket OPEN / NO-GO** until external forensic differentials and device/release evidence exist. Changes limited to the owned engine file, new #406 test and this ticket; no shared parser/other worker files, Git commit/push/PR comment/merge or deploy.
