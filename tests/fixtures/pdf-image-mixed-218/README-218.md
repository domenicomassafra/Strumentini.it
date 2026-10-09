# Ticket #218 — independently reopened mixed-image XObject corpus

Rebuild actual binary PDFs reproducibly:

```sh
./node_modules/.bin/tsx scripts/generate-pdf-mixed-masks-218.ts
./node_modules/.bin/vitest run tests/pdf-mixed-image-masks-218.test.ts
./node_modules/.bin/tsx tests/pdf-mixed-image-masks-218.browser.ts
```

Seven **real PDF pages** with a searchable vector/text layer, an embedded
high-quality `/DCTDecode` JPEG on one side, and a `/FlateDecode` RGB layer
encoded with a genuine PNG Sub scanline predictor (`/DecodeParms /Predictor 15`)
on the other. Important: the PDF stores Flate image XObjects, **not .png files**;
this is PNG-style lossless filtering rather than a claim that PDF can embed
PNG container bytes as an unchanged file.

| Fixture | Scenario | Engine policy proven |
| --- | --- | --- |
| `safe-mixed-218.pdf` | Two directly painted unmasked color images and vector text | JPEG or Flate selected individually for opt-in lossy conversion; preserve other layer and text |
| `smask-mixed-218.pdf` | Additional `/SMask` DeviceGray image and an image referencing it | Whole document unchanged for both profiles |
| `multiply-mixed-218.pdf` | Actual `/ExtGState` with `/BM /Multiply` | Whole document unchanged for both profiles |
| `form-mixed-218.pdf` | Nested Form XObject painting a vector fill | Whole document unchanged for both profiles |
| `indexed-mixed-218.pdf` | Genuine `/Indexed /DeviceRGB` color-space image alongside the two supported layers | Preserve indexed stream bytes/ColorSpace while recompressing another eligible image |
| `uniform-mixed-218.pdf` | Tiny already-compact JPEG + compressible constant Flate raster | Both modes honestly keep original because JPEG would not save meaningful bytes |
| `bomb-mixed-218.pdf` | Valid xref but unrendered referenced Image XObject advertises 100000×100000 pixels | Skip the giant image; never render/decode it. Other eligible images may still be processed; **NOT whole-document refusal** |

Target run on 2026-10-09: `tests/pdf-mixed-image-masks-218.browser.ts`
in isolated Vite/Chromium 390×844 passed **178 checks** (11 rendered comparison
cases plus non-rendered giant image checks and mid-flight AbortController).
Independent pypdf + pdfminer.six prove page geometry, unchanged page `/Contents`,
searchable vector text, XObject identity, unchanged untouched layer bytes and
actual DCTDecode image codec; Pillow opens all selected JPEGs and independently
checks grayscale. Separate Node PDF.js canvas raster output is reopened for
source and transformed PDFs, and the full rendered RGB mean absolute delta is
measured; no JPEG **pixel-exact** equivalence is claimed.

Observed source/output byte counts for the same seeded 598,519 B source:

- Scan Flate→JPEG: **598,519 → 309,896 B**; mean rendered RGB delta 5.32;
  image dimensions 360×280→256×199.
- Explicit grayscale scan: **598,519 → 308,896 B**; delta 5.44, Pillow
  validates approximate RGB channel equality in the converted JPEG.
- JPEG-only reencode: **598,519 → 340,960 B**; delta 4.41; untouched
  Flate-with-predictor byte stream exactly preserved.
- `/SMask` **894,447→894,447 B**, `/Multiply` **598,641→598,641 B**,
  and nested Form **598,735→598,735 B** with zero modifications.
- Uniform **3,442→3,442 B** for both profiles, zero touched and
  `recommendOriginal=true`.

Other checks: Chromium source/output files were saved to a temporary directory
for independent pypdf/pdfminer validation; output PDF.js was opened again in
Node, not trusted from the writer's in-memory report. The giant declared image
was **never rendered**, only classified/skipped and independently confirmed
unchanged in output. Pre-abort and in-flight abort are covered; source >25 MiB
and invalid quality/edge bounds reject before image allocation. Chromium local
requests only; zero offsite traffic. All temporary output files are removed.

**Not certified:** PyMuPDF/Poppler were not installed; only one rendering engine
(PDF.js) with two separate runs was used, plus distinct pypdf/pdfminer/Pillow
structure/codec checks. No physical mobile device, Safari/Firefox current-build,
cross-renderer visual parity, real placement-based DPI, arbitrary PDF, memory
profiler measurement, security/redaction/sanitization guarantees or public
release/Gold gate is implied. Work is source-only for PRIME review.
