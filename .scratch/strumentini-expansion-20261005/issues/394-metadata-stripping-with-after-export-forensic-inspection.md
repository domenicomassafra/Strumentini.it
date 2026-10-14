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

## 2026-10-13 — independent JPEG APPn container blind spot (worker-16; source-only, OPEN)

**Genuine new P2 reproduction:** The existing JPEG metadata scanner inventoried only APP1, APP13 and COM markers, although other standards-defined APP0..APP15 application segments may carry private data or embedded thumbnails. A real 12×12 Sharp-exported, terminal-EOI JPEG with a legal APP5 segment containing `PRIVATE_394_GPS_CONTACT_AFTER_EXPORT` was successfully reopened with both installed Sharp 0.35.5 and independent Pillow 12.2.0 (432 decoded RGB bytes), but `scanImageMetadata` falsely returned `complete:true`, `segments:[]` and `privacySegmentCount:0`. A real Sharp `.withIccProfile("srgb")` JPEG contained a legitimate `ICC_PROFILE\0` APP2 chunk, verified by Sharp `.metadata().icc`, which was also completely invisible to the scanner. A spec-shaped APP0 JFIF 1×1 thumbnail with three concealed pixel bytes was independently reopened by Sharp yet was ignored. This is distinct from prior JPEG trailing/EOI entropy and WebP/PNG boundary findings.

**RED → minimal GREEN:** New focused `tests/metadata-394-20261013-jpeg-app-private.test.ts` reproduced **3/3 RED** before editing production source, and **3/3 GREEN** afterward. `src/engines/image/metadata.ts` now inventories previously ignored APP0..APP15 markers as privacy-bearing `ancillary`, except the precisely bounded 14-byte standard `JFIF\0` APP0 header with zero thumbnail dimensions. It classifies a true `ICC_PROFILE\0` APP2 as `icc-profile` (color-profile bytes are counted in the metadata inventory); opaque/mislabelled APP2 remains `ancillary`. The independently decoded image pixels are unchanged. No work was performed in `strip-metadata.ts`, user-facing UI, donor models or production export behavior.

**Validation and limits:** Five focused suites, including original JPEG entropy/trailing, PNG forensic, image-media-tools and image-upgrade tests, **39/39 PASS**; scoped TypeScript `tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --types node` **PASS**; native Pillow forensic reopen **PASS**; owned `git diff --check` **PASS**. The original full-document sanitizer/corpus/physical mobile/rollback acceptance remains **OPEN** (AC-394.1 and AC-394.3). AC-394.2 remains its existing narrow verified-no-false-removal-claim status. This is an inventory correction only, with no Gold, provider/network calls, installation, stage/commit/push, branch change or release approval; prime handles integration.

## 2026-10-13 — independent standards review of PR #14 JPEG privacy claims (RED→GREEN, still OPEN)

**Target inspected:** Draft PR #14 remote head
`13d75ee9938308d8c052ca1f6c7d6c8b3575a2c2`, relative to
`origin/main` `402774b32a3d8cb6d2f2cbe836734ea1c655a4fa`.
The exact source blob was
`824a16e0748efb8a91d75472f08690fcadae5dab` before this worker fix.
The PR already contained a pending JPEG privacy-review test that exposed
three substantive contradictions in source behavior. A separate new test
`tests/metadata-394-20261013-icc-marker-budget.test.ts` independently
reproduced **3/3 RED** against the exact source: (1) a legitimate 14-byte
JFIF APP0 header with variable density bytes spelling `GPS!` was treated as
privacy-free; (2) a genuine Sharp sRGB ICC APP2 with a valid `cprt`/`mluc`
copyright tag containing private UTF-16BE text was classified only as color,
with `privacySegmentCount:0`; (3) 1,000 valid zero-payload APP15 markers were
inventoried without any per-marker bound, yet `complete:true`. In all three
cases Sharp and independent Pillow reopened identical original pixels; the
ICC content was also present in both decoded profile representations.

