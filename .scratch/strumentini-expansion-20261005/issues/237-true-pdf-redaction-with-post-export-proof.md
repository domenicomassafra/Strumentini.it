# 237 — True PDF redaction with post-export proof

**What to build:** Add page-region redaction only when underlying content can be proven removed/inactivated; covering rectangles alone never count, and unsupported cases must refuse.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → security-audit → code-tdd → qa-browser

- [ ] Post-export text/image/object inspection proves supported redacted content absent.
- [ ] Visual result matches selected regions.
- [ ] Unsupported content model returns refusal/warning, never fake success.

**Verification:** Recoverability adversarial corpus, post-redaction extraction and rendered review.

**2026-10-09 PRIME security review — SOURCE-ONLY, NOT PUBLIC, NOT GOLD:** Preserved the bounded raster-only engine and offline tests from worker commit `aeb73b3`; added pre-render declared-image pixel caps against small compressed memory-bomb input. **16/16** focused tests PASS including deliberately recoverable pixels, hidden orphan object, trailing bytes, oversized declared image geometry and unsupported source refusals. The engine constructs a fresh image-only PDF and checks the decompressed RGB output; unlike opaque rectangles on the source PDF, it does not copy original objects. However, this does **not** close the original security-sensitive acceptance: independent security audit, broader malicious/complex PDF corpus (including rotated/scanned/mixed transparency models), end-user verification and physical mobile cancellation/memory tests are still missing. The public `src/tools/pdf-secure-redaction/manifest.ts`, route and UI from the worker branch are intentionally **not integrated**. Therefore no claim of generally secure redaction, no public download, no new Gold, and **Status remains `ready-for-agent`**. `cand-269` belongs exclusively to #243; reserve `cand-270` if/when a separately audited manifest is admitted. Re-evaluate the parser's coverage of unsupported models and PDF.js rasterization, downstream rendering and no-recoverability with truly independent tools before publication.

**2026-10-09 PRIME hardening (16:47):** Explicitly refuse source documents advertising incremental `/Prev`, hybrid `/XRefStm` cross-references or linearization before PDF.js renders. These layouts can produce ambiguous interpretations across parsers and are outside the reviewed security model. Two independently constructed trailer-mutation refusals added; `tests/pdf-redaction-237.test.ts` **18/18** and adjacent visual-signature tests **7/7 PASS**. These negative tests expand fail-closed coverage, **not** evidence of complete redaction security. Original three AC remain unchecked, source-only status unchanged, and public route intentionally absent.

**2026-10-09 separate malicious-corpus worker tranche (source-only, NO public release):**
Generated ten actual PDF fixtures in `tests/fixtures/pdf-redaction-malicious-237/`
using `scripts/generate-pdf-malicious-237.ts`, documented under its
`README-237.md`. Unlike earlier trailer-string mutations, the incremental case
contains two genuine classic xref sections chained by `/Prev`; the hybrid case
contains a real binary `/Type /XRef` stream referenced by `/XRefStm`.
Independent `pypdf` successfully opens all ten sources. The corpus also includes
extractable private text covered by an opaque rectangle, secret metadata, a
recoverable orphan object, a raw Image XObject, simulated signature dictionary,
Form XObject with transparency `/SMask` + `/ExtGState`, actual page rotations
0/90/180/270, and huge declared image dimensions. Unsupported incremental,
hybrid, form-bearing signature and image-bomb sources fail closed before any
browser rendering; malformed huge image was intentionally never rendered.
The bounded covered/complex/rotated sources were processed with actual local
Chromium 390×844 through unpublished isolated Vite. Five real output PDFs
were independently reopened by `pypdf` (structure and every decoded Flate
RGB pixel), `pdfminer.six` (search text), and Node PDF.js with native canvas
(black region, preserved outside colors and page geometry); raw source markers
and original image payload were absent. **74/74 Chromium/forensic assertions
PASS**, zero offsite requests. Focused Vitest **32 PASS, 1 expected security
failure** among 33 tests including the existing 18 #237 regressions. Desktop
test only; no independent Poppler/PDFium renderer was available.

**CRITICAL NEGATIVE FINDING from that corpus (must patch BEFORE any publishing):**
`orphan-signature-no-acroform-237.pdf` is an independently readable PDF with
real catalog `/Perms /DocMDP`, `/Type /Sig` and `/ByteRange` objects but no
`/AcroForm`. On main baseline `44987a7`, `assertSupportedSource237` returns
`1` instead of `REDACTION_REFUSED`: the guard missed signature-related keys
without an AcroForm. It is a syntactically protected signature-shaped test PDF,
**not a verified real signed certificate**, so the claim is limited to this
policy bypass. It is recorded as `it.fails` (expected security failure) in
`tests/pdf-redaction-malicious-corpus-237.test.ts` and separately communicated
to PRIME; that owner must harden `secure-raster-redaction-237.ts`, then convert
the expected-failure assertion into an ordinary passing regression. The
original three acceptance checkboxes and ticket status remain unchanged:
`ready-for-agent` / OPEN; no release, Gold or public security claim.

**PRIME security fix after independent discovery (2026-10-09 17:26):** The original bypass is now **fixed in the source-only engine**. `assertSupportedSource237` refuses PDF dictionaries containing `/Perms`, `/DocMDP`, `/FieldMDP`, `/ByteRange`, `/SigFlags`, `/FT`, `/DSS`, `/VRI` or signature transform metadata; it also rejects `/Type /Sig` and `/Type /DocTimeStamp` name values. Verified the real 10-fixture source `orphan-signature-no-acroform-237.pdf` returns `REDACTION_REFUSED: Sorgente firmata o certificata non supportata.` on the current main. Converted the single historical `it.fails` case into a normal passing regression. The worker's 32+1 baseline result above remains *historical*, and current green suite/browser evidence must be recorded separately. Real-signed certificate authenticity and broad independent auditing remain outstanding; #237 is **still OPEN**, with NO manifest/public route/Gold/deploy.
