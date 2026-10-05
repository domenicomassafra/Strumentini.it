# Format × operation matrix — compression, conversion, PDF and document workflows

Status: **future expansion authority beneath `docs/10-tool-expansion-result-system-v2.md`**  
Research refresh: **2026-10-05**

This document turns broad families such as “images”, “PDF” and “documents” into concrete jobs. It is intentionally directional: `DOCX → MD` and `MD → DOCX` are different jobs with different fidelity risks, even if they share one engine.

## 1. Evidence from the current implementation

The current catalog already has useful foundations, but several labels are broader than their implementation:

- `image-compression` currently decodes to canvas and re-encodes JPEG/PNG/WebP with one generic quality value. That is not equivalent to a real PNG lossless optimizer, SVG optimizer, WebP-specific encoder, AVIF compressor, or target-size compressor.
- `image-format-conversion` currently covers browser-decoded JPEG/PNG/WebP and browser-encodable JPEG/PNG/WebP. HEIC, AVIF, GIF optimization, SVG vector optimization and richer codec controls are outside that path.
- `pdf-compression-lite` currently normalizes addressable streams/metadata and explicitly does **not** claim image recompression. A real PDF compressor therefore remains a missing job.
- `pdf-merge`, split, rotate, reorder and delete/extract exist, but the shared UI is text/range driven. It lacks the thumbnail page-organizer workflow users expect from mature PDF tools.
- `pdf-text-extraction` exists, but editable-format reconstruction such as PDF→DOCX/XLSX/PPTX is a separate fidelity problem.
- DOCX/ODT/PPTX/XLSX document conversion is not part of the current 200-tool catalog.

## 2. Benchmark floor

Current competitor feature sets establish a reasonable expectation floor:

- iLovePDF: merge, split, compress, Office→PDF, PDF→Word/PowerPoint/Excel, OCR, JPG/image↔PDF, page numbers, watermark, rotate, unlock/protect, remove/reorder/organize pages, PDF/A, repair, web→PDF, edit, sign, redact, forms, crop, extract and PDF→Markdown.
- Smallpdf: PDF compression and conversion, OCR, PDF/A, PDF↔Word/Excel/PPT, ODT/ODS/ODP/TXT/RTF/HTML/EPUB/CSV→PDF, merge/split/rotate/delete/extract/organize, crop/redact/watermark/form fill/sign/protect/unlock/flatten.
- iLoveIMG: batch compress JPG/PNG/SVG/GIF, resize/crop/rotate, broad image→JPG conversion including HEIC/WebP/SVG, watermark, editor, blur/private-region workflows.
- Compressor.io and browser-local compressors: JPEG/PNG/SVG/GIF/WebP, lossy/lossless distinction, quality/resize and measurable before→after savings.
- SVGOMG/SVGO: multipass SVG optimization, precision controls, metadata/comments/editor-data removal, path/style/ID cleanup, original-vs-optimized preview and gzip-size comparison.
- CloudConvert/Convertio: broad directional document routes including MD↔DOCX, DOCX→MD/TXT/HTML/PDF, TXT→DOCX/PDF, HTML→DOCX/PDF, Office↔PDF.

Competitor existence is evidence of a user job, not permission to copy cloud architecture or make unsupported fidelity claims.

## 3. Compression matrix

Legend: **E** existing foundation, **U** upgrade existing route/engine, **A** add a distinct job/route, **S** blocked by feasibility spike.

