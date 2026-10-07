# Lane 09 — Heavy browser dependency spike

Date: 2026-09-23
Status: implementation-input research; no production integration authorized
Scope: PDF, image, archive, QR, hashing and file-signature capabilities for browser-local Strumentini.it tools

## Executive decision

The heavy stack should **not** be standardized on one universal browser-processing library.

The observed and primary-source evidence supports capability-specific modules:

1. **Early Gold-safe substrate**: native `File`/`Blob`/Streams, `createImageBitmap` + Canvas for bounded raster transforms, `fflate` for bounded ZIP work, `qrcode`/`jsQR` for QR when product scope calls for it, `hash-wasm` or a benchmarked `@noble/hashes` adapter for incremental SHA-256, and `file-type` as a *best-effort file-signature hint*.
2. **Heavy Wave C**: all PDF parsing/rendering/mutation after a hostile corpus and mobile acceptance; AVIF and other WASM codecs; advanced/very-large ZIP; multi-format barcode stacks; libvips/WASM-style batch image processing.
3. **Reject as default production dependency**: `@squoosh/lib` as the long-term package dependency, `SparkMD5` for an integrity/checksum product, `piexifjs` as the production metadata authority, and a “one giant engine for every file job” architecture.

The most important measured result is bundle separation. The three isolated production builds were:

| Spike | Raw build bytes | gzip bytes | Key observation |
|---|---:|---:|---|
| PDF mutation + PDF.js render/extract | 2,122,213 | 677,643 | PDF.js worker alone is 1,265,413 raw / 373,554 gzip. Keep PDF lazy and separate. |
| Image transform + AVIF WASM | 7,312,864 | 2,348,108 | Current `@jsquash/avif` Vite build emitted two ~3.5 MB WASM variants. AVIF cannot be an eager baseline dependency. |
| ZIP + QR + incremental hash + signatures | 252,963 | 87,928 | The mixed file substrate is materially lighter and is compatible with lazy tool chunks. |

These numbers are from the spike builds in this repository, not package-registry estimates. Raw npm unpacked sizes in the dependency census below are recorded only as a packaging/complexity signal and must not be confused with browser transfer size.

## Decision context inherited from Strumentini.it

The product architecture already requires that:

- ordinary deterministic work stays local;
- heavy work is lazy-loaded and moved to a worker where practical;
- WASM never appears in the shell merely because one tool may need it;
- heavy tools expose real phases/progress, cancellation, file-size guidance and graceful mobile fallback;
- input is untrusted even when it never leaves the browser;
- a changed Heavy tool does not reach Gold until worker/WASM cancellation, browser/mobile, correctness and bundle gates pass.

The market work also places image preparation, PDF handoff, metadata inspection/removal, checksums and archive inspection inside the File & Asset Handoff substrate, while explicitly demoting QR reading as a first-wedge product feature and deferring specialist PDF operations such as password removal and flattening.

## Evidence method

Primary-source checks were performed on 2026-09-23 using:

- npm registry package metadata for exact published versions, declared licenses, publish timestamps, unpacked sizes and repository links;
- the packages' official source repositories and READMEs through GitHub CLI where hosted on GitHub;
- GitHub Advisory Database exact-version queries for npm packages;
- browser execution in the installed system Google Chrome through `playwright-core`;
- Vite production builds for deterministic bundle evidence;
- `npm audit` for the installed spike dependency graph.

No third-party documents, customer data, photographs or copyrighted fixtures were used. Every runtime fixture is generated synthetically by the spike code.

Security note: **zero matching GitHub advisories and a green `npm audit` do not prove a parser/codec safe**. These libraries process attacker-controlled binary structures. Corrupt-file corpora, decompression limits, worker termination and output validation remain required before Gold.

## Candidate census and adoption matrix

Legend:

- **GHA 0** = no GitHub Advisory Database entry matched the exact npm package/version in the 2026-09-23 query.
- **Native** = browser platform capability, no npm dependency.
- **Observed** = exercised by this lane in Chrome, not merely inferred from documentation.
- Package “unpacked” size is npm's package payload, not final bundle size.