**Minimal source correction:** `src/engines/image/metadata.ts` now recognizes
only the fully fixed 1:1/no-thumbnail, version-1.1/1.2 JFIF APP0 header as
the known neutral exception. Variable density and ambiguous JFIF carriers
are conservatively inventoried as `ancillary`. Because an otherwise valid
ICC profile can carry author/copyright data, `icc-profile` now contributes
to the privacy carrier count for source inventories of JPEG, PNG and WebP;
the presentation grouping retains `class:color`. No unverified ICC profile
or vendor signature is silently whitelisted as privacy-free. JPEG marker
processing stops at 512 markers with `complete:false`, preserves already
found segments and explicitly describes the resulting inventory as partial.
No pixels, output encoders, provider software, dependencies or image sanitizers
were changed.

**GREEN:** the new independent three regression tests and prior five JPEG/
PNG/WebP/image suites combined **42/42 PASS**. Real WebP `XMP ` FourCC remains
recognized and real Sharp decoding continues to match clean pixels. The
input JPEGs were verified with Pillow and Sharp, including their ICC profile
presence. All source-only proof remains bounded: full document forensic
coverage, PDF/SVG/OOXML corpus, physical mobile/cross-browser and rollback
are **OPEN** under original AC-394.1 and AC-394.3; no Gold or release gate is
inferred from the scanner correction.

## 2026-10-13 — JPEG unused DQT private-byte inventory correction (worker-20, partial, OPEN)

**New independent P2 reproduction:** The exact Draft PR #14 source at
`f52a8d85e1a8b8c53045b7c221825c6c16605136` falsely reported
`complete:true`, `privacySegmentCount:0`, `segments:[]` and “Nessun segmento di
metadati trovato nel file” for a genuine 12×12 Sharp-encoded JPEG with one
additional *unused* legal DQT quantization table ID 3 containing the literal
`PRIVATE_GPS_CONTACT_394_DQT` in its 64 nonzero coefficients. Both installed
Sharp and independent Pillow decoded exactly the same picture before and after
insertion. Pillow independently reported quantization tables [0,1,3], while the
JPEG frame components use only [0,1]. An unreferenced coding table is permitted
container data with room for unverified identifying bytes; the test does **not**
assert ordinary referenced DQT coefficients are private or that the PNG export
retains them.

**Scoped RED → GREEN:** NEW
`tests/metadata-394-20261013-unused-dqt-private.test.ts` reproduced the missed
private bytes and the same concealment in a mixed used/unused DQT marker
(**2 RED**, with the control for a real remapped JPEG using table ID 3 already
passing). `src/engines/image/metadata.ts` now enumerates only bounded DQT
definitions (8-/16-bit, IDs 0–3) and SOF component quantization references,
then labels a DQT segment containing any unreferenced table `JPEG DQT
unreferenced` as conservative `ancillary` source inventory. A normally
referenced table, including a genuine frame using table ID 3, is neutral. When
DQT or SOF reference structure cannot be verified, it declines a complete
claim; the pre-existing **512 JPEG marker cap** and partial-inventory semantics
remain in force. A mixed DQT segment is counted once, not once per table.

**Evidence:** New three-test suite GREEN, combined previous 42 focused
JPEG/PNG/WebP/image tests **45/45 PASS** across seven suites;
`tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --types node`
against the owned TypeScript files PASS. Source bytes containing the sentinel,
Sharp/Pillow matching decoded pixels, and Pillow's independent table-ID readback
are all asserted. No new dependency, external service, code outside the three
assigned paths, Git action, Gold receipt or release. This changes the **JPEG
source inventory warning only**, not metadata removal or byte-level output
verification. Original AC-394.1 and AC-394.3 stay **OPEN** for document formats,
malicious forensic corpus, physical devices, independent browser evidence and
rollback/release acceptance; AC-394.2 retains its previously documented narrow
scope.

## 2026-10-13 — repeated JPEG DQT table-ID shadowing (worker-17; independent RED → GREEN, partial / OPEN)

