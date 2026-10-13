# 378 — True redaction security independent gate

**What to build:** Rimozione irreversibile verificata su sottinsieme esplicito

**Traces to:** OWN-04 OWN-05; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** cross-cutting

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-378.1: Rimozione irreversibile verificata su sottinsieme esplicito.
- [ ] AC-378.2: Firmato/hybrid/metadata/orfani rifiutati se incerti.
- [ ] AC-378.3: On the scoped input and failure cases, verify: Independent PDFKit/Poppler forensic. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Independent PDFKit/Poppler forensic. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## 2026-10-11 wave 15 — independent local output acceptance harness; partial / NO-GO for release

**Exclusive source ownership:** new `scripts/forensic-redaction-378.ts`, new `tests/forensic-redaction-378.test.ts`, this original #378 ticket only. Original PDF #237 producer/verifier, the #406 source hardening and hostile corpus, #394, #330, visual UI, shared CI and provider code were read-only. Baseline in this worker: local HEAD `39e07827` plus unrelated concurrent worktree edits. `pypdf 6.16.1`, Pillow and native macOS PDFKit via `/usr/bin/swift` were available; **Poppler binaries were not installed**, so Poppler evidence is **NOT_RUN**, not a simulated PASS.

**Distinct actual security gap and RED:** The existing #237 external pypdf forensic fixture checks visual pages, a few explicitly named source markers and black raster pixels, but does not require that **every xref-indexed object in the exported PDF be reachable** from its actual catalog. A fresh real, structurally parseable image-only PDF carrying an **unreferenced stream with recoverable private bytes** passed those surface checks and the initial independent #378 harness with a **false acceptance**. New `tests/forensic-redaction-378.test.ts` reproduced the false PASS as an actual failing assertion before the fix (**RED**); this was not a repeat of #406's `/Prev` / decoy-trailer *source admission* bypass.

**Functional external gate:** The standalone local TypeScript CLI/library accepts bounded **actual source and output PDF byte buffers**, a page/rectangle plan and explicitly verified source-witness tokens. It launches strict independent **Python pypdf** via bounded stdin (no PDF tempfile, network, donor or service), compares the complete reachable indirect-object reference graph to all declared physical xref entries and **refuses any orphan**, checks source witnesses absent from output raw bytes and decoded image bytes, rejects document Info/catalog metadata, embedded objects, unsupported page resources/text operators, additional/revised EOF, altered page geometry and any **non-black decoded RGB pixel** in an intended redaction mask. A second independent **native macOS PDFKit** parser must reopen the same output bytes, find no copyable text or annotations and confirm rendered black sample pixels. The two required parsers must both succeed; missing executable/timeout/invalid evidence is an explicit `FORENSIC_378_REFUSED`. Only a limited machine-readable `INDEPENDENT_SAMPLE_PASS_NOT_RELEASE` receipt is produced. Real source witnesses are passed to pypdf by stdin only, **not** in PDFKit environment variables/CLI arguments. Limits: 8 MiB input, 24 MiB output, four pages, bounded pixels/regions, and bounded CLI plan. Example: `node --import tsx scripts/forensic-redaction-378.ts --source SOURCE.pdf --output OUTPUT.pdf --plan PLAN.json` (files chosen by caller; never auto-upload).

**GREEN focused evidence:** `npx vitest run tests/forensic-redaction-378.test.ts tests/pdf-redaction-237.test.ts tests/pdf-redaction-attack-406.test.ts --testTimeout=35000` **27/27 PASS**: new gate 7/7 (strict pypdf + native PDFKit on real local PDF bytes; xref orphan/embedded Info metadata/one decoded non-black pixel/hidden content rejection; absent pypdf or PDFKit fail-closed; missing source witness, empty region and trailing EOF rejection; functioning CLI subprocess; no witness leakage in limited receipt), #237 18/18 unchanged and #406 2/2 unchanged. The raster-only baseline PDF in the new unit/CLI tests is **real encoded PDF bytes authored by the existing PDF builder**, not a mock PDF parser and **not claimed to be a fresh production #237 UI download**.

