# 394 — Metadata stripping with after-export forensic inspection

**What to build:** Scrubs supported image/document metadata and reports before-after

**Traces to:** OWN-04 OWN-10; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** base

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-394.1: Scrubs supported image/document metadata and reports before-after.
- [x] AC-394.2: Nested thumbnails/comments/hidden metadata are not claimed removed without proof.
- [ ] AC-394.3: On the scoped input and failure cases, verify: Exif/OOXML/PDF/SVG malicious metadata corpus. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Exif/OOXML/PDF/SVG malicious metadata corpus; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## Implementation evidence — 2026-10-11, partial (owner release blocked)

- **Raster image scope implemented:** `src/engines/image/metadata.ts` and `strip-metadata.ts` now walk complete PNG Blob chunk boundaries, including chunks after large IDAT and bytes after IEND. Unknown private chunks are reported; XMP in PNG iTXt is identified as XMP. The output PNG is delivered only after all chunks and the exact trailer boundary have been checked, zero metadata chunks remain, and reopened browser RGBA matches the source's decoded pixels. The source inventory is explicitly labelled partial when the bounded JPEG/WebP prefix is insufficient.
- **Independent evidence:** `tests/metadata-forensic-394.test.ts` started RED (4 failing assertions on XMP/unknown chunk, trailing payload, missing full-Blob scan) and finished GREEN alongside the pre-existing image metadata suite (23 passing assertions). `node tests/metadata-forensic-394.browser.mjs` PASS in desktop Chromium at a 390×844 viewport: real PNG source with Exif/iTXt XMP/text/private chunks, actual canvas export, reopened bitmap and a separate CRC-checked PNG chunk walker of the returned bytes. Tampering with the browser encoder's otherwise-decodable PNG to insert >8 MiB tEXt and late iTXt XMP now causes a refusal. SVG/PDF/OOXML signatures, cancellation and 41 MiB oversized input were refused. No uploads or network requests were needed. `npm run check` PASS on 2026-10-11 (1999 files, 0 errors, 0 warnings, 22 existing diagnostic hints).
- **Claim limit:** Original Exif nested thumbnails are not individually decoded/inventoried; the original Exif chunk is excluded when the browser re-encodes the primary raster. The proof covers container metadata, not steganography inside pixels or identifying visual content. JPEG/WebP inventories >8 MiB are explicitly partial; browser-decoded visual color/ICC semantics may differ from the source file.
- **NO_GO / NOT_RUN:** PDF, SVG, and OOXML metadata stripping and a malicious document corpus were **not** implemented or certified by this raster engine. These formats are refused; a document sanitizer would require a separate implementation and independent format-specific evidence. Physical mobile device, Safari/Firefox readback and production canary/rollback were not run. Historical CI/prod gate remains blocked; this is source-only work without commit, push, or deploy.
- **Remaining AC:** AC-394.1 applies to supported JPEG/PNG/WebP raster output; the broader document-metadata portion remains open. AC-394.3 remains open for full malicious document corpus, cross-browser/device and rollback proofs.

## 2026-10-11 wave 14 independent JPEG/WebP forensic boundary correction — partial, OPEN

Source HEAD `39e07827`, independent source ownership **only** `src/engines/image/metadata.ts` (not `strip-metadata.ts`, any visual UI, PDF or other ticket). New adversarial test `tests/metadata-trailing-394.test.ts` uses **real Sharp-encoded and independently reopened** JPEG/WebP exports with real pixels, an independent RIFF FourCC/length walker, and explicit byte assertions on concealed Exif/XMP sentinel payloads. **RED (4/4 failed before correction):** JPEG scanner reported `complete:true` as soon as SOS was reached, even if an actual after-export APP1/Exif marker was appended *after EOI* or EOI itself was missing; WebP reported `complete:true` for bytes beyond declared RIFF length, an oversized/truncated RIFF declaration or a partial header. **Second RED (2/2):** real WebP exported with XMP by Sharp contained the standards-defined `XMP ` FourCC (fourth byte is ASCII space) but its inventory had zero privacy carriers; a valid decodable WebP with unknown `PRIV` chunk was also falsely described as metadata-free.

The one-engine correction walks JPEG entropy with 0xFF00 stuffing and RST markers through the **actual terminal EOI** (including multi-SOS boundaries), refuses missing EOI, and marks bytes beyond EOI as unverified privacy-bearing `JPEG trailing payload`. It compares WebP's declared RIFF end with physical bytes, checks full chunk headers including even-byte padding, counts data beyond RIFF as `WebP trailing payload`, recognizes `XMP ` rather than the impossible three-byte `XMP` chunk ID, and treats unknown WebP RIFF chunks as `ancillary` rather than silently omitting potential identifying payloads. Nothing is stripped/re-encoded by this inventory-only modification; this makes misleading forensic success claims fail closed. The real decoder can still render tampered output, which is why byte-level inspection is necessary.

