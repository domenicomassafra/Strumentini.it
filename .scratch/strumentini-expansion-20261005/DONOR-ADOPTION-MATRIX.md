# Donor adoption / reuse decisions — planning only

Based on worker C detailed engine/donor evidence in tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/engineering/DONOR-ENGINE-MATRIX.md. Observations as of 2026-10-10; versions/prices must be independently refreshed before any future import. No adoption/license/install is authorized by this file.

| Candidate | Rights and provenance boundary | Decision now | Ticket links | Next proof |
|---|---|---|---|---|
| PDF.js/qpdf existing | Apache provenance already vendored, API+Worker version parity mandatory | RETAIN + HARDEN | #369, #372, #406 | Protect PDF.js 6.3 vs 6.4 mismatch; pinned qpdf 0.4.0 WASM |
| MuPDF.js | AGPLv3 or separate commercial license | NO GO WITHOUT COMMERCIAL LICENSE | #366, #369, #414 | No free proprietary embed or guessed commercial price |
| Tesseract.js Ita data | Apache-2.0/MIT parts; check runtime assets | CONDITIONAL EXISTING OCR | #371, #395, #377 | Lab only; quality corpus, mobile RSS and worker termination pending |
| jSquash JPEG WebP AVIF Oxipng | Apache-2.0 wrappers; codec/WASM/transitive licenses additional | COMPARE JPEG AND WEBP FIRST | #366, #367, #393 | Alpha/ICC/EXIF, lossless, CSP, bytes, Safari and cancellation |
| heic-to/libheif | Installed heic-to, LGPL core and codec rights unclear | CONDITIONAL | #367, #393 | Actual iPhone HEIC capture, EXIF orientation and physical Safari |
| SVGO | v4.1.0 installed | REUSE INSTALLED | #367, #393, #407 | Sanitize hostile SVG and external references, preserve viewBox and IDs |
| Libre Convert/ZetaOffice | MIT wrapper, runtime rights DIFFERENT and unverified | NO GO UNTIL RUNTIME LICENSE | #366, #368, #392 | Observed 49.75MiB brotli runtime, COOP/COEP/SAB/cache, fonts and fidelity |
| OOXML/Excel current libs | read-excel-file/write-excel-file/fflate already installed | RETAIN BOUNDED | #370, #387, #392 | Excel formulas/macros/print fidelity not inferred |
| ExcelJS | MIT candidate, no browser proof | COMPARE CONDITIONALLY | #366, #370, #389 | Workbook precision/styles/formulas and bundle/mobile regression |
| xlsx 0.18.5 / legacy pptxgenjs | Known high advisories at audited package versions | DENY | #366, #368, #370 | No advisory-bearing import for a license shortcut |
| Fabric.js/Konva | MIT candidates; canvas scene graph is not pixel editing suite | ISOLATED FEASIBILITY | #366, #381, #382, #384 | Touch Preact, raster masks, history and project serialization |
| AG Grid Community/Univer OSS | MIT/Apache OSS portions; Enterprise/Pro separate paid licensing | COMPARE OSS-ONLY | #366, #370, #389, #414 | Export/import/pivot/formula not assumed in free tier |
| HyperFormula | GPLv3 or paid commercial | NO GO WITHOUT LICENSE | #366, #389, #414 | Proprietary product constraint |
| Cloudflare server mode | Current auth/favorites Worker is not a file transform service | FEASIBILITY ONLY | #348, #349, #414 | Zero additional cost, explicit file opt-in, bounded storage and deletion |
| Italian primary sources | Normattiva, Gazzetta, AdE, MEF/DEF, INPS, ISTAT | OFFICIAL SOURCES FIRST | #397, #398, #400, #402, #409 | Year-effective dated snapshots and independent worked examples |

## Mandatory adoption gate

1. Compare no-change/native/installed engine versus exact pinned donor using same real independent output fixtures.
2. Verify package SHA, maintenance, SBOM, all direct/transitive copyright notices, fonts, WASM/native codec licenses and redistribution rights. A wrapper license does not settle the runtime.
3. Record transfer bytes, memory including native/WASM, lazy loading, CSP/offline/caching, pixel or document fidelity and abort/retry on real mobile devices. Do not equate viewport emulation with physical.
4. Name exactly which existing engine responsibility donor replaces, report savings and rollback, and set supported subset plus typed refusal.
5. Commercial quote requires documented owner approval (#414); recurring server cost increment initially no greater than zero euros (#348); no hidden network or file upload.
6. A successful exploratory benchmark is still not an accepted implementation or public release. #405 is separate.

Unresolved: MuPDF commercial quote; ZetaOffice runtime redistribution rights; HEIC patent/transitive codec rights; actual physical device memory; scope-specific current Gold proof. Historical REFUSED decisions stay historical.