**Material P2 before correction:** Draft PR #14 at remote `4694924a6f6520edac2bfcf36785f9b4a0e45438` (same source tree as `3ce455a6dc64102a0a67a0be504441314b9fa557`) reported a Sharp-encoded 12×12 JPEG as `complete:true`, `privacySegmentCount:0`, `segments:[]` despite an inserted first legal DQT definition **table ID 0** containing raw `PRIVATE_GPS_OVERRIDDEN_DQT_394_20261013`, later superseded by the real encoder's DQT ID 0. Real installed Sharp and independent Pillow both decode identical RGB bytes before/after; Pillow reports quantization IDs `[0,1]` for both. A second valid JPEG places two same-ID definitions in one DQT marker and also decodes unchanged. NEW `tests/metadata-394-20261013-redefined-dqt-private.test.ts` proved **2/2 RED** against the prior inventory. This is unverified recoverable coding-table data; it is **not** proof that ordinary referenced DQT coefficients are inherently metadata.

**Minimal fix:** In `src/engines/image/metadata.ts`, the already bounded DQT inventory now retains the latest defining segment per quantization ID. On repeated ID, it conservatively records the **superseded** segment once as `JPEG DQT redefined` (`ancillary`), leaving the final raster definition neutral. This also catches repeated IDs inside one DQT segment and avoids double-counting a mixed used/unused DQT. Existing unused-table recognition, 8-/16-bit parser limits, SOF validation, APP/ICC/JFIF recognition, 512-marker cap and incomplete-inventory semantics are preserved; no new dependency and no JPEG output-stripper changes.

**GREEN:** `npx vitest run tests/metadata-394-20261013-redefined-dqt-private.test.ts tests/metadata-394-20261013-unused-dqt-private.test.ts tests/metadata-394-20261013-icc-marker-budget.test.ts tests/metadata-394-20261013-jpeg-app-private.test.ts tests/metadata-394-20261013-jpeg-app.test.ts tests/metadata-394-20261013-jpeg-privacy-review.test.ts tests/metadata-trailing-394.test.ts tests/metadata-forensic-394.test.ts tests/image-media-tools.test.ts tests/image-upgrade-cluster.test.ts --testTimeout=35000` **47/47 PASS** (45 pre-existing + 2 new; 8 test files). Scoped `npx tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --types node --skipLibCheck src/engines/image/metadata.ts tests/metadata-394-20261013-redefined-dqt-private.test.ts` **PASS**; owned source `git diff --check` **PASS**. A separate concurrent repo-wide `npx tsc --noEmit --pretty false` reports **TS2339** at unowned `tests/forensic-redaction-378-20261013-pages-stream-bound.test.ts:104`; global typecheck therefore cannot be claimed green for this shared worktree. Prime alone owns Git integration and Draft PR updates.

**Limits:** This changes only source JPEG metadata *inventory warnings*. It does not remove DQT data, prove all JPEG private bytes are detected, establish output PNG pixel fidelity or certify PDF/SVG/OOXML sanitization. Original AC-394.1 and AC-394.3 remain **OPEN** (malicious document corpus, physical mobile, browser/platform readback, security review and rollback); AC-394.2 remains checked only at its earlier bounded disclosure scope. No Gold, release or production approval.

## 2026-10-14 — verified output PLTE invisible identity payload, RED→GREEN (source-only)

**Independent P2 reproduction on real current main `2bfde577`:** A real native Chromium PNG encoder exported a clean 2×2 truecolor+alpha PNG (IHDR color type 6). A separate test inserted a standards-compatible optional `PLTE` *suggested palette* immediately after IHDR. Its 36 RGB bytes included the source-only sentinel `PRIVATE_GPS_EXIF_XMP_394_PALETTE` and its PNG CRC was recalculated correctly. Installed Sharp and the genuine Chromium/WebKit `createImageBitmap` decoded exactly the original RGBA pixels, because truecolor PNG pixels do not reference that suggested palette. Replacing the actual `HTMLCanvasElement.toBlob` output in the asynchronous callback with this PNG made the published `stripImageMetadataLocal` engine return `{metadataFree:true,outputInventory:{segments:[]}}` while physically preserving the sentinel. The existing CRC, full IDAT stream and before/after RGBA checks all passed: the PLTE entry was categorized as a harmless pixel chunk despite carrying hidden nonpixel bytes. The independent reviewer reproduced the same flaw without editing source.