**Separate end-to-end blocker:** A fresh attempt to execute the prior known real-browser artifact producer `STRUMENTINI_KEEP_FORENSICS=1 node scripts/acceptance-pdf-redaction-237-dev.browser.mjs` failed before any download because its **DEV-only route was unavailable**; no redaction artifact was obtained for the new external gate in that attempt. The generated empty private temporary directory was deleted and the isolated listener was not left running. Historical #237/#406 real-download and PDFKit results remain valid **historical evidence only**, not a new #378 gate attestation. Production/hardware iPhone/Android, Poppler, signed/hybrid/document adversarial corpus, independent human security review, authenticated plan ownership and rollback are **NOT_RUN**.

**Disposition:** Scope-specific independent fail-closed output gate implemented and test-proven; original **AC-378.1–3 remain globally unchecked / NO-GO**, because the new gate has not yet consumed a current live browser-exported #237 artifact and cannot establish full irreversible redaction/security certification across formats, alternate editors or devices. No Gold, release, commit, push or deployment.

**CI cross-platform reconciliation (2026-10-11):** GitHub Actions run `38179043578` on Ubuntu failed specifically in the two *positive native PDFKit* #378 unit/CLI fixtures because Linux has no `/usr/bin/swift`/macOS PDFKit; the security gate correctly refused to attest (`FORENSIC_378_REFUSED`), but the test incorrectly expected an unconditional PASS. The test harness now explicitly marks **only those two positive native-PDFKit demonstrations SKIPPED/NOT_RUN on non-macOS or when `/usr/bin/swift` is absent**. All rejection/adversarial/fail-closed tests continue to run on Linux, and the production gate itself still requires real pypdf **and** native PDFKit; there is no substitute renderer or invented attestation. On the actual Mac Studio those two positive fixtures continue to run and prove real PDFKit independently. This is test portability, not a downgrade of security or a release approval. Original AC remain OPEN and release NO_GO.

## 2026-10-13 worker-17 — unindexed bytes / ignored compressed tails, independent RED → GREEN

**Scope:** Existing standalone `scripts/forensic-redaction-378.ts`, new `tests/forensic-redaction-378-20261013-unindexed-comment.test.ts`, original #378 ticket. Shared branch `fix/wave4-336-370-406-415-integration-20261013`; prime solely owns Git integration. Real PDF bytes produced with existing `PdfBuilder`; existing source witness fixture #237; native macOS PDFKit via `/usr/bin/swift` and independent strict `pypdf 6.16.1` available. No product #237/#406 edits, provider, installation, source witness exposure, release or Gold claims.

**New actual P2 false acceptance (three real-byte variants):** Previous gate established that every xref-indexed object was reachable, but both parsers reopened a PDF with a new **unindexed percent-comment carrying private plaintext immediately before `xref`**, with `startxref` fixed; the gate wrongly returned `INDEPENDENT_SAMPLE_PASS_NOT_RELEASE`. Also reproduced acceptance of (a) private percent-comment inserted **inside the reachable `/Catalog` dictionary** before `endobj`, and (b) private plaintext appended **after a valid zlib end marker inside `/FlateDecode` image-stream bytes**. In each case the source witnesses were absent and masked pixels remained black, while arbitrary recoverable private bytes persisted physically in the output. Actual focused Vitest expectations failed before each respective correction (`expected [Function] to throw an error`): independently demonstrated RED, not a hypothetical validator attack.

**Minimal fail-closed fix:** Inspector now binds parsed xref to actual physical object offsets, requires contiguous canonical object envelopes with no unindexed comments/padding and a canonical classic-xref/trailer footer, and rejects extra bytes inside stream wrappers/dictionaries; it also uses bounded independent zlib decompression to require exact RGB size, zlib EOF and **zero unused/trailing/unconsumed encoded data**, cross-checking pypdf's decoded pixels. Unsupported PDF envelopes refuse. A legitimate raster-only baseline must continue to pass both actual independent parsers, and malicious variants must refuse with `FORENSIC_378_REFUSED`.

**GREEN / limits:** `npx vitest run tests/forensic-redaction-378-20261013-unindexed-comment.test.ts tests/forensic-redaction-378.test.ts tests/pdf-redaction-237.test.ts tests/pdf-redaction-attack-406.test.ts --testTimeout=35000`: **30/30 PASS** on native macOS; baseline pypdf+PDFKit PASS and all three fresh adversarial variants REFUSED. Poppler remains **NOT_RUN** (not installed), current browser #237 output, diverse hybrid/signed PDF corpus, physical devices, security reviewer and external release gates **NOT_RUN**. Original AC-378.1–3 all remain globally OPEN; **NO_GO** for release/Gold.