**GREEN:** `npx vitest run tests/metadata-trailing-394.test.ts tests/metadata-forensic-394.test.ts tests/image-media-tools.test.ts tests/image-upgrade-cluster.test.ts` **36/36 PASS** (new 6/6, existing 30/30); `npx tsc --noEmit --pretty false` **exit 0**, `git diff --check` **PASS**. No new dependency, vendor, Gold claim, commit/push/deploy. Scope remains only JPEG/WebP container *inspection* and the already implemented PNG export inspector; this does **not** independently verify JPEG/WebP pixel fidelity, erase pixel steganography, inspect nested thumbnail pixels individually, prove all unknown metadata semantics, or deliver document stripping for PDF/OOXML/SVG. Non-PNG `scanImageMetadataBlob` retains the explicit 8 MiB bounded-prefix limit and returns `complete:false` for larger blobs. Original AC-394.1 and AC-394.3 stay unchecked for broader supported document sanitizers, malicious corpus, physical mobile/cross-browser and release rollback. AC-394.2 remains checked only at its previously documented bounded claim scope; no production approval implied.

**Additional live checks / concurrent blocker:** The existing `node tests/metadata-forensic-394.browser.mjs` also **PASS** in real Chromium 390×844, exercising actual PNG export/decoded pixel readback, independent CRC/chunk-walker, injected metadata refusal, unsupported formats, cancellation and oversized input. A later global TypeScript rerun after new concurrent work arrived was **NOT_PASS**: unrelated unowned new `tests/audit-397.test.ts` imports absent `../scripts/validator/audit-397` (`TS2307`) and reports implicit-any parameters (`TS7031`/`TS7006`). The earlier all-clear on typecheck predates those concurrent #397 files; do **not** claim that the latest repo-wide `tsc` is green. #397 files were untouched. Separate `git diff --check` remains **PASS**.

## 2026-10-12 wave21 — output PNG *compressed-stream* forensic boundary (RED→GREEN, partial)

**New substantive counterexample distinct from the existing chunk inventory:** A PNG
can have only allowed `IHDR/IDAT/IEND` chunks with correct chunk lengths and
**valid CRCs**, yet an IDAT chunk can contain bytes that are **not part of the
zlib image stream** after its terminal Adler32. The installed **Sharp decoder
and real Chromium ImageBitmap both decode the exact original picture**,
silently ignoring those bytes. The previous `stripImageMetadataLocal` gate
walked full PNG chunk boundaries and independently checked output RGBA, but
still returned `metadataFree: true` when the browser encoder callback was
synthetically modified to return such a tainted PNG. The inserted identifying
payload was `PRIVATE_EXIF_IPTC_XMP_GPS_NESTED_THUMBNAIL_394_WAVE21`:
independent Node `inflateSync(..., { info: true }).engine.bytesWritten`
demonstrated that **fewer compressed bytes were consumed than exist in IDAT**.
This demonstrates a **real byte-level output-verification bypass under a
tampered encoder callback**; it does **not** mean ordinary unmodified Chromium
was observed inserting secrets, and the test does not fabricate a production
incident.

**Fix within `src/engines/image/strip-metadata.ts` only:** After its
unchanged complete PNG inventory and before delivering the Blob, the engine
now parses the actual encoded PNG structure and checks *every chunk CRC*
incrementally in 64 KiB reads. It enforces a single IHDR, constrained raster
geometry, contiguous IDAT chunks and terminal IEND, then streams all
concatenated IDAT compressed bytes through browser
`DecompressionStream('deflate')`, measuring the exact independently derived
inflated PNG scanline byte count and Adler32 of those scanlines. Invalid
framing, surplus compressed bytes, bad CRC, incorrect Adler32, missing
stream API, unexpected interlace, malformed geometry, or malformed chunks
cause `OUTPUT_VALIDATION_FAILED` before the result/filename can be returned.
The existing final reopened RGBA exactness proof is retained.

**Bounded resources and cancellation:** Output PNG size is capped by the
already-defined **40 MiB** image limit, inflated scanline bytes by
`height × (1 + ceil(width × channels × depth / 8))` plus the existing
**16 million-pixel / 8192-pixel per side** constraints. The script streams
compressed bytes and counts decompressed chunks, stopping immediately on
excess before buffering all inflated bytes. An AbortSignal is checked between
reads and also cancels an active stream reader. No new dependency, provider,
network request or production feature was added; engine evidence version is
`image-metadata-strip-v3`. Fail-closed older browsers lacking
`DecompressionStream` are **not** claimed supported.