**Fail-closed source correction:** Only the *produced output* validator `src/engines/image/strip-metadata.ts` changes (engine version `image-metadata-strip-v4`): whitelist output chunks exclusively IHDR/IDAT/IEND, refusing PLTE outright. Legitimate *input* images with palettes continue through the browser's normal decode/re-encode route; however an encoder that emits an indexed PNG/palette in its output will now be explicitly **refused** instead of issuing an unjustified clean-metadata receipt. For this bounded metadata-erasure tool, no proof yet distinguishes every necessary palette RGB entry from unused covert bytes, so accepting any palette would be unsound. Exact PNG CRC, zlib input consumption, Adler32, scanline bounds, RGBA fidelity and abort handling remain required.

**Reproducible RED→GREEN:** New `tests/image-strip-forensic-394-unused-palette.browser.mjs` initially failed on pristine source because the real stripped result reported success for the injected hidden PLTE. With the source correction it passes in **Chromium and WebKit**, checking genuine decoder pixel identity and independent Sharp equality; WebKit's adversarial consumer receives the same genuinely Chromium-encoded clean source bytes, so this does **not** claim native WebKit output is accepted. Existing metadata/media tests **36/36 PASS** across four suites, and prior browser forensic evidence remains independently rerunnable. No provider, data upload, filesystem extraction, receipt, Gold, deployment or physical mobile assertion.

**Original acceptance stays open:** AC-394.1 and AC-394.3 are not closed: PDF, SVG, OOXML sanitizer and a complete malicious metadata corpus/device/rollback matrix remain unproven. AC-394.2's historically checked bounded disclosure is unaffected.

## 2026-10-14 — second independent P2: ignored PNG bitplanes and DEFLATE alignments; canonical delivery v5

**Further genuine RED after narrow PLTE fix:** Independent hostile encoder output could avoid PLTE completely. First, a 1×54 grayscale depth-1 PNG held the recoverable `PRIVATE_GPS_EXIF_XMP_394_GRAYSCALE_PADDING_BITS` in its seven *unused* padding bits per scanline. Both browser decoders and Sharp saw the same black pixels, PNG CRC and zlib were correct and the then-current metadata stripper still certified it. `tests/image-strip-forensic-394-grayscale-padding.browser.mjs` reproduced the original **RED** in Chromium and went GREEN with the stricter outgoing IHDR RGBA8 profile; WebKit was also verified after the fix.

**More serious RGB8/RGBA8 DEFLATE P2:** Even restricting output to 8-bit RGBA cannot certify an arbitrary compressed representation. An independently generated valid 2×2 RGBA8 PNG with only IHDR, IDAT and IEND placed the 43-byte source-only sentinel `PRIVATE_EXIF_GPS_XMP_394_DEFLATE_PADDING_R8` in five normally ignored alignment bits of each of 69 empty non-final DEFLATE stored blocks before the actual pixel scanlines. Independent native zlib fully consumed the stream and emitted the **correct exact scanline bytes**, while Sharp/Chromium/WebKit pixels, Adler32 and all PNG CRCs agreed. Before the canonicalization patch, the genuine engine returned `metadataFree:true` with the 431-byte secret-bearing PNG. This was not observed in an unmodified browser encoder; the regression exercises an adversarial callback.

**Actual source-bound v5 fix:** After verifying the normal browser export including byte-level framing and before returning any file, `stripImageMetadataLocal` now constructs a *different final PNG* solely from privately held, browser-decoded RGBA pixels: fixed IHDR RGBA8, filter-zero scanlines, local pinned `fflate.Zlib` streamed compression, owned CRC-framed IDAT and terminal IEND. It then independently rechecks the *returned* canonical blob's complete metadata inventory, CRC/IDAT/Adler and reopened RGBA identity. Browser encoder bytes—valid or covertly padded—are never returned. The writer operates in bounded rows, refuses output over the existing 40 MiB budget and checks cancellation, without copying original private PNG chunks, hidden optional palettes or browser DEFLATE padding. This still does not promise to remove steganography from visibly represented source pixel values.