| Format/job | State | Required behavior |
|---|---|---|
| JPEG/JPG compressor | U | JPEG-native encoder, quality preset + advanced mode, progressive option if supported, chroma/subsampling where exposed, strip/keep metadata choice, optional resize, target KB, visual compare |
| PNG compressor lossless | A | true lossless optimization, preserve alpha/pixels, optimization effort, strip safe ancillary metadata, before→after bytes |
| PNG compressor lossy/palette | A | color-count reduction, dithering control, transparent-pixel handling, side-by-side preview, explicit “lossy” label |
| WebP compressor | A | lossy/lossless modes, alpha quality where supported, effort/speed preset, target KB, before→after preview |
| AVIF compressor | S/A | WASM/browser capability proof, quality/speed controls, target size, decode verification |
| SVG optimizer/compressor | A | SVGO-style safe preset, multipass, precision, preserve viewBox, remove metadata/comments/editor data, optional aggressive toggles, markup diff, raw + gzip size |
| GIF optimizer | S/A | frame/color optimization without breaking animation/timing/transparency; offer WebP/video conversion where smaller |
| HEIC size reduction | S | primarily decode→JPEG/WebP/AVIF with explicit format change; native HEIC re-encode only if proven |
| Batch image compressor | A | mixed input queue, per-file codec/profile, progress, isolated failures, total bytes saved, download-all ZIP |
| Image “under X KB/MB” | A | iterative encoding/downscale strategy, hard `≤ target` success check, best-effort failure explanation, never claim an exact size before encoding |
| PDF basic compressor | U | structure/stream cleanup and metadata minimization with byte delta, retaining text/vectors |
| PDF image-aware compressor | A | detect embedded images, downsample/recompress according to profile, preserve searchable text/vector content |
| PDF scan compressor | A | scan-oriented DPI/quality/grayscale choices with readable preview and explicit quality trade-off |
| PDF “under X KB/MB” | A | progressive profiles/iterations; final file must satisfy target or explain impossible without destructive tactics |
| Batch PDF compressor | A | queue, per-file before→after size, failures isolated, ZIP output |
| ZIP compressor | U/A | current ZIP creator uses `store`; add DEFLATE compression levels, before→after aggregate size, per-entry method/result |
| GZIP compressor/decompressor | A | single-file gzip/gunzip with verified round-trip and CRC/integrity reporting |
| 7z/RAR | S | inspect/extract only if a maintained local WASM/library path passes licensing, memory and mobile checks; creation is lower priority |
| DOCX compressor | A | inspect OOXML package, recompress/resize embedded images, max-DEFLATE package rewrite, preserve document XML/styles/relationships, before→after component report |
| PPTX compressor | A | recompress/resize embedded slide images/media where safe, package rewrite, report dominant media, preserve editable slide structure |
| XLSX compressor | A | max-DEFLATE package rewrite plus embedded-image optimization where present; report when workbook XML/styles rather than media dominate size |
| Audio compressor | S | codec/bitrate/sample-rate/channel strategy; target size where mathematically estimable |
| Video compressor | S | codec/CRF/bitrate/resolution strategy; target MB with duration-based bitrate budgeting |

### Compression result contract

Every compressor must show at least: source format, output format, original bytes, result bytes, saved bytes + percentage, dimensions/duration/pages as relevant, lossless/lossy status, settings actually used, and download. A file that becomes larger is not shown as a successful “compression” without an explicit warning and keep-original recommendation.

## 4. Image conversion matrix

High-value raster/vector routes should be discoverable by job while sharing codec engines.

| From | To | Priority / notes |
|---|---|---|
| JPG/JPEG | PNG, WebP, AVIF | high; AVIF spike-gated |
| PNG | JPG, WebP, AVIF | high; flatten alpha for JPG with chosen background |
| WebP | JPG, PNG, AVIF | high |
| AVIF | JPG, PNG, WebP | high once decoder proven |
| HEIC/HEIF | JPG, PNG, WebP, PDF | high for iPhone users; spike-gated decode |
| SVG | PNG, JPG, WebP, PDF | high; choose raster dimensions/background; keep separate from SVG optimization |
| JPG/PNG/WebP | SVG | **do not market as true vector conversion** unless tracing is intentionally implemented; raster-in-SVG wrapper is not vectorization |
| GIF | JPG/PNG/WebP | extract first/selected frame vs animated conversion must be explicit |
| Images | PDF | existing foundation; upgrade ordering/page size/margins/fit/orientation |
| PDF pages | JPG/PNG/WebP | existing foundation; add DPI/scale/page range/output format and ZIP |

## 5. PDF operations matrix

### Existing jobs that must become materially better