| Family | Candidate / exact version | License | Maintenance evidence | Browser / worker / size | Memory, cancel, quality and security notes | Strumentini.it coverage / decision |
|---|---|---|---|---|---|---|
| PDF | `pdf-lib` 1.17.1 | MIT | npm 2022-05; repo pushed 2024-07; release v1.17.1 | Official README says Node/browser/Deno/React Native; npm unpacked ~19.5 MB; **Observed** mutation | Whole-document object model can duplicate buffers; no native progress/cancel seam; GHA 0 | Page merge/split/reorder/rotate works. Useful reference adapter, but maintenance age prevents unquestioned authority. **Wave C / fallback candidate**. |
| PDF | `pdfjs-dist` 6.3.289 / Mozilla PDF.js | Apache-2.0 | npm 2026-08; repo pushed 2026-09-22; release v6.3.289 | Official web parser/renderer; separate worker; **Observed** worker build 1.27 MB raw | Rendering creates large RGBA surfaces; task/worker can be destroyed, but Strumentini.it must normalize cancellation; GHA 0 | Best-supported render/text/metadata-reading authority in this census. **Wave C**. |
| PDF | `@cantoo/pdf-lib` 2.11.1 | MIT | npm 2026-09; repo pushed 2026-09-11 | Browser-capable active fork; npm unpacked ~26.3 MB | Adds extraction/attachments/XFA/document-JS surface, therefore broader attack/correctness surface; GHA 0 | Promising maintained mutation/extraction fork. Requires corpus/compatibility/governance spike before adoption. **Wave C candidate**. |
| PDF | `unpdf` 1.8.1 | MIT | npm 2026-08; repo pushed 2026-08-14; release v1.8.1 | Browser/serverless extraction/rendering wrapper around PDF.js; npm unpacked ~2.14 MB | Convenience layer can inline/abstract worker details; GHA 0 | Useful if its interface materially reduces PDF.js integration complexity. Not necessary for the first raw PDF.js adapter. **Wave C alternate**. |
| PDF | `mupdf` 1.28.1 | AGPL-3.0-or-later | npm 2026-09; official package points to Artifex/Ghostscript source | WASM/browser-capable family; npm unpacked ~14.3 MB | Strong engine, but AGPL obligations are a product-policy blocker absent an explicit licensing decision | **Reject from default dependency shortlist** under current permissive-library posture; reconsider only with owner/legal approval. |
| PDF | `pdfmake` 0.3.11 | MIT | npm/repo 2026-06 | Browser PDF generation; npm unpacked ~15.3 MB | Generation-focused, not existing-document mutation/render authority; GHA 0 | Does not solve the target handoff job deeply enough. **Reject for this capability set**. |
| PDF | `pdfkit` 0.20.2 | MIT | npm 2026-09; repo pushed 2026-09-19 | Browser/Node PDF generation; npm unpacked ~10.5 MB | Generation-focused; additional browser packaging surface; GHA 0 | Valuable elsewhere if PDF creation becomes a product job, not for split/reorder/extract. **Reject for this lane's core PDF seam**. |
| Image | Canvas + `createImageBitmap` | Web platform | Living web platform | **Observed** JPEG/WebP decode/crop/re-encode; zero library bytes | Canvas has hard browser/device dimensions and native memory outside JS heap; cancellation at operation boundaries; browser encoders vary | First choice for bounded resize/crop/JPEG/WebP conversion. **Early Gold** with megapixel limits. |
| Image | `pica` 10.0.3 | MIT | npm/repo 2026-08 | Browser high-quality resize; README says worker selection; npm unpacked ~1.25 MB; **Observed** | README explicitly warns about iOS canvas memory; cancel must be wrapped by Strumentini.it seam; GHA 0 | Quality resize upgrade over raw canvas. **Early Gold candidate**, lazy within image tool. |
| Image | `browser-image-compression` 2.0.2 | MIT | npm 2023-03; repo pushed 2024-03 | Browser compression; worker option; npm unpacked ~863 KB; **Observed** worker mode | Maintenance is slower than alternatives; canvas-based memory constraints; abort support should be acceptance-tested before promotion; GHA 0 | Works, but overlaps native+pica. **Defer / optional adapter**, not baseline dependency. |
| Image | `compressorjs` 1.3.0 | MIT | npm 2026-04; repo pushed 2026-09-13 | Native Canvas `toBlob`; npm unpacked ~161 KB | Official README warns large-image OOM, recommends bounded dimensions (4096 or lower), and notes browser-dependent compression; GHA 0 | Small maintained convenience adapter. Compare against a direct native module before adding. **Early Gold alternate**. |
| Image metadata | `exifr` 7.1.3 | MIT | npm 2022-05; repo pushed 2024-03 | Browser/Node, JPEG/TIFF/PNG/HEIC/AVIF; mini/lite builds; npm unpacked ~1.29 MB; **Observed** EXIF read | Parser sees multiple metadata containers; use narrow build/options; GHA 0 | Strong metadata-inspection candidate. **Early Gold candidate** with format/field limits. |
| Image metadata | `piexifjs` 1.0.6 | MIT | npm 2022-06; repo last pushed 2021-07 | Browser EXIF read/insert/remove; npm unpacked ~85 KB; used only to synthesize fixture | Stale maintenance; JPEG-centric binary-string interface; GHA 0 | Kept **fixture-only** in spike. **Reject as production metadata authority**. |
| Image codec | `@jsquash/avif` 2.1.1 | Apache-2.0 | npm 2025-05; jSquash repo pushed 2026-01 | Browser/Web Worker WASM; **Observed** AVIF output; current production build emitted ~7.0 MB raw WASM across two variants | Large codec initialization/scratch memory; must be explicit lazy import, worker-owned and cancellable at safe boundary; GHA 0 | AVIF where native encoder unavailable. **Wave C only**. |
| Image codec | `@jsquash/jpeg` 1.6.0 | Apache-2.0 | npm 2025-05; shared jSquash repo 2026-01 | Browser/worker MozJPEG WASM; npm unpacked ~531 KB | Better-controlled JPEG codec but adds WASM and scratch buffers; GHA 0 | Only justify if native JPEG quality is measurably insufficient. **Wave C / optional**. |
| Image codec | `@jsquash/webp` 1.5.0 | Apache-2.0 | npm 2025-08; shared jSquash repo 2026-01 | Browser/worker libwebp WASM; npm unpacked ~915 KB | Same lazy worker/cancel/memory rules; GHA 0 | Only justify for deterministic/advanced WebP encoding. **Wave C / optional**. |
| Image engine | `wasm-vips` 0.0.18 | MIT package | npm 2026-06; repo pushed 2026-09-22; release v0.0.18 | libvips in browser/Node; npm unpacked ~12.5 MB; official README emphasizes streaming/section processing | Requires modern WASM features; larger runtime but potentially much better large-image memory behavior | Serious candidate for batch/large image Wave C after device matrix. **Wave C**. |
| Image engine | `@squoosh/lib` 0.5.3 | Apache-2.0 | npm last modified 2023-01; package unpacked ~12.3 MB | Broad Squoosh codec bundle | Stale npm package and broad dependency surface make it a poor production pin even though Squoosh remains useful prior art; GHA 0 | **Reject as default production dependency**; prefer maintained, capability-specific codecs. |
| Archive | `fflate` 0.8.3 | MIT | npm 2026-07; repo pushed 2026-05; release v0.8.3 | Browser/Node; ZIP + streaming ZIP; async/multithread options; npm unpacked ~797 KB; **Observed** bounded ZIP round-trip | Sync APIs are not acceptable for unbounded archives; enforce entry count, uncompressed total and compression ratio; GHA 0 | Small/medium ZIP create/inspect. **Early Gold candidate** with streaming/quotas for production. |
| Archive | `JSZip` 3.10.2 | MIT OR GPL-3.0-or-later | npm/repo 2026-09 | Browser ZIP read/create; npm unpacked ~693 KB | Convenient but less compelling than fflate for streaming-heavy path; GHA 0 | Redundant if fflate covers early scope. **Reject from default shortlist / fallback only**. |
| Archive | `@zip.js/zip.js` 2.17.0 | BSD-3-Clause | npm/repo 2026-09-21; release v2.17.0 | Streams, Zip64, split ZIP, encryption, incremental writing, parallel compression; npm unpacked ~8.46 MB | Rich surface requires archive-bomb/path/encryption corpus and explicit cancellation; GHA 0 | Best advanced archive candidate in this census. **Wave C**. |
| Archive primitive | `CompressionStream` / `DecompressionStream` | Web platform | Living web platform | Native streaming compression where supported | Provides compression formats, **not a ZIP container/index**; feature-detect and do not confuse with archive semantics | Useful internal primitive only. **Do not use as ZIP replacement**. |
| QR encode | `qrcode` 1.5.4 | MIT | npm 2025-11; repo pushed 2024-08 | Browser QR generation; npm unpacked ~135 KB; **Observed** | Deterministic bounded payload; easy to lazy-load; GHA 0 | Technically safe for Gold, although QR is demoted in product priority. **Early Gold-capable**. |
| QR decode | `jsQR` 1.4.0 | Apache-2.0 | npm 2025-11; repo pushed 2026-05 | Pure-JS raw image QR decoder; npm unpacked ~280 KB; **Observed** exact round-trip | Image buffer is width×height×4; downscale user images first; no built-in cancellation; GHA 0 | Single-image QR decode is viable. **Early Gold-capable but product-demoted**. |
| QR scan | `qr-scanner` 1.4.2 | MIT | npm 2022-11; repo pushed 2024-03 | Uses native `BarcodeDetector` when available and worker fallback; npm unpacked ~524 KB | Camera lifecycle/privacy and continuous-frame allocations add UX/security surface; GHA 0 | Use only if live camera scanning enters scope. **Defer**. |
| Barcode | `@zxing/browser` 0.2.1 | MIT | npm/repo 2026-07 | Browser image/video/camera layer; npm unpacked ~5.8 MB | Broad barcode feature set for a QR-only job; GHA 0 | **Reject for QR-only scope**; reconsider for multi-barcode pack. |
| Barcode | `zxing-wasm` 3.1.4 | MIT | npm 2026-09; repo pushed 2026-09-23; release v3.1.4 | WASM reader/writer for many barcode formats; npm unpacked ~3.68 MB | WASM/runtime overhead unnecessary for a QR-only early tool; GHA 0 | **Wave C only if multi-format barcode need is proven**. |
| Hash | Web Crypto `subtle.digest` | Web platform | W3C/Web platform | Browser-native cryptographic digest | The interface consumes the supplied data; there is no incremental SHA-256 state API, so large files require full-buffer materialization | Excellent small-file oracle/baseline. **Do not use as large-file hashing engine**. |
| Hash | `hash-wasm` 4.12.0 | MIT | npm/repo 2024-11; release v4.12.0 | Browser/worker, chunked streams, per-algorithm WASM; npm unpacked ~1.8 MB; **Observed** incremental SHA-256 | Manual progress is exact by bytes read; AbortSignal can stop at chunk boundary; WASM state is small; GHA 0 | Proven 24 MiB local hash path. **Early Gold candidate**, worker-wrap for large files. |
| Hash | `@noble/hashes` 2.4.0 | MIT | npm 2026-08; repo pushed 2026-09-08; release 2.4.0 | Pure JS, modular; npm unpacked ~692 KB | Official README documents independent Cure53 audit for core scope; current maintenance stronger than hash-wasm; GHA 0 | Strong alternative. Benchmark browser incremental SHA-256 before final dependency freeze. **Early Gold candidate**. |
| Hash | `spark-md5` 3.0.2 | WTFPL OR MIT | npm 2023-08; repo pushed 2023-11 | Browser incremental MD5; npm unpacked ~40 KB | MD5 is collision-broken and easy to misread as a security checksum; GHA 0 | **Reject for Strumentini.it integrity/checksum verifier**. |
| Signature | `file-type` 22.1.1 | MIT | npm/repo 2026-09-17; release v22.1.1 | Buffer/prefix/stream signature detection; npm unpacked ~139 KB; **Observed** ZIP/PNG | Official README says result is best-effort and not proof of validity/safety; malformed-input robustness best effort; GHA 0 | Best fit for inspection hints. **Early Gold candidate**, never a security-validation claim. |
| Signature | `magic-bytes.js` 1.13.1 | MIT | npm 2026-07; repo pushed 2026-07 | Browser/server first-byte detector; npm unpacked ~62 KB | Smaller but narrower evidence/semantics; signature matches remain hints; GHA 0 | Fine small alternate if `file-type` is too broad. **Alternate, not both**. |

