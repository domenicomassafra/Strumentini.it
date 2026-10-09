# #237 adversarial PDF corpus — source-only security acceptance

Reproduce byte-for-byte with `./node_modules/.bin/tsx scripts/generate-pdf-malicious-237.ts`.
Ten actual PDF files, not pseudocode or fake trailer strings. Each uses an
actual PDF cross-reference table and final `startxref`; the incremental PDF
contains a **second valid xref section** with `/Prev` and the hybrid case
contains a **binary `/Type /XRef` stream** referenced by `/XRefStm`.
Independent `pypdf.PdfReader(strict=False)` parses all ten files, including
the actual revision chain. These are crafted test PDFs, not real-world signed
documents or independently authenticated certificates.

| PDF | Model | Expected #237 handling at original 44987a7 baseline |
| --- | --- | --- |
| `covered-orphan-237.pdf` | Real extractable sensitive text visually hidden behind black paint; hidden orphan object, sensitive metadata and raw Image XObject | Allow bounded raster; new output must remove all recoverable content |
| `incremental-prev-237.pdf` | Two full xref sections, actual `/Prev` revision chain | Refuse |
| `hybrid-xrefstm-237.pdf` | Actual cross-reference stream and hybrid xref trailer with `/XRefStm` | Refuse |
| `fake-signed-byte-range-237.pdf` | Simulated `/Type /Sig`, `/ByteRange`, `/AcroForm`, `/Perms /DocMDP`, no real certificate | Refuse |
| `orphan-signature-no-acroform-237.pdf` | Simulated `/Type /Sig` + `/ByteRange` + catalog `/Perms /DocMDP`, deliberately missing `/AcroForm` | **Known fail-open as of 44987a7: preflight incorrectly allows**; `it.fails` regression pending PRIME patch |
| `complex-smask-form-237.pdf` | Nested Form XObject, Image XObject, grayscale soft mask and 60% ExtGState alpha | Allow bounded raster; output contains only raster |
| `complex-rotate-90-237.pdf` | Same complex model; actual page `/Rotate 90` | Allow bounded raster; top-left normalized bounds match display |
| `complex-rotate-180-237.pdf` | Same complex model; actual page `/Rotate 180` | Allow bounded raster |
| `complex-rotate-270-237.pdf` | Same complex model; actual page `/Rotate 270` | Allow bounded raster |
| `image-geometry-bomb-237.pdf` | Source with tiny stream declaring 300000×300000 RGB pixels | Refuse before rendering; **never render this fixture** |

Rerun the focused checks:

```sh
./node_modules/.bin/vitest run tests/pdf-redaction-malicious-corpus-237.test.ts tests/pdf-redaction-237.test.ts
./node_modules/.bin/tsx tests/pdf-redaction-malicious-237.browser.ts
```

The browser acceptance runs **only** the bounded supported PDFs. It asks the
actual production engine to render into a fresh image-only output in isolated
Chromium and then independently reopens the output using:

- `pypdf`: object structure, page count, metadata/annotations, sole XObject,
  decoded Flate RGB, every selected black pixel and surviving outside pixels
- `pdfminer.six`: source text is readable below the cover; output has no
  recoverable text or text layer
- Node PDF.js + native canvas: before/after page geometry and actual rendered
  black pixels at the specified region; an untouched colored region survives
- Raw source/output byte comparison: source marker and original image sentinel
  are absent from the exported byte stream

The suites do **not** establish general-purpose secure redaction. They do not
cover arbitrary in-the-wild PDFs, valid certificates, every xref/ObjStm edge,
cross-engine raster parity (Poppler/PDFium unavailable on the host), browser
Safari/Firefox, physical devices, async abort/memory pressure, accessibility,
network release gates or operator security review. The route remains private
and ticket #237 must stay OPEN until these issues are resolved.