| Existing tool | Functional upgrade beyond Result v2 |
|---|---|
| Merge PDF | thumbnail cards, drag order, mixed file ordering, per-file page counts, rotate/delete individual pages before merge, undo, final total pages/size |
| Split PDF | modes: every page, page ranges, every N pages, custom groups, selected pages; range syntax such as `1-3,5,8-last`; output names + ZIP |
| Delete/extract pages | page thumbnails with multi-select, invert/select all, keyboard selection, delete vs extract preview, remaining/extracted page count |
| Reorder pages | drag thumbnails, multi-select move, reverse/odd-even helpers where safe, undo, duplicate page optionally |
| Rotate PDF | per-page thumbnails and 90/180/270 controls, rotate selected/all |
| PDF→images | page range, JPG/PNG/WebP, scale/DPI, quality, transparent/background behavior, ZIP |
| Images→PDF | reorder, per-image rotate, A4/Letter/original page, margins, fit/fill, orientation, one image/page vs contact sheet |
| Extract text | page range, layout-preserving vs reading-order mode, plain TXT/Markdown output, page separators |
| Extract images | all supported embedded raster images, dedupe option, page/object provenance, original bytes when safe |
| Compare PDF | page alignment, added/removed/changed page summary, text diff where extractable, visual overlay/diff where renderable |
| Flatten PDF | explain exactly what is flattened; before/after fields/annotations count; preserve visual appearance |
| Password check/remove | accept a user-supplied password for legitimate decryption; never imply bypass; report encryption type/capability when known |
| Metadata inspect/remove | richer fields, before/after diff, verified removal report |
| Compression lite | becomes “basic/structural optimization” rather than pretending to be the complete PDF compressor |

### Missing PDF jobs

Add: real compression profiles; target-size compression; page numbers; watermark; crop; change/normalize page size; sign/draw/place signature; redact destructively; encrypt/protect; fill/annotate; repair; PDF/A; OCR/searchable PDF; search across PDFs; n-up; booklet; front/back interleave; split by target size; web/HTML→PDF where deterministic/local input exists; PDF→Markdown; PDF→DOCX/XLSX/PPTX where fidelity spike supports it.

## 6. Document conversion matrix

### Text/markup conversions — good local candidates

| Source | Output | Contract |
|---|---|---|
| TXT | MD | preserve text; optional paragraph/list heuristics must be opt-in, not invented structure |
| TXT | HTML | escape content; optional paragraph/line-break structure |
| TXT | DOCX | preserve paragraphs/line breaks; styling template is explicit |
| TXT | PDF | explicit font, page size, margins, line wrapping, headers/page numbers |
| MD | TXT | strip syntax while preserving readable text; report removed constructs |
| MD | HTML | CommonMark/GFM mode stated; sanitized preview/output |
| MD | DOCX | headings/lists/tables/code/links/images mapped where supported; unsupported constructs listed |
| MD | PDF | render from the same normalized document model as DOCX/HTML where possible |
| HTML | TXT | text extraction/reading order; script/style excluded |
| HTML | MD | deterministic conversion with unsupported constructs listed |
| HTML file | PDF | local HTML input only by default; external URL→PDF would be a separate network/browser job |
| HTML | DOCX | map supported semantic blocks/styles; disclose unsupported CSS/layout |

### DOCX/ODT rich document conversions

| Source | Output | Priority / fidelity rule |
|---|---|---|
| DOCX | TXT | high; text extraction with paragraph/table options |
| DOCX | MD | high; semantic headings/lists/tables/images where recoverable |
| DOCX | HTML | high; structured output, sanitized embedded assets |
| DOCX | PDF | high demand, but requires fidelity benchmark before claiming layout preservation |
| MD/TXT/HTML | DOCX | high; deterministic document generation is easier than perfect DOCX rendering |
| DOCX ↔ ODT | medium; spike-gated and fidelity-labelled |
| RTF | TXT/HTML/DOCX/PDF | medium; only after parser/library proof |
| ODT | TXT/MD/HTML/PDF/DOCX | medium; spike-gated |

### Spreadsheet/presentation conversions

| Source | Output | Priority / notes |
|---|---|---|
| XLSX | CSV | already planned; sheet selection + type preservation |
| CSV | XLSX | already planned; preserve IDs/leading zeros |
| XLSX | PDF | high but rendering fidelity spike required |
| XLSX | HTML | useful local table export; per-sheet |
| CSV | PDF | useful printable table path with page orientation/fit |
| PPTX | PDF | high but layout/font fidelity spike required |
| PPTX | PNG/JPG | medium/high; slide rasterization if renderer proves reliable |
| PPTX | text/outline | useful deterministic extraction even if visual conversion is refused |
| PDF | XLSX | table extraction only; never promise arbitrary page reconstruction as spreadsheet |
| PDF | PPTX | each page-as-slide image is a distinct “presentation from PDF” mode from editable reconstruction |