Candidate count: **35 distinct library/platform approaches** assessed.

## Primary-source links

### PDF

- pdf-lib: https://github.com/Hopding/pdf-lib and https://www.npmjs.com/package/pdf-lib
- Mozilla PDF.js: https://github.com/mozilla/pdf.js and https://www.npmjs.com/package/pdfjs-dist
- Cantoo/Scribe pdf-lib fork: https://github.com/cantoo-scribe/pdf-lib and https://www.npmjs.com/package/@cantoo/pdf-lib
- unpdf: https://github.com/unjs/unpdf and https://www.npmjs.com/package/unpdf
- MuPDF npm package/source pointer: https://www.npmjs.com/package/mupdf
- pdfmake: https://github.com/bpampuch/pdfmake
- PDFKit: https://github.com/foliojs/pdfkit

### Image and metadata

- Canvas / image bitmap platform: https://html.spec.whatwg.org/multipage/canvas.html and https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html
- pica: https://github.com/nodeca/pica
- browser-image-compression: https://github.com/Donaldcwl/browser-image-compression
- Compressor.js: https://github.com/fengyuanchen/compressorjs
- exifr: https://github.com/MikeKovarik/exifr
- piexifjs: https://github.com/hMatoba/piexifjs
- jSquash codecs: https://github.com/jamsinclair/jSquash
- wasm-vips: https://github.com/kleisauke/wasm-vips
- Squoosh: https://github.com/GoogleChromeLabs/squoosh and https://www.npmjs.com/package/@squoosh/lib

