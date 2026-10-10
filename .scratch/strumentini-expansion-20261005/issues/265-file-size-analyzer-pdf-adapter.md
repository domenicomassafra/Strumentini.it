# 265 — File-size analyzer PDF adapter

**2026-10-10 FUNCTIONAL ACCEPTANCE COMPLETED:** The public `file-size-analyzer` now reports exact measured encoded PDF stream payload contribution, independently identifiable object IDs, image object dimensions, page count and structural remainder that reconciles with source file length. Its source evidence distinguishes (1) images covering real pages under strict paint/CTM checks, (2) simple text/vector-only PDFs only when every page has verified uncompressed text content/font resources, no image/XObject/inline raster path and no unsupported graphics state, and (3) `unknown` for mixed or unprovable documents. It recommends the *existing compatible* structural PDF optimizer without inventing savings or inferring arbitrary scan types. New engine class was tested with independently parseable 3-page vector/text PDF and a true JPEG-image source. Focused PDF/#266 suites **14/14 PASS**; source-exact clean checkout `ad6ab0d`: **Astro 1893 files 0 errors, 218 Vitest suites all green, build 291 pages, Wrangler dry-run PASS**, and `tests/pdf-size-265.browser.mjs` real compiled Chromium 390px **`PDF_SIZE_265_CHROMIUM_PASS checks=15 source=image-PDF-and-text-vector-PDF no offsite`**, with both file types selected and displayed as `image-only-page-candidate` or `text-vector-only-candidate`, actual no fabricated savings and no remote upload. Parent #218 now functionally completed. This closes *bounded functional ACs*, not arbitrary PDF accounting, physical-device memory tests, Gold or device ticket #280/#281. Unsupported complexity still returns `unknown`.

**What to build:** Extend the size analyzer with PDF page/image/stream/metadata contribution evidence and scan-heavy vs text/vector-heavy classification where detectable.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 218, 228.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd

- [x] Classification is evidence-based: narrow image and text/vector source candidates or explicit unknown.
- [x] Largest contributors link to actual measured PDF stream object IDs, encoded byte sizes and image geometry, not invented disk or savings estimates.
- [x] Recommendations point to the existing compatible structural PDF optimizer; output makes no unsupported savings guarantee.

**Verification:** Synthetic text/vector/image/scan-heavy PDFs with known composition.

**2026-10-10 PRIME #265 bounded integration (NOT closure of #218 prerequisite):**
`src/engines/pdf/size-adapter-265.ts` now reads an actual bounded PDF with the
existing parser and counts **encoded payload bytes** of each observed stream,
including image and metadata Image XObjects, top 10 exact object IDs, and a
nonnegative file-byte remainder for dictionaries/xrefs and other container
material. It never treats payload byte counts as exact physical sizes of whole
objects and does not invent a future compression saving. A strict, existing
image-placement oracle (`measureSimpleImageDpi218`) permits only the scoped
`image-only-page-candidate` classification when all pages consist of one
measured direct image paint covering at least 75% of the MediaBox. Complex
mixed vector/text/scan structures truthfully return `unknown`; DPI remains
diagnostic and never drives resampling. Source object IDs are not transformed.

The pre-existing public **file-size-analyzer** now imports this adapter lazily
for actual `application/pdf` signature, reports its evidence and recommends
only existing `pdf-compression-lite`, with `estimatedSavingsBytes:null`, and
keeps other OOXML/MP4/WAVE paths unchanged. New tests
`tests/pdf-size-adapter-265.test.ts` reproduced **RED 3/3** before wiring, then
**GREEN 4/4** on real synthetic Image XObject+vector/text PDFs; adjacent
`tests/file-size-adapters-266.test.ts` **8/8 PASS**. A new standalone compiled
browser gate `tests/pdf-size-265.browser.mjs` tests the public local route
with a real checked-in one-page JPEG PDF, raw measured evidence and no POST.
This is not evidence of arbitrary scan/text classification, in-the-wild
performance, physical iOS/Android behavior or a completed #218 dependency.
The canonical **Status stays blocked** until upstream gate #218 and remaining
acceptance are genuinely satisfied, despite this independently useful slice.

**Independent clean-HEAD verification #265:** On detached source HEAD `1c30d45`,
`npm run check` **1851 files, zero errors/warnings, 21 existing hints** and
`npm run build` **289 pages PASS**, 648 JS assets, 7,144-byte route JS.
`node tests/pdf-size-265.browser.mjs` loads the actual compiled public
file-size-analyzer route under Chromium desktop at 390×844 with a genuine
checked-in JPEG-image PDF; sees real `encodedStreamBytes`, Image XObject
bytes, structural remainder, unknown future savings, existing compatible
optimizer, zero offsite/POST and zero JS exceptions:
`PDF_SIZE_265_CHROMIUM_PASS checks=11`. Dev-only #241 and unsafe #237 public
PDF routes are both absent. This is browser desktop evidence only, not mobile
device acceptance. New #265 + existing #266 focused tests **12/12 PASS**.
