# 265 — File-size analyzer PDF adapter

**What to build:** Extend the size analyzer with PDF page/image/stream/metadata contribution evidence and scan-heavy vs text/vector-heavy classification where detectable.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 218, 228.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd

- [ ] Classification is evidence-based and can return unknown.
- [ ] Largest contributors link to exact measured structures/images.
- [ ] Recommendations point to compatible PDF optimizer/compressor actions.

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