### Archive and QR

- fflate: https://github.com/101arrowz/fflate
- JSZip: https://github.com/Stuk/jszip
- zip.js: https://github.com/gildas-lormeau/zip.js
- Compression Streams specification: https://compression.spec.whatwg.org/
- node-qrcode: https://github.com/soldair/node-qrcode
- jsQR: https://github.com/cozmo/jsQR
- qr-scanner: https://github.com/nimiq/qr-scanner
- ZXing browser layer: https://github.com/zxing-js/browser
- zxing-wasm: https://github.com/Sec-ant/zxing-wasm

### Hash and signatures

- Web Cryptography API: https://www.w3.org/TR/WebCryptoAPI/
- hash-wasm: https://github.com/Daninet/hash-wasm
- noble-hashes: https://github.com/paulmillr/noble-hashes
- SparkMD5: https://github.com/satazor/js-spark-md5
- file-type: https://github.com/sindresorhus/file-type
- magic-bytes.js: https://github.com/LarsKoelpin/magic-bytes

## Runnable spike design

The lane implements three isolated browser pages under `spikes/heavy-browser/`. Their shared public observation seam is:

```js
window.__STRUMENTINI_SPIKE_RESULT__
```

The page is considered successful only after behavior assertions pass and this result reports `ok: true`. Tests target observable output rather than internal function calls.

