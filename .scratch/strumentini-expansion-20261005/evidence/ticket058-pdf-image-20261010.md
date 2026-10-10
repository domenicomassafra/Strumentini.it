# #058 — directional PDF↔image acceptance audit (2026-10-10)

## Scope and verdict

**Original #58 AC 1/2/3 were already checked and can be reproduced in the accepted desktop subset. Original whole-family status remains `blocked`.** The #58 product statement specifically includes HEIC→PDF. #268's authoritative format feasibility contract still refuses HEIC **production promotion** pending genuine iPhone-origin HEIC and physical device evidence. The existing public route **does advertise HEIC** and executes a `heic-to/csp`/WASM decode on a synthetic desktop HEIC. A successful sample runtime decode is not approval and a UI option is not a safe refusal. Do not mark #58 DONE on this evidence.

## Verifications executed without changing source, image WIP or shared receipts

| Scope | Command/evidence | Observed result |
| --- | --- | --- |
| Current-source mixed HEIC/PNG PDF composition and PDF raster matrix | Read-only in-memory adaptation of `scripts/acceptance-conversion-matrix.mjs`: same assertions, output redirected to process stdout rather than writing existing `quality/receipts/pdf/conversion-matrix-browser.json` or shared evidence | **PASS** live Chromium headless 390×844; local no task-time offsite/non-GET requests |
| Strict real PDF raster/ZIP and catalog regressions | `./node_modules/.bin/vitest run tests/pdf-page-images-236.test.ts tests/pdf-render-options-236.test.ts tests/pdf-rotated-bounds-236.test.ts tests/pdf-catalog.test.ts --maxWorkers=1 --fileParallelism=false` | **29/29 PASS**, 4 suites. Independently decoded genuine page images, ZIP byte identity, page selection and refusal. 8 chosen pages from actual 200-page PDF emitted 9,116-byte ZIP |
| Public compiled PDF→images output and independent ZIP bytes | `./node_modules/.bin/tsx scripts/acceptance-pdf-export-compression.ts` against pre-existing `dist/` static build (file mtime `2026-10-10 12:05:23`) | **69/69 PASS**, Chromium/Firefox/WebKit at 390px. Three selected pages in `3,1-2` order produce downloaded PNGs and ZIP entries named `page-003.png,page-001.png,page-002.png` with exact byte equality; actual PNG/JPEG/WebP where encoder supports; WebKit unsupported WebP refused, no counterfeit PNG-as-WebP; invalid ranges clear stale download, local requests only |

### Measured live conversion matrix details

- Real `quality/fixtures/image-format-matrix/source.heic` is **811 bytes**, brand `ftypheic` and HEVC Main/Still Picture container, generated synthetically via macOS `sips` (per #268), **not** a captured iPhone photo. The browser's `libheif-wasm` path successfully decodes it to **2×2** JPEG, PNG and WebP samples with actual signatures. This establishes implementation availability on this desktop fixture **only**.
- `images-to-pdf` converts selected `source.png` + `source.heic`, processes **order `[2,1]`** and per-output image rotations **90° and 180°**, emits a `%PDF-` two-page **A4 landscape** PDF with both pages **841.89×595.28 points**, **12 mm** margins, `contain`. Embedded source conversions are labelled `jpeg-reencode`, HEIC decoded via `libheif-wasm` and PNG via browser. Contact-sheet variant reports one page, two columns, two sources.
- `pdf-to-images` of `quality/fixtures/pdf-gold/simple-2page.pdf` yields selected pages **`[2,1]`**, two real **612×792 PNGs** called `page-002.png` and `page-001.png`, **72 DPI** at 1×, renderer `pdfjs-local-lazy`, failure count **0**, a second ZIP artifact with exactly two entries. The separate three-engine acceptance independently downloads and reopens an actual ZIP with byte-exact parity; this matrix only measures presence and entry count (do not attribute the external ZIP byte oracle to it).
- Neither these tests nor desktop WebKit are physical iOS Safari or Android Chrome. Zero new or revised production acceptance, no source rewrites, dependencies or release execution.

## Deterministic blockers and resolution boundary

1. #268 **completed as refusal** for HEIC promotion: requires genuine iPhone HEIC (orientation/metadata behavior) and physical codec/memory receipts. #212 reports `productionApproved:false` via `probeHeicDecode212()` and remains open. Its isolated gate is not the same runtime used by existing `images-to-pdf`; a synthetic HEIC success must not override it.
2. Public HEIC claims are presently broader than #268 authorized: `ImagesToPdfTool.tsx` advertises HEIC/HEIF file types; `images-to-pdf/manifest.ts` promises `heic to pdf`; `portable-decode.ts` selects `libheif-wasm` and loads `heic-to/csp` on demand. There is no production approval gate on that route. This is a precise cross-ticket scope/policy conflict, not a missing JSX feature.
3. Physical web acceptance #280 Android and #281 iOS remains **NOT_RUN**. Those release gates should stay separate, and no earlier browser viewport test should be substituted.

**Decision:** keep canonical #058 `blocked` notwithstanding 3 already-[x] directional UI ACs. Prime may close it only after resolving the HEIC product obligation against #268, with approved genuine-device evidence or an explicit product-scoped, user-truthful refusal that meets the original family obligation. Do not add tickets or silently promote the WASM decoder; source files (including three dirty `image-visual` files), #33/#57/#241 and shared receipts are untouched.
