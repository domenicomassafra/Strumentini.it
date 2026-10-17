MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 378 — True redaction security independent gate

**What to build:** Rimozione irreversibile verificata su sottinsieme esplicito

**Traces to:** OWN-04 OWN-05; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** completed (bounded independent #378 forensic subset only; NOT Gold/release)

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** cross-cutting

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [x] AC-378.1: Rimozione irreversibile verificata su sottinsieme esplicito.
- [x] AC-378.2: Firmato/hybrid/metadata/orfani rifiutati se incerti.
- [x] AC-378.3: On the scoped input and failure cases, verify: Independent PDFKit/Poppler forensic. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

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

## 2026-10-13 worker-19 — reachable page-tree privacy and bounded Flate follow-up (NO_GO)

**New independent P2 evidence against Draft PR #28 source SHA
`e60f18a90510b6938351d8da8f5726ff62eaa034`:** A valid 743-byte image-only
PDF produced in memory by the existing `PdfBuilder` contained a reachable
`/Pages` dictionary with the additional key
`/Private (PRIVATE_UNCHECKED_PAGES_DICTIONARY_378_747474)`. Its RGB mask
pixels were black, xref was complete, and pypdf strict and native macOS PDFKit
both reopened it. The independent gate **incorrectly returned**
`INDEPENDENT_SAMPLE_PASS_NOT_RELEASE` with 1 page and 200 black pixels,
despite the physically recoverable plaintext. The prior output checks
restricted `/Catalog`, each `/Page` and its image resource but omitted
the reachable parent/intermediate `/Pages` dictionaries.

**Separately proven resource P2:** The embedded pypdf inspector called
`zlib.decompressobj().decompress(image._data, 3*w*h+1)`, then **unbounded**
`decompressor.flush()`. A real 20×20 RGB raster PDF declaring 1,200 decoded
bytes but carrying an approximately 366 KiB Flate stream with **80 MiB**
decoded content was rejected only after large transient inflation. In a
disposable Python child monitored with OS `ru_maxrss`, the pre-fix test
observed **211,009,536 B peak RSS**, exceeding a 90 MiB inspection budget.
macOS cannot enforce that `RLIMIT_AS` change on this host, so the regression
measures actual child peak RSS on macOS and uses an enforced process
`RLIMIT_AS` on Linux. No service, production artifact or original PDF was
modified during these hostile probes.

**Correction limited to `scripts/forensic-redaction-378.ts`:** The
independent Python inspector now walks the complete bounded `/Pages` tree,
permits only `/Type`, `/Kids`, `/Count` and the verified `/Parent` link
on nested tree nodes, verifies direct `/Page` parent links and child counts,
and refuses extra fields, cycles or malformed descendants. A Flate image is
decompressed with a strict maximum of expected RGB bytes plus one and must
reach actual zlib EOF with no unused or unconsumed input. It **never invokes
unbounded `flush()`**. The previous independent pypdf/PDFKit checks,
physical envelope scan, stripped source witnesses and NO_GO policy remain.

**Independent RED→GREEN verification:** New
`tests/forensic-redaction-378-20261013-pages-stream-bound.test.ts` uses
real `PdfBuilder` output and executes the exact embedded pypdf inspector
in a disposable child; on macOS it also tests the genuine PDFKit path.
Both new cases failed before the correction (**2/2 RED**: private `/Pages`
was accepted; the 80 MiB Flate fixture exceeded memory budget). Following
the patch, new **2/2 GREEN** and the 30 previously passing
`#378/#237/#406` tests remain green: **32/32 PASS** from the five focused
Vitest files. The original legitimate raster PDF still earns only the
limited `INDEPENDENT_SAMPLE_PASS_NOT_RELEASE` receipt on native macOS.
Strict targeted `tsc --ignoreConfig --noEmit --strict
--noUncheckedIndexedAccess` with ESNext bundler/Node types **PASS**.
The private source witness is never included in a success receipt.

**Gate:** Scope is the standalone independent offline audit, not full PDF
redaction certification. Original **AC-378.1–3 remain OPEN**, and
live browser `#237` download, Poppler, physical iOS/Android, independent
full-forensics and production release remain **NOT_RUN / NO_GO**.

## 2026-10-13 recovery — bounded Contents-stream follow-up (in progress)

Ownership: `scripts/forensic-redaction-378.ts`, one new focused test and this original ticket; existing #328/#369 WIP is read-only. Current integration HEAD `53e3df5bf880dae46f02061aced6a99772d05a55` has the exact same inspector bytes as PR #28 `2ae3d1d3c0187e27b464be76bfc9be30c2a0fe08` (SHA256 `75d048e7cb162cae082d1367f478ce38ad38fa20c6903d920dc93cee2ec438ef`). Investigate the delivered P2 findings: private `/Contents` dictionary fields and ignored bytes after its Flate EOS. Reuse existing `PdfBuilder`, pypdf/PDFKit inspector and stdlib bounded zlib checks; do not replace the parser or install a donor. Upstream pypdf merged PR #3430 (`bb3a690`, BSD-3-Clause; existing installed pypdf 6.16.1) already limits generic decompression, but its tolerant decoding does not attest this owner's exact physical-byte-erasure requirement. Actual upstream `pypdf/filters.py` and Python zlib `max_length`, `eof`, `unused_data`, `unconsumed_tail` documentation were read before the residual delta. Original AC and release/Gold remain OPEN/NO_GO pending real full acceptance.

**Actual RED→GREEN:** `tests/forensic-redaction-378-20261013-contents-private.test.ts` constructs real raster-only PDFs with the existing `PdfBuilder`. On the exact pre-fix inspector both a reachable `/Contents` dictionary carrying private `/Private` + `/Author` values and a valid Flate draw stream with trailing private plaintext were falsely accepted (2 RED; benign uncompressed/complete-Flate control PASS). The minimal owner fix validates the original indirect stream dictionary and bounded exact drawing bytes before `extract_text()` can parse/decompress them: only optional `/Length` and a single `/FlateDecode` filter are admitted, zlib must reach EOF and consume the full input, and decoded output must equal the canonical image draw commands. No unbounded flush, filter chain, extra field or hidden draw operator is admitted. Existing image bounds, physical xref/envelope, pypdf/PDFKit and fail-closed gates remain intact.

**Fresh focused verification:** six Vitest files (new Contents, Pages/stream-bound, unindexed-comment, original #378, #237 and #406) completed **35/35 PASS, zero skip/failure**, with benign raw and complete-Flate output reopened by real macOS PDFKit and pypdf. Scoped strict TypeScript compile and `git diff --check` PASS. This closes the two reproduced offline-inspector findings only. Original AC-378.1–3 remain OPEN; full independent corpus, actual current UI artifact, Poppler and physical devices/release/Gold remain NOT_RUN/NO_GO. Worker did not stage, commit, push, merge or deploy; integrator must update the same PR #28 and perform its final review/CI gates.

## 2026-10-14 — Scoped original #378 closure: actual UI bytes + genuinely signed refusal + native Poppler

**Independent bounded acceptance, not broad PDF security certification:** The original #378
capability is an *explicit restricted raster-only local subset*, with an independent
output gate and conservative input refusals. This acceptance does **not** promote
#237/#406 global PDF redaction, arbitrary editors, physical mobile or Gold.
Existing `scripts/forensic-redaction-378.ts` had already implemented the owned
independent physical-byte inspector; this closeout adds a cryptographically
authentic signed-document refusal regression, not a new vendor/parser.

- **AC-378.1 VERIFIED, supported subset only:** On actual current canonical
  source `main` HEAD `9906d6a6e4332ad2db79389750fb8f0f1d5b483f` plus
  separately owned uncommitted #406 parser hardening (not silently attributed to
  main), the existing DEV-only browser producer generated two real downloaded
  PDF artifacts. For the one-page hidden selectable text + xref-orphan + source
  document Info sample, original PDF 1,113 bytes SHA256
  `df6f74cd46031329fe58cd17da87b509bdfa7218200f36e0631471d9968181a9`,
  newly exported raster PDF 1,005 bytes SHA256
  `213cd101e31deb9462e459de47180a26d1db850b2011bdfba99d6eb2886af45a`.
  The **real standalone** `node --import tsx scripts/forensic-redaction-378.ts`
  CLI independently consumed those exact source/output bytes and an explicit
  one-page mask with **two positive original source witnesses**. It returned
  `INDEPENDENT_SAMPLE_PASS_NOT_RELEASE`, `pages:1`, `blackPixels:28350`,
  `outputBytes:1005`, `witnessesChecked:2`, `parsers:[pypdf-strict,macOS-PDFKit]`.
  The output has no original source witness in raw bytes or copied text; the
  actual 8,670-byte two-page ordinary UI export likewise retained no text
  objects or original source words. Both exports were independently reopened
  by PDF.js, strict pypdf, pdfminer, native PDFKit/CoreGraphics copy/print/reopen;
  visual coverage and unredacted witnesses were checked.
- **AC-378.2 VERIFIED for uncertain hostile inputs:** Existing actual source
  gate/entrypoint tests `tests/pdf-redaction-malicious-corpus-237.test.ts`,
  `tests/pdf-redaction-attack-406.test.ts` and the hybrid/ObjStm #406 tests
  prove refusal **before** production of an artifact for independently readable
  genuine `/Prev` multi-revision and `/XRefStm` hybrid formats, signed-looking
  `/ByteRange`/`DocMDP` structures, unsupported metadata/object graphs and
  compressed ObjStm attack cases. The #378 inspector's own tests deliberately
  forge recoverable xref orphans, `Info`, `Pages`, `Contents`, unindexed bytes,
  trailing Flate payload and invalid pixels and prove `FORENSIC_378_REFUSED`.
  Additional new `tests/forensic-redaction-378-20261014-authentic-signed.test.ts`
  **independently generates a true cryptographic detached CMS signature** with
  ephemeral OpenSSL RSA/X.509 identity, verifies the actual PDF `/ByteRange` via
  strict pypdf and CMS verification (`openssl cms -verify`, exit 0), verifies
  a tampered signed segment fails CMS verification, then checks both the public
  source gate and actual `redactPdfRaster237(File, regions)` **refuse** the
  genuinely signed PDF before rasterizing. Synthetic key, certificate, signed
  bytes and CMS are removed in the test `finally`; no private source uploaded.
- **AC-378.3 VERIFIED, genuine native reader differential on the above bounded
  source/output:** macOS PDFKit independently reopened and printed the actual
  download; MiniPC native Linux Poppler **26.01.0** (`/usr/bin/pdfinfo`,
  `/usr/bin/pdftotext`, `/usr/bin/pdftoppm`) independently received the exact
  source and output by `ssh minipc` **stdin**, no remote files or install. All
  calls exited 0. Original source `pdftotext` extracts **43 characters** despite
  a visually black overlay and its raw bytes contain both source-only markers;
  exported PDF extraction is **zero characters**, with **zero source markers**
  in raw bytes. Native `pdftoppm -png` output independently decoded via Pillow
  at **500×389 pixels**: covered center-top RGB `(0,0,0)` and outside-bottom
  RGB `(0,0,255)` before and after. PDFium 153.0.7999.0 also independently
  reopened/rendered the same exported bytes and extracted zero characters.
  The second two-page output also reopens cleanly via Poppler and PDFKit, has
  zero extractable text and top black mask with unredacted pixels retained.

**Test and delivery gates:** Fresh bounded Mac canonical focused #378/#237/#406
regression **57/57 PASS** (six original #378/#237/#406 suites 35/35 plus
three hostile fixture suites 22/22); independent isolated `main` clone
`/Users/domenico/Code/Strumentini-378-closure-20261014-worker1` with the new
real signed negative fixture: **eight Vitest suites, 51/51 PASS**, strict scoped
TypeScript including `--noUncheckedIndexedAccess` PASS, no production source
change. This closes **only the three explicitly bounded original #378 AC**,
not original #406, whole-corpus/redaction Gold, a live deployment or any
unsupported PDF subtype. Authentic third-party certified signatures, arbitrary
metadata variants, mobile iOS/Android, physical memory and release rollback
remain **NOT_RUN / NO_GO for broader publication**. No receipt/Gold source
fingerprint is rebased; this ticket's acceptance never authorizes production.
Windows requirements remain `PENDING-ON-BOOT`; no Windows operation was made.