### Spike 1 — PDF capability separation

Synthetic fixture:

- four generated pages, each with a unique literal page marker;
- generated title/author/subject metadata;
- no external fonts/documents/assets.

Observed operations:

- create a PDF;
- reorder pages to 4 → 2 → 1 → 3;
- rotate the new first page 90°;
- split into two two-page PDFs;
- merge the splits back;
- extract page text with PDF.js and assert the literal reordered sequence;
- read source metadata;
- blank selected Info metadata fields and observe them absent in the output;
- render the first page into Canvas with PDF.js.

Important negative result: blanking selected document-info fields is **not** proof of complete metadata/privacy removal. XMP, attachments, embedded files, JavaScript/actions, annotations and other document structures need an explicit sanitization contract and corpus before Strumentini.it can label a PDF “clean”.

### Spike 2 — Image pipeline + metadata + AVIF

Synthetic fixture:

- generated 1600×1200 Canvas pattern;
- local JPEG encode;
- synthetic EXIF tags inserted only for the fixture.

Observed operations:

- EXIF read with `exifr`;
- decode with `createImageBitmap`;
- center-ish crop to 800×800;
- `pica` resize to 400×400;
- native Canvas JPEG and WebP encoding;
- browser-native AVIF attempt with MIME verification;
- `@jsquash/avif` WASM AVIF encode;
- `browser-image-compression` worker-backed compression;
- decode/re-encode observation showing the injected EXIF fields absent afterward.

Chrome 153 did **not** return `image/avif` from this Canvas `toBlob` attempt, so native AVIF cannot be assumed from API shape alone. The code verifies the returned MIME rather than trusting the requested one.

### Spike 3 — ZIP + QR + incremental hash + signatures

Synthetic fixture:

- three small generated archive entries;
- deterministic QR payload;
- deterministic byte-pattern Blobs for hashing;
- PNG generated from the QR Canvas.

Observed operations:

- ZIP create + inspect + round-trip content check with `fflate`;
- QR encode to Canvas + decode from pixels with exact payload equality;
- 24 MiB incremental SHA-256 using `Blob.stream()` and `hash-wasm`;
- byte-count progress events;
- `AbortSignal` cancellation after the first chunk on a separate fixture;
- SHA-256 agreement with Web Crypto on an independent 1 MiB oracle fixture;
- ZIP and PNG file-signature recognition without relying on a filename extension.

The spike deliberately uses synchronous ZIP functions only for the tiny fixture. This is **not** the production design for large archives.

## Observed runtime evidence