**Independent browser proof:** NEW
`tests/image-strip-forensic-394-wave21.browser.mjs` builds the real source
and runs actual **headless Chromium at 390×844**. A Sharp-encoded JPEG
contains actual Exif Copyright and XMP bytes plus synthetic IPTC APP13/COM
carriers. The real unmodified browser PNG export has no source secrets and
exact source/returned RGBA pixels. The adversarial CRC-valid IDAT
output is opened with Chromium **and** Sharp with intact pixels and a hidden
identifying marker; the original code yielded success (**RED**), the new
checker rejects it with `OUTPUT_VALIDATION_FAILED` (**GREEN**). A benign
PNG where the Adler32 is split across separate IDAT chunks is accepted,
preserving valid multi-IDAT behavior. An independently Sharp-decoded
512×512 incompressible RGB image roundtripped **788,425-byte source →
902,686-byte real browser output** with exact pixels; one observed desktop
Chromium execution took **308 ms**. This is a bounded synthetic desktop
sample, **not** mobile performance/RSS/native-memory or SLA evidence.

**Validation:** New Chromium wave21 script **PASS**; existing real Chromium
`node tests/metadata-forensic-394.browser.mjs` **PASS**; existing
`tests/metadata-trailing-394.test.ts`,
`tests/metadata-forensic-394.test.ts`,
`tests/image-media-tools.test.ts`,
`tests/image-upgrade-cluster.test.ts` **36/36 PASS**; focused TypeScript
`tsc --ignoreConfig --noEmit --target es2023` **PASS**. No edits to the
existing metadata scanner, visual/UI engine or any #363/#367 WIP; no
commit/push/deploy/Gold/receipt changes.