**New RED→GREEN independent evidence:** `tests/image-strip-forensic-394-deflate-padding.browser.mjs` persists the recoverable 5-bit secret fixture, independently inflates and Sharp-decodes, injects the original 431-byte adversarial PNG in the actual asynchronous `canvas.toBlob` callback, and checks the real delivered bytes. Chromium and WebKit now deliver the **same canonical 84-byte** PNG with identical pixels, without returning the forged stream. The independent reviewer separately replayed the same attacker fixture against v5 and observed a canonical 72-byte output for its own 2×2 test; byte size depends on source pixels, not private metadata. Existing Chromium source Exif/IPTC/XMP, genuine 512×512 high-entropy RGBA readback, invalid IDAT rejection and split-Adler control remain operational. The benign split stream is now *accepted but canonicalized*, so its result is not falsely required to retain the original byte splitting.

**Limitations and original AC:** Native unmodified WebKit may produce a PNG with ancillary profile chunks; the current strict browser-output validation rejects such an export rather than promising platform support. No physical iOS/Android resource benchmark, high-volume/OOM acceptance, SVG/PDF/OOXML sanitizer, Gold, rollback or production provider was exercised. AC-394.1 and AC-394.3 remain **OPEN**, while AC-394.2 remains scoped to the documented conservative claims; nothing here authorizes publication.

## 2026-10-14 — Safari/WebKit native encoder false refusal, canonical-only v6

**Genuine availability P2 on merged v5:** In an unmodified native headless WebKit session a normal 2×2 PNG source causes browser `HTMLCanvasElement.toBlob('image/png')` to emit `IHDR, sRGB, eXIf, IDAT, IEND` with otherwise identical pixels; the temporary browser encoder bytes fail v5's output metadata gate before v5 can deliver its separately sanitized PNG. On clean exact `origin/main 42e32e22`, NEW `tests/image-strip-394-webkit-native-canonical.browser.mjs` was **RED in real WebKit**, while Chromium passed. The native browser's metadata need not be included in the deliverable.

**Minimal safety-preserving change:** `stripImageMetadataLocal` v6 no longer calls native `canvas.toBlob` or reads its unusable intermediate output. It obtains browser-decoded RGBA through the existing bounded canvas (no raw bytes copied from source metadata), then directly calls the already-reviewed deterministic `canonicalRgbaPng`, validates the actual returned blob's complete inventory, CRC, Adler32, bounded zlib, dimensions and independently reopened RGBA, then delivers those exact bytes. This is strictly narrower than tolerating native eXIf/sRGB: native PNG encoding and its optional privacy-bearing chunks are never invoked or copied. Input Exif/iTXt/unknown metadata remains inventoried and excluded. The existing source and output size, cancellation and pixel-steganography limitations remain unchanged.

**Authentic RED→GREEN:** New Chromium + WebKit `tests/image-strip-394-webkit-native-canonical.browser.mjs` now **GREEN** on genuine untouched native browser paths: independent Sharp confirms 2×2 RGBA exactness; Chromium native `toBlob` 102B and WebKit native 177B both lead to the same returned **84-byte** canonical PNG containing no native encoder chunks. An independent reviewer repeated a strictly read-only esbuild in-memory prototype in both browsers with `toBlob` patched to throw, and the safe path still returned identical clean PNG without calling the patched encoder. Previously published browser adversarial tests were updated to assert that malicious `toBlob` callbacks are NOT called, the canonical return never copies the forged bytes, and intact output pixel evidence remains real. Earlier v4/v5 RED transcripts and committed test fixtures still document the original vulnerabilities; expectations are not quietly misrepresented as encoder-rejection tests under v6.

**Original scope:** This verifies a desktop WebKit engine, not physical iOS Safari app return/permission/memory behavior. It does not implement SVG/OOXML/PDF metadata stripping or claim universal steganography erasure. AC-394.1 and AC-394.3 remain OPEN; no Gold, provider, deploy, device acceptance or rollback.