Environment:

- macOS system Google Chrome, headless user agent reporting Chrome 153;
- Node.js 26.6.0;
- Vite 8.3.0 production bundler;
- Playwright Core 1.63.0 browser driver;
- `crossOriginIsolated === false`, so no special isolation requirement was needed for these exact paths.

### Production-build smoke results

| Capability | Observed result | Selected timings | Heap observation |
|---|---|---:|---:|
| PDF | PASS; page order 4/2/1/3, split/merge count 4, rotation 90°, text/metadata/render all worked | mutation/split/merge 5.5 ms; extract/metadata 112.2 ms; first render 16.7 ms | +6.53 MB JS heap |
| Image | PASS; 1600×1200 → crop 800×800 → resize 400×400; JPEG/WebP/WASM AVIF outputs; EXIF fixture read/stripped on re-encode | crop+pica 49.2 ms; encode group 108.2 ms; worker compression 250.1 ms | +3.68 MB JS heap |
| File pipeline | PASS; ZIP 3 entries; QR exact; 24 MiB SHA-256; progress+abort; ZIP/PNG signatures | ZIP 1.3 ms; QR 19.8 ms; hash 103.7 ms; signatures 2.8 ms | +34.54 MB JS heap |

The 24 MiB hash digest observed was:

`f5990e08e841a5f856d4a0442881a63c263e526e9b474a3302943b5bf2d3bfc2`

It emitted 13 progress callbacks in the observed stream and matched Web Crypto on the separate 1 MiB oracle fixture.

### What the heap numbers do and do not mean

`performance.memory` is Chromium-specific and primarily reflects JavaScript heap. It does **not** account reliably for every native decoder, Canvas, GPU, ImageBitmap or WASM allocation. Therefore:

- use it as comparative evidence, not as a device-safe upper bound;
- preflight by file bytes **and decoded dimensions/page surfaces**;
- physical iOS/Android acceptance remains mandatory before Gold publication of Heavy tools.

## Bundle evidence

The bundle artifact is `quality/benchmarks/heavy-browser/bundle-sizes.json`.

### PDF build

- total: 2,122,213 raw / 677,643 gzip;
- PDF.js worker: 1,265,413 raw / 373,554 gzip;
- combined application module: 856,346 raw / 303,766 gzip.

Conclusion: rendering/extraction cannot ride in the shell or in every PDF mutation route. The mutation adapter and render/extraction adapter should be separate lazy modules even inside the PDF family.

### Image build

- total: 7,312,864 raw / 2,348,108 gzip;
- AVIF multithread WASM: 3,534,665 raw / 1,130,150 gzip;
- AVIF single-thread WASM: 3,485,872 raw / 1,115,948 gzip;
- main JS: 218,150 raw / 73,167 gzip.

Conclusion: the current import/build shape emits both AVIF WASM variants. This is a hard **Wave C** signal. If AVIF is approved later, its adapter must be dynamically imported only when AVIF is requested, and the build must prove that unused variants are not fetched.

### File pipeline build

- total: 252,963 raw / 87,928 gzip;
- main JS: 252,503 raw / 87,590 gzip.

This combined build includes ZIP, QR encode/decode, hashing and file-type recognition; production tools should still import only the capabilities they need rather than copying this intentionally combined spike.

## Mobile and memory risk analysis by family

### PDF

A rendered page is an RGBA surface. A 2480×3508 page is roughly 8.7 million pixels, or about **34.8 MB for one raw RGBA surface** before parser state, PDF bytes, text structures, another page, browser overhead or GPU copies.

Required production guardrails:

- render one page/thumbnail batch at a time;
- cap render scale from dimensions, not merely PDF byte size;
- release canvases/bitmaps and terminate stale worker tasks;
- do not pre-render an entire long document on mobile;
- page-mutation tools must account for input+output document copies;
- corruption/password/encryption/unsupported-feature errors remain recoverable, never remote-upload fallback.

### Images

A decoded 12-megapixel image is about **48 MB of raw RGBA** before crop/output surfaces and codec scratch space. Two or three simultaneous surfaces can cross 100 MB even when the JPEG/HEIC file on disk is only a few megabytes.

Required production guardrails:

- preflight pixel dimensions and estimated decoded bytes;
- mobile presets should reduce target size before allocating multiple full-resolution surfaces;
- close `ImageBitmap`s and zero/release temporary canvases;
- one heavy codec job per worker by default;
- AVIF/WASM is never eagerly initialized;
- cancellation clears references immediately at the nearest safe codec boundary;
- do not trust JS heap telemetry as a complete image-memory measure.