### PDF outbound conversions

| PDF to… | Preferred truthful job |
|---|---|
| TXT | existing extraction upgraded |
| MD | text/structure extraction; OCR path for scans |
| DOCX | editable reconstruction where fidelity corpus passes; otherwise “extract to DOCX” with limitations |
| XLSX | tables→sheets, not arbitrary visual page→spreadsheet |
| PPTX | page-as-slide is reliable baseline; editable reconstruction only if proven |
| JPG/PNG/WebP | page rendering with resolution controls |
| SVG | page vector export only if library preserves vector semantics; otherwise do not fake vector output |

## 7. Web-asset and structured-file size reducers

Compression is not only binary image/PDF compression. Add deterministic minimizers where their semantics are clear:

- SVG optimizer (primary vector compressor).
- JSON minify/prettify dual mode using the current JSON parser.
- CSS minify with parser validation.
- HTML minify with safe/advanced modes; never remove meaningful whitespace blindly from `pre`, `textarea`, inline text contexts.
- XML minify/prettify after validation.
- CSV size cleanup report: normalized newline/encoding/quoting only when semantically equivalent; do not call row/column deletion “compression”.

JavaScript minification is not a priority unless a standards-grade parser/minifier dependency is explicitly approved; regex minification is refused.

## 8. Cross-format workspace rules

All file converters/compressors use the same baseline interaction:

1. drag/drop + file list;
2. detect real signature/type rather than trusting extension;
3. show source facts before running;
4. show only options that affect the selected format/job;
5. cancellable progress for expensive work;
6. verified output signature/type;
7. result preview when meaningful;
8. before→after table;
9. direct download, and ZIP for batch/multiple outputs;
10. “continue with…” handoffs such as `HEIC→JPG → comprimi JPG → ridimensiona`, or `DOCX→PDF → comprimi PDF → firma`.

Archive extraction additionally rejects path traversal, absolute paths and unsafe overwrite behavior before writing any output.

For OOXML (`.docx`, `.pptx`, `.xlsx`), the tool must show which package components consumed space before and after compression and must preserve a valid reopenable Office package.

## 8.1 Cross-format “why is this file large?” analyzer

Add a local diagnostic tool that does not modify the file. For supported formats it reports the dominant byte contributors and routes the user to the right next action:

- images: pixel dimensions, encoding, metadata, likely savings from resize/re-encode;
- PDF: embedded images, page count, metadata/stream contribution where measurable, scan-heavy vs text/vector-heavy classification;
- DOCX/PPTX/XLSX: OOXML ZIP entries grouped into media, XML, fonts/embeddings and other package parts;
- ZIP/archive: compressed vs uncompressed totals and largest entries;
- audio/video: duration, codec, bitrate, resolution/sample rate where inspectable.

The analyzer reports opportunities; it does not promise savings before the corresponding compressor actually runs.

## 9. Routes vs engines

Create a distinct route when the user's intent, defaults or result differs materially. Examples that deserve separate discoverable routes even if one codec engine runs them:

- Comprimi JPG
- Comprimi PNG
- Comprimi WebP
- Ottimizza SVG
- Comprimi immagine sotto X KB
- HEIC in JPG
- PNG in JPG
- JPG in WebP
- SVG in PNG
- DOCX in PDF
- PDF in DOCX
- Markdown in DOCX
- DOCX in Markdown
- TXT in PDF
- PDF in Markdown
- Comprimi PDF
- Unisci PDF
- Elimina pagine PDF

Do **not** create a separate route for every mathematically possible pair if it has no meaningful demand or truthful fidelity story. The matrix is a product filter, not a combinatorial route generator.

## 10. Definition of completeness for this matrix

- every high-priority compression row has a concrete ticket and a codec/fidelity proof;
- every existing PDF operation has a functional-upgrade owner, not only a Result v2 owner;
- each high-value document conversion direction is `IMPLEMENT`, `SPIKE`, or `REFUSE`, never silently absent;
- every generated file is signature/type verified before download;
- conversion pages name what structure/fidelity is preserved and what can be lost;
- no raster wrapper is sold as vectorization, no PDF extraction is sold as perfect Office reconstruction, and no target-size compressor claims a target it did not actually hit.
