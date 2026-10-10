# Format × operation × result acceptance matrix

Derived planning crosswalk to the *directional* source matrix docs/11-format-operation-matrix.md, actual 269 manifests, and donor proposals. This is a roadmap inventory, NOT evidence that every direction is implemented. Codes are canonical issue IDs, not extra GitHub issues. Original doc is dated October 5 and contains baseline language about 200; current catalog has 269.

| Family / user job | Direction or operation | Level / truth | Existing and new canonical issues | Acceptance & refusal boundary |
|---|---|---|---|---|
| PDF merge split pages reorder rotate | PDF -> PDF; page thumbnails, delete/extract/reorder/rotate | base; editor advanced | #215, #216, #217, #235, #372, #379, #380 | Page source→ordered output PDF reopens with correct page/geometry; 1/50/200, iOS/Android physical for editor |
| PDF edit original text and layout | born-digital PDF -> edited semantic PDF | advanced | #369, #373, #380 | Original glyph/text semantics, fonts and visual geometry independently verified; unsupported signature/font refuses |
| PDF annotations/forms | PDF -> annotated/filled/flattened PDF | advanced | #374, #375, #376, #380 | Coordinates/field values/print and PDF.js/PDFKit cross-reopen |
| PDF irreversible redaction | sensitive PDF -> fresh rasterized redacted PDF | security HOLD | #237, #378, #406 | Adversarial recovery/hidden object/signature/metadata, independent security signoff; no public route now |
| PDF OCR and image conversion | scanned PDF <-> images, searchable PDF | base and advanced | #246, #247, #377, #395 | Mixed pages, rotations, independent text bbox extraction, source/display match, device OOM/cancel |
| PDF encrypt unlock repair PDF/A | encrypted/corrupt/or generic PDF -> specific supported outputs | feasibility; refused historical | #417, #418, #419 | Right/wrong password, typed refusal, independent conformance/reader; NEVER claim shipped |
| PDF to editable Office | PDF -> semantic DOCX | feasibility; refused | #369, #420 | Tables/text reeditable, font/layout diff and declared loss; no rasterized photo disguised as DOCX |
| Office rich export | DOCX -> PDF; XLSX -> PDF; PPTX -> PDF | feasibility; refused in rich fidelity | #56, #368, #392 | Independent fonts/layout/tables/charts page proof; full license runtime and mobile memory |
| Light documents Markdown CSV | TXT/MD/HTML/CSV -> printable PDF and DOCX/MD conversion bounded | base supported subset | #56, #368, #392 | Subset semantics and refusal for complex rich Office |
| Image codecs compression | JPEG/PNG/WebP/SVG/AVIF -> compressed same format | base incomplete; donor study | #47, #367, #393 | Alpha lossless vs lossy, quality target, metadata, vector SVG safety, independent pixel/orientation |
| Image format conversion | HEIC/AVIF/GIF/JPEG/PNG/WebP/SVG -> supported directional target | base partial; advanced animated | #49, #212, #393 | iPhone original HEIC, animated GIF frames/timing, EXIF color profile and MIME not guessed |
| Image advanced editor | image -> layered project -> flat output | advanced | #381, #382, #383, #384, #385, #386, #412 | Alpha/compositing/selection/color/touch/undo; native device S/M/L proof |
| Excel CSV interchange | CSV -> XLSX; XLSX -> CSV; CSV -> MD table; inverse permitted subset | base | #161, #370, #387 | Precision, leading zeros, dates, formulas, CSV injection and per-sheet bounds |
| Data editor and pipelines | CSV/XLSX -> clean/filter/join/diff -> CSV/XLSX | base + advanced | #388, #389, #390, #391 | Preview exact output rows, duplicate keys, no macro execution, multi-step rollback |
| OCR IT and EN | image/PDF -> extracted TXT/searchable PDF | base bounded, advanced languages | #246, #247, #371, #377, #395 | Independent character accuracy per corpus, owner date and physical resources |
| Archive and file safety | ZIP/GZIP/EPUB/EML/MSG/P7M -> extracted scoped output | historical refusal and feasibility | #416, #421, #422, #423, #407 | Independent output/attachment/charset/security, no zip bomb/tracker/code execution |
| Media and mobile | audio/video -> supported codec/bitrate output | feasibility | #229, #403, #411, #424 | Real mic permission & audio bytes, output playable, iOS/Android resource/cancel |
| Fiscal and Italian source | year-specific data -> IVA/IRPEF/net salary/TFR/forfettario | base conditional official sources | #115, #117, #396, #397, #398, #399, #400, #401, #402, #409 | Official source SHA/effective dates, dated refused windows, no unsourced 2025->2026 reuse |
| App local and optional service | file -> operation -> result -> selected next operation | base product journey | #333, #334, #335, #337, #338, #339, #340, #341, #348, #349 | Local file no silent network; reuse typed bytes, output source proof, explicit server TTL/cost |

## Source and mode contract

- Every directional conversion is a distinct contract; inverse capability is not inferred. Formats with no public output proof remain a study or refusal.
- File sizes, memory/worker cancellation and upload/storage consent are measured per browser and format. Desktop 390px viewport does NOT count as iOS/Android physical acceptance.
- File and table Result System v2 correctness never substitutes independent output reopen; source/revision evidence and native physical receipts must be tracked separately.
- Do not infer professional editor parity from a partial page editor, PDF.js rendering, a canvas overlay, or a donor README.
- Installed donor licenses and transitive WASM/codec/fonts/assets checked in DONOR-ADOPTION-MATRIX.md; NO GO means do not import.