`pica` and Compressor.js both independently document mobile/canvas memory constraints, reinforcing the need for these limits.

### ZIP/archive

Archive byte size is a poor predictor of decompressed memory. The critical threats are archive bombs, enormous entry counts and malicious/path-like entry names.

Required production guardrails:

- never call sync whole-archive unzip on unbounded user input;
- stream entries where the chosen library permits it;
- set hard compressed bytes, entry count, per-entry uncompressed bytes, total uncompressed bytes and compression-ratio ceilings;
- normalize names and treat them as labels, never trusted filesystem paths;
- reject unsupported encryption/split archive semantics explicitly;
- emit progress from known compressed/uncompressed byte counters only;
- cancel/terminate worker before retaining decompressed buffers.

### QR/barcode

Single QR images are usually modest, but a decoder receives an RGBA frame. Large uploaded photographs should be downscaled before QR scanning. Continuous camera scanning must reuse/downscale frames and avoid retaining a frame history.

Required production guardrails:

- cap input pixels;
- do not request camera permission for file-image decoding;
- camera scan is a separate capability from QR decode;
- no navigation/open-URL side effect merely because a QR payload looks like a URL.

### Hashing

True incremental hashing can keep algorithm state small, but fixture construction itself can dominate memory. This lane's 24 MiB generated Blob produced roughly a +34 MB JS-heap observation because the synthetic fixture is materialized in page memory.

Production must hash the user's `File`/`Blob` stream directly:

- use bounded chunks/stream reader;
- progress = bytes hashed / known file size;
- AbortSignal checked between chunks;
- never call `arrayBuffer()` on the full multi-gigabyte file merely to use Web Crypto;
- SHA-256 is the default integrity hash; do not present MD5 as collision-resistant.

### File signatures

Signature sniffing needs only a small prefix for many formats and is low-memory compared with parsing. The risk is semantic, not primarily memory: a matching magic number does not establish that a file is valid or safe.

Production UI/API wording should say “detected type” or “signature suggests”, not “verified safe file”.

## Security audit summary

### Dependency/advisory checks

- `npm audit` on the installed spike graph: **0 vulnerabilities**.
- Exact-version GitHub Advisory Database queries for the 29 npm library candidates in the matrix: **0 matching advisories** on 2026-09-23.
- Licenses were recorded from current npm package metadata; MuPDF's AGPL-3.0-or-later is the only clear default-policy blocker in this shortlist.

### High-confidence application risks independent of advisories

| Risk | Severity for product | Required control |
|---|---|---|
| ZIP decompression bomb / huge entry graph | High | Streaming + hard uncompressed/ratio/entry limits + worker termination. |
| Mobile image decoded-surface OOM | High | Pixel preflight, bounded dimensions, one heavy job, release buffers. |
| PDF pathological/corrupt parser workload | High | Worker isolation, page/render limits, corrupt corpus, timeout/cancel seam. |
| Metadata “removed” claim while other containers remain | High correctness/privacy | Define exact metadata carriers; inspect post-output; do not market perfect sanitization without a corpus/contract. |
| File signature treated as security validation | High correctness/security | UI/API explicitly says best-effort type hint; parser still validates content. |
| QR payload automatically executed/opened | Medium | Decode returns inert text only; user initiates follow-on action. |
| Heavy WASM fetched in shell | Medium performance | Tool/operation dynamic import; bundle gate asserts no eager WASM. |
| Main-thread sync ZIP/PDF/image work | Medium–High UX | Worker adapter for heavy thresholds; synchronous APIs only below measured small-file gate. |

## Recommended capability modules

The implementation wave should preserve small interfaces rather than expose third-party library objects:

```ts
type Progress = { phase: "preparing" | "processing" | "encoding" | "writing"; completed?: number; total?: number };

interface PdfPageMutation {
  mutate(input: Blob, plan: PageMutationPlan, signal: AbortSignal, onProgress?: (p: Progress) => void): Promise<Blob>;
}

interface PdfInspection {
  inspect(input: Blob, signal: AbortSignal): Promise<PdfInspectionResult>;
}

interface ImageTransform {
  transform(input: Blob, request: ImageTransformRequest, signal: AbortSignal, onProgress?: (p: Progress) => void): Promise<Blob>;
}

interface ArchiveInspection {
  inspect(input: Blob, limits: ArchiveLimits, signal: AbortSignal, onProgress?: (p: Progress) => void): Promise<ArchiveManifest>;
}

interface IncrementalHash {
  digest(input: Blob, algorithm: "SHA-256", signal: AbortSignal, onProgress?: (done: number, total: number) => void): Promise<string>;
}

interface FileSignatureInspection {
  detect(prefix: Uint8Array): Promise<{ extension?: string; mime?: string; confidence: "signature-hint" }>;
}
```