**Remaining original AC:** AC-394.2 remains narrowly checked for supported
PNG raster verification without certifying Exif nested thumbnail parsing,
pixel steganography or identity in picture content. AC-394.1 still OPEN for
image/**document** scope; AC-394.3 still OPEN for forensic PDF/OOXML/SVG
source/output proofs, cross-browser and physical iOS/Android
memory/cancellation/privacy/rollback evidence. `Status: ready-for-agent`
remains unchanged. The malicious callback is a regression boundary probe;
normal browser encoders were observed clean in this sample.

## 2026-10-13 worker-2 — JPEG APP metadata inventory omission (RED → GREEN, partial; OPEN)

**Independent counterexample:** A real 2×2 JPEG encoded by the installed Sharp
with `.withIccProfile("srgb")` contains an `APP2 ICC_PROFILE` segment. Both Sharp
and installed Pillow read the embedded ICC profile and independently reopen
its pixels, but `scanImageMetadata` previously reported `complete: true`,
`segments: []` and the false summary "Nessun segmento di metadati trovato nel
file." A second genuinely decodable Sharp JPEG, augmented with a valid `APP15`
application segment carrying the test sentinel
`PRIVATE_GPS_XMP_NESTED_THUMBNAIL_394`, retained identical decoded pixels in
Sharp and reopened in Pillow, but also falsely reported zero privacy segments.
These are omissions of JPEG application segments, separate from wave14's
post-EOI/truncation fix and wave21's PNG compressed stream verifier.

**RED → GREEN:** New `tests/metadata-394-20261013-jpeg-app.test.ts` failed
**2/3** targeted tests before the source correction; the clean JPEG,
bounded-prefix and pre-aborted controls passed. In
`src/engines/image/metadata.ts`, the existing JPEG marker walker now
classifies genuine `APP2 ICC_PROFILE` segments as `icc-profile`, and other
previously ignored APP0..APP15 payloads as unverified `ancillary`, with one
specific exception for a fixed, thumbnail-free 14-byte JFIF APP0 header.
JFIF thumbnail-bearing APP0 and other unknown application segments are not
declared clean. Known APP1 Exif/XMP, APP13 IPTC and COM classifications are
unchanged. The converter still re-encodes supported raster pixels as PNG and
retains its independent output verifier; no document sanitizer or new route
was introduced.

**Verification:** Five focused Vitest suites, including the new real
Sharp/Pillow regression, **39/39 PASS**; `./node_modules/.bin/tsc --noEmit
--pretty false` **PASS**. Both existing true Chromium 390×844 scripts,
`tests/metadata-forensic-394.browser.mjs` and
`tests/image-strip-forensic-394-wave21.browser.mjs`, **PASS** with real
PNG pixel/byte inspection and negative unconsumed-IDAT checks. Over-8-MiB
JPEG/WebP inventories still disclose `complete:false`; pre-aborted inspection
throws AbortError. No source JPEG APP15 browser export or physical device
proof is claimed from this tranche. No commit, push, PR, deploy or Gold
changes by this worker.

**Remaining original acceptance:** AC-394.1 and AC-394.3 stay **OPEN** for
document PDF/OOXML/SVG malicious corpus, cross-browser and physical mobile,
security/release/rollback proofs. Nested Exif thumbnails are not individually
forensically decoded, and identifying pixels/steganography remain outside
the proven raster metadata-removal boundary.

## 2026-10-13 worker-2 follow-up to independent review — JFIF, ICC privacy, JPEG marker budget (RED → GREEN, OPEN)

**Reviewer counterexamples confirmed with genuine decoded pixels:** On the
existing branch, a 2×2 JPEG encoded by Sharp remains decodable with unchanged
RGBA in both Sharp and Pillow after inserting a valid 14-byte JFIF APP0
header whose four density bytes spell ASCII `GPS!` (the values are otherwise
valid unsigned 16-bit density fields). The prior general thumbnail-free JFIF
exception returned `complete:true`, `segments:[]`, `privacySegmentCount:0`
and falsely declared that no metadata were found. An independent valid JPEG
with native Sharp sRGB ICC APP2 was given a standard ICC `cprt` copyright
`mluc` tag containing `PRIVATE_GPS_XMP_NESTED_THUMBNAIL_394_REVIEW`, by
updating the tag directory and declared ICC profile size. Sharp and Pillow
both reopened the resulting JPEG, recovered its ICC bytes and preserved
original pixels. The inventory did report the ICC segment but incorrectly
reported `privacySegmentCount:0` because `icc-profile` was not considered
privacy-bearing. Both targeted new regression tests were RED before the fix.

**Corrected classification:** The JPEG scanner now ignores only a byte-exact
known-neutral JFIF 1.01 APP0 constant (`units=0`, density 1:1, no thumbnail).
Unlike the previous blanket exclusion, all variable JFIF APP0 fields are
inventoried as unverified `ancillary`, including the GPS test case. ICC
profiles remain classified as **color** in grouped metadata and are also
counted as **potential privacy carriers** across JPEG/PNG/WebP: copyright and
description fields can hold names and other identifying data. This conservative
carrier-level count does not assert every ICC profile contains a secret or
that ICC internals have been forensically decoded. The historical fixture's
exact neutral JFIF and previously asserted carrier ordering are preserved.

**Additional reviewer P1 resource finding:** A genuinely Sharp/Pillow-decodable
2×2 JPEG with 1,000 valid zero-payload APP15 segments previously yielded
`complete:true` and allocated one inventory object per segment. Larger
adversarial files could use the existing 8 MiB JPEG inventory prefix to
force millions of synchronous allocations before cancellation. A 512-marker
budget now bounds scanning/segment allocations; exceeding it returns
`complete:false`, retains earlier segment findings, and explicitly says
`Inventario parziale` in the Italian inventory description. JPEG entropy
byte stuffing and restart markers are not charged against this budget.
The new test also verifies a normally completed 16-marker JPEG, a 32,768-marker
(128 KiB) synthetic stress case with bounded inventory, and AbortError on
pre-aborted blob inspection. This is a bounded source-level budget, not a
mobile RSS/performance certification.

**Regression proof and limits:** New
`tests/metadata-394-20261013-jpeg-privacy-review.test.ts` demonstrated
**2/2 RED** on the two reviewer privacy findings, then **1 additional RED**
on the marker limit; all **3/3 GREEN**. Together with the prior JPEG APP
regressions and four existing suites, **42/42 focused Vitest tests PASS**;
`./node_modules/.bin/tsc --noEmit --pretty false` **PASS**. Both scoped real
Chromium forensic scripts, `tests/metadata-forensic-394.browser.mjs` and
`tests/image-strip-forensic-394-wave21.browser.mjs`, **PASS**; they revalidate
the existing PNG pixel/CRC/IDAT and cancel/size refusal gates, and are not
presented as live browser proof of every new JPEG counterexample. No changes
to sanitizer output, PDF/OOXML/SVG, public routes, generated indexes or Gold.
Original AC-394.1/394.3 and physical/mobile, release, rollback gates remain
**OPEN**; no worker commit/push/PR/deploy.