The third-party adapter stays private behind each seam. This allows replacing `pdf-lib` with a maintained fork, `hash-wasm` with `@noble/hashes`, or a native codec with WASM without changing tool manifests or acceptance tests.

## Early Gold recommendation

Safe enough to ticket for early Gold **provided the normal Gold browser/mobile/corpus gates still pass**:

- bounded image resize/crop + JPEG/WebP conversion using native browser primitives, optionally `pica` for higher-quality resize;
- image metadata inspection using a narrow `exifr` build;
- bounded ZIP create/inspect using `fflate`, but production large-file paths must use its streaming/async surfaces rather than the spike's sync calls;
- QR encode and single-image decode using `qrcode`/`jsQR` if product prioritization promotes them;
- incremental SHA-256 using a small adapter, with `hash-wasm` already proven and `@noble/hashes` deserving a final comparative benchmark;
- signature sniffing with `file-type` as an explicit hint, never a safety validator.

Image “metadata remove” can join early Gold only with wording limited to the exact tested raster formats/metadata containers. A generic “remove all metadata” promise is not justified by this spike.

## Heavy Wave C recommendation

Keep these behind the Heavy/Wave C gate:

- PDF merge/split/reorder/rotate until the chosen mutation engine passes a hostile/corrupt PDF corpus and mobile memory acceptance;
- PDF rendering and text extraction with PDF.js in a separate lazy worker module;
- PDF metadata removal/sanitization, which needs a much stronger definition than clearing Info fields;
- AVIF and other WASM image codecs;
- large/batch image work with `wasm-vips` or equivalent;
- advanced archive jobs (Zip64, split/encrypted ZIP, huge archives) with `zip.js` or another streaming engine;
- camera QR scanning and multi-format barcode work;
- any tool whose normal path needs multiple simultaneous decoded image/PDF surfaces.

## Rejections

- **No one-library heavy stack.** Capability families have materially different size, security and cancellation characteristics.
- **No eager PDF.js or WASM codec import.** The measured bundle sizes are incompatible with the shell budget.
- **No `@squoosh/lib` as the default new dependency.** The npm package is stale relative to the capability-specific maintained options and is broad/heavy.
- **No production reliance on `piexifjs`** as metadata authority; it remains a synthetic-fixture helper only here.
- **No MD5 checksum product via SparkMD5.** SHA-256 should be the integrity baseline.
- **No `CompressionStream` masquerading as ZIP support.** Compression streams do not supply a ZIP central directory/container contract.
- **No file-signature “safe/valid” verdict.** `file-type` itself explicitly rejects that interpretation.
- **No automatic server fallback when a mobile device cannot complete a local heavy operation.** Show an explicit unsupported/limit state instead.

## Reproduction

```bash
cd spikes/heavy-browser
npm ci
npm run bench
```

Expected outputs:

- `quality/benchmarks/heavy-browser/observed-runtime.json`
- `quality/benchmarks/heavy-browser/production-smoke.json`
- `quality/benchmarks/heavy-browser/bundle-sizes.json`
- `quality/benchmarks/heavy-browser/npm-audit.json`
- `quality/benchmarks/heavy-browser/top-level-dependencies.json`

## What remains for production tickets

This lane deliberately stops before production integration. Downstream tickets should separately prove:

1. the final PDF mutation adapter (`@cantoo/pdf-lib` vs pinned `pdf-lib` or another engine) against a legal hostile/corrupt corpus;
2. final incremental SHA-256 adapter (`hash-wasm` vs `@noble/hashes`) under the same worker interface;
3. actual iOS Safari and Android Chrome memory thresholds;
4. worker termination/cancellation for PDF render, image codecs and streaming archive operations;
5. exact metadata-removal semantics by format;
6. bundle assertions proving PDF.js/AVIF/other WASM is not fetched before the relevant operation is opened;
7. cross-browser output quality fixtures for Canvas JPEG/WebP because native encoders are allowed to differ.

Those are ticket-level acceptance requirements, not reasons to keep researching the architecture indefinitely.
