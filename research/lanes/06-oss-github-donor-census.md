# UtilityOS OSS / GitHub donor census

Date: 2026-09-23
Lane: `lane-01-oss-donor-census`
Status: decision research, not dependency installation

## Executive summary

UtilityOS should **not** reimplement every parser/codec from scratch, but it also should not become a dependency museum. This census found **123 distinct package/repository candidates**, including **55 deep assessments** across every required capability family. The resulting posture is deliberately conservative: **3 `ADOPT`, 28 `SPIKE`, 86 `REFERENCE_ONLY`, 6 `AVOID`**.

The strongest near-term pattern is:

1. keep browser-native primitives for URL handling, UTF-8, UUIDs, basic hashing, locale/time formatting, basic image decode/encode and IndexedDB where raw APIs remain simple;
2. spike a small set of mature parsing/security/math/file libraries where edge cases are expensive to reproduce correctly;
3. isolate heavy PDF/image/archive runtimes behind lazy workers rather than letting them leak into the shell;
4. use mature utility applications as architecture/UX/oracle donors, not as code-copy sources;
5. treat sanitizer, PDF, archive and file-signature dependencies as continuously patched security surfaces, not “install once” components.

The full machine-readable matrix is `research/lanes/06-oss-donor-matrix.csv`. Raw npm/GitHub/advisory evidence is under `research/lanes/06-oss-donor-evidence/`.

## Method and evidence discipline

Primary evidence came from the npm registry, GitHub repository metadata/tree inspection, GitHub Advisory Database package queries, and first-party project documentation/release/license pages. The census intentionally records `unknown`, `not verified`, or conditional compatibility where a package does not expose a fact directly.

Important limits:

- npm `dist.unpackedSize` is used only as an **approximate package-footprint signal**; it is not minified+gzip bundle size.
- dependency burden is exact only for packages with zero direct dependencies; otherwise the matrix reports direct runtime dependencies as a conservative proxy and explicitly does **not** pretend the full transitive closure was measured.
- GitHub Advisory Database hits are recorded as evidence that advisories exist in the package history; the matrix does **not** assume each advisory affects the latest version without version-range evaluation.
- browser/worker/SSR compatibility is marked conditional whenever it depends on DOM, canvas, worker asset routing, WASM loading, or bundler entry selection.

## Native Web Platform first

Prefer no dependency for these UtilityOS primitives unless acceptance tests demonstrate a real gap:

| UtilityOS need | Prefer | Why |
|---|---|---|
| URL parse/build, UTM/query editing | `URL`, `URLSearchParams` | Native, standards-based, no dependency/security surface. |
| Base64 for byte/text helpers | `Uint8Array`, `TextEncoder`, `TextDecoder`, narrowly-scoped helpers | Avoid Buffer polyfills in browser-only tools. |
| UUID v4 | `crypto.randomUUID()` | Native secure generator. |
| Basic non-streaming SHA digests | Web Crypto `subtle.digest` | Native and trusted; dependency only for incremental/very-large-file hashing. |
| Timezone/locale formatting | `Intl` | Native timezone database exposure and locale formatting. |
| Modern date/time model | `Temporal` when supported | Standards path; polyfill only if browser floor requires it. |
| Simple image decode/resize/encode | `createImageBitmap`, Canvas/OffscreenCanvas where supported | Keep common transforms dependency-light; bring codecs only for measured quality/format gaps. |
| Small local persistence | IndexedDB directly | Add `idb` only when repeated transaction boilerplate is proven. |
| File reads/streaming | Blob/File/Streams APIs | Native and compatible with privacy-first local execution. |
| Simple list/set operations | JS `Set`, arrays, sort/map/filter | Tiny local code is clearer than utility-package imports. |

Native-first explicitly means **do not add `qs` just to edit query strings**, do not add Moment/Day.js just to format dates, and do not add a general-purpose image/PDF engine to tools that can be satisfied by browser APIs.

## Dependency shortlist worth a focused spike (20)

These are not blanket approvals. Each must pass the UtilityOS public-seam corpus, bundle delta, browser/mobile matrix, privacy checks and cancellation/worker requirements appropriate to its class.

- **`papaparse` — SPIKE.** Browser-first CSV parser with local-file, streaming and worker support; benchmark adversarial CSV and historical ReDoS cases. Primary: https://github.com/mholt/PapaParse ; package: https://www.npmjs.com/package/papaparse
- **`yaml` — SPIKE.** Current stable 2.x, zero direct deps, browser mapping and bundled types; spike alias/recursion limits and hostile fixtures. Primary: https://github.com/eemeli/yaml ; package: https://www.npmjs.com/package/yaml
- **`marked` — SPIKE.** Fast Markdown parser but output is not sanitized; use only with a patched sanitizer and XSS corpus. Primary: https://github.com/markedjs/marked ; package: https://www.npmjs.com/package/marked
- **`markdown-it` — SPIKE.** Mature parser alternative; still requires sanitizer for untrusted HTML. Primary: https://github.com/markdown-it/markdown-it ; package: https://www.npmjs.com/package/markdown-it
- **`dompurify` — SPIKE.** Purpose-built browser sanitizer; security-sensitive and requires rapid patch SLA plus strict configuration tests. Primary: https://github.com/cure53/DOMPurify ; package: https://www.npmjs.com/package/dompurify
- **`date-fns` — SPIKE.** Actively maintained and modular; spike only for operations not cleanly covered by Temporal/Intl. Primary: https://github.com/date-fns/date-fns ; package: https://www.npmjs.com/package/date-fns
- **`@js-temporal/polyfill` — SPIKE.** Standards-aligned bridge only if supported-browser testing shows Temporal gaps. Primary: https://github.com/js-temporal/temporal-polyfill ; package: https://www.npmjs.com/package/@js-temporal/polyfill
- **`big.js` — SPIKE.** Smaller exact-decimal alternative; compare against decimal.js if feature needs stay narrow. Primary: https://github.com/MikeMcl/big.js ; package: https://www.npmjs.com/package/big.js
- **`@noble/hashes` — SPIKE.** Modern TS/ESM zero-dependency hashes; strong candidate for incremental hashing beyond Web Crypto digest. Primary: https://github.com/paulmillr/noble-hashes ; package: https://www.npmjs.com/package/@noble/hashes
- **`hash-wasm` — SPIKE.** WASM hashing may win on large files; lazy-load and benchmark startup/memory against noble/Web Crypto. Primary: https://github.com/Daninet/hash-wasm ; package: https://www.npmjs.com/package/hash-wasm
- **`qrcode` — SPIKE.** Focused MIT QR generation with browser support; spike determinism, ECC coverage and bundle cost. Primary: https://github.com/soldair/node-qrcode ; package: https://www.npmjs.com/package/qrcode
- **`pica` — SPIKE.** Current quality-focused browser resize engine; strong candidate for downscale/resize. Primary: https://github.com/nodeca/pica ; package: https://www.npmjs.com/package/pica
- **`exifr` — SPIKE.** Zero-dependency EXIF parser; viable if metadata corpus passes despite slower release cadence. Primary: https://github.com/MikeKovarik/exifr ; package: https://www.npmjs.com/package/exifr
- **`pdf-lib` — SPIKE.** Browser-capable PDF mutation API, but old release and large package require a bounded mutation-only spike. Primary: https://github.com/Hopding/pdf-lib ; package: https://www.npmjs.com/package/pdf-lib
- **`pdfjs-dist` — SPIKE.** Current Mozilla PDF.js is the browser render/extract baseline; heavy and must stay lazy/worker-isolated. Primary: https://github.com/mozilla/pdf.js ; package: https://www.npmjs.com/package/pdfjs-dist
- **`fflate` — SPIKE.** Current zero-dependency archive/compression primitive; strong ZIP candidate after zip-bomb and cancellation tests. Primary: https://github.com/101arrowz/fflate ; package: https://www.npmjs.com/package/fflate
- **`file-type` — SPIKE.** Current magic-byte detector; spike browser entry and supported-signature corpus rather than trusting extensions. Primary: https://github.com/sindresorhus/file-type ; package: https://www.npmjs.com/package/file-type
- **`@citation-js/core` — SPIKE.** Current modular citation pipeline; strong base if plugins remain lazy and round-trip tests pass. Primary: https://github.com/citation-js/citation-js ; package: https://www.npmjs.com/package/@citation-js/core
- **`fuse.js` — SPIKE.** Current zero-dependency fuzzy matcher; good candidate when exact/native search is insufficient. Primary: https://github.com/krisk/Fuse ; package: https://www.npmjs.com/package/fuse.js
- **`idb` — ADOPT.** Tiny typed wrapper over native IndexedDB; appropriate only when raw IndexedDB becomes repetitive. Primary: https://github.com/jakearchibald/idb ; package: https://www.npmjs.com/package/idb

Three candidates are already strong enough for an implementation default **once their normal UtilityOS acceptance tests pass**: `diff` for text diff, `decimal.js` for exact business arithmetic, and `idb` when a wrapper is actually justified. They still remain subject to lockfile/license/bundle gates.

## Mature applications/repos worth studying, not depending on

- **gchq/CyberChef** — Apache-2.0; Operation registry, local execution, recipe/pipeline composition and tool modularity. https://github.com/gchq/CyberChef
- **CorentinTh/it-tools** — GPL-3.0; Utility discovery UX and client-side tool composition; study patterns, not source copying. https://github.com/CorentinTh/it-tools
- **GoogleChromeLabs/squoosh** — Apache-2.0; Worker/WASM image codecs, local-first compression and before/after UX. https://github.com/GoogleChromeLabs/squoosh
- **goodtab/bentopdf** — NOASSERTION; current repo LICENSE observed as Apache-2.0; Client-side PDF composition; BentoPDF fork/license lineage is inconsistent, so architecture only. https://github.com/goodtab/bentopdf
- **Stirling-Tools/Stirling-PDF** — Mixed/open-core; root MIT with separately licensed directories; PDF workflow breadth, tool decomposition and license-inventory patterns; path-level license diligence required. https://github.com/Stirling-Tools/Stirling-PDF
- **DevToys-app/DevToys** — MIT; Utility taxonomy, search/command UX and modular tool boundaries; desktop stack is reference only. https://github.com/DevToys-app/DevToys
- **microsoft/PowerToys** — MIT; Mature utility-suite governance, discovery and per-tool lifecycle patterns. https://github.com/microsoft/PowerToys
- **ArtifexSoftware/mupdf** — AGPL-3.0; High-quality PDF engine reference; AGPL/commercial licensing plus native/WASM complexity make casual dependency use inappropriate. https://github.com/ArtifexSoftware/mupdf
- **qpdf/qpdf** — Apache-2.0; Robust PDF structural manipulation/validation algorithms; native C++ makes it an oracle/reference unless a deliberate WASM port is approved. https://github.com/qpdf/qpdf
- **zotero/zotero** — NOASSERTION in GitHub API; verify path-specific license; Citation data model, CSL integration and dedupe workflows; application-scale reference only. https://github.com/zotero/zotero

The most reusable architectural lessons are:

- **CyberChef:** operation registry, composable transformation pipeline, clear local-execution model.
- **IT-Tools:** discoverability and consistent micro-tool UX; GPL-3.0 means pattern study rather than source reuse.
- **Squoosh:** worker/WASM lazy loading, progress phases, local-only image processing and before/after inspection.
- **BentoPDF/Stirling PDF:** PDF tool decomposition and UX breadth, but their current license/fork structures require path-level diligence; do not treat either repository as a permissive source bucket.
- **qpdf/MuPDF:** excellent behavioral/oracle references for PDF correctness; native/AGPL constraints make them poor casual browser dependencies.
- **Zotero:** citation model and dedupe/workflow reference rather than an embeddable UtilityOS module.

## DO NOT USE / avoid as current UtilityOS core dependencies

- **`xlsx` 0.18.5** — package published 2022-03-24, ~7.3 MiB unpacked, seven direct deps and multiple advisory-database hits. Spreadsheet support is outside the Wave A CSV tracer; do not pull this in “just in case.”
- **`@iarna/toml` 2.2.5** — npm release from 2020 with stale modern-package signals. Prefer a current TOML candidate only when TOML enters an approved wave.
- **`qs`** — capable and current, but UtilityOS Wave A query editing is covered by native `URLSearchParams`; avoid unnecessary historical security and dependency surface.
- **`@dinero.js/core` 2.0.0-alpha.1** — alpha subpackage is not an appropriate v1 arithmetic foundation. If a domain money model becomes necessary, reassess the stable top-level package separately.
- **`citeproc`** — package license reports `CPAL-1.0 OR AGPL-1.0`; do not make it a proprietary-product dependency without explicit legal review.
- **MuPDF (`ArtifexSoftware/mupdf`)** — AGPL-3.0/commercial dual path plus native/WASM complexity. Use as PDF behavior/reference evidence unless a separately approved license/architecture decision is made.
- **Moment.js for new work** — census-only reference; UtilityOS should use Temporal/Intl plus focused helpers rather than adopting a legacy-style all-purpose date library.
- **Full utility-suite source copying** from IT-Tools/BentoPDF/Stirling/CyberChef — even where licenses permit reuse, the product should copy **patterns, test ideas and algorithms only when license-compatible and independently integrated**, not wholesale application structure.

## Family conclusions

### CSV / tabular

`papaparse` and `csv-parse` deserve a head-to-head adversarial corpus. Papa Parse is more browser-oriented and documents worker execution; `csv-parse` is actively maintained and zero-direct-dependency but needs browser-entry/bundle verification. `d3-dsv` is a useful small oracle for simple cases. Do not bring SheetJS into a CSV-only tracer.

Acceptance corpus must include quoted newlines, embedded delimiters, BOM, CRLF/LF, empty trailing cells, malformed quotes, unusual/duplicate headers, UTF-8 accents, large streaming files and cancellation.

### JSON / YAML / TOML

JSON formatting/validation should remain native JSON plus UtilityOS diagnostics. `yaml` 2.9.1 is the leading YAML spike. TOML is not a reason to add a stale parser now; `smol-toml` is promising but its repository provenance was not exposed by the npm metadata captured in this run, so it needs one more primary-source provenance check before adoption.

### Markdown / sanitization

Parsing and sanitization are separate trust boundaries. `marked` or `markdown-it` can parse; **DOMPurify must be treated as a patched security dependency**, not as a reason to enable arbitrary raw HTML. The GitHub advisory query returned many historical/non-withdrawn advisories for both Markdown/sanitizer packages, so version pinning plus an XSS regression corpus is mandatory.

### Diff / text

`diff` (jsdiff) is the cleanest direct adoption candidate: current, zero runtime deps, ESM signals, tests/CI. Small list/set transforms remain local code. `diff-match-patch` is better as an algorithm/reference than a fresh dependency.

### URL / query / UTM

Use native `URL`/`URLSearchParams`. `query-string` is a reference for edge semantics only. This is a clear case where the Web Platform beats a dependency.

### Date / time / business days

Use `Temporal`/`Intl` wherever the browser floor allows. Spike `@js-temporal/polyfill` only as a compatibility bridge and `date-fns` only for reusable arithmetic that remains awkward after Temporal. `rrule` is Wave B recurrence scope, not a Wave A requirement.

### Business math

Use explicit exact-decimal arithmetic for money/rates rather than binary floating-point shortcuts. `decimal.js` is the primary choice; `big.js` is the smaller comparison candidate. Keep domain formulas in UtilityOS code with independent oracle fixtures rather than hiding business logic in a finance framework.

### Hashing / checksum / encoding

Web Crypto handles normal one-shot cryptographic digest jobs. `@noble/hashes` and `hash-wasm` are justified only for incremental/streaming or very-large-file hashing. Benchmark worker startup, peak memory and throughput before choosing JS vs WASM.

### QR / barcode

`qrcode` is the compact generator spike. `@zxing/browser` is the reader/camera spike. Do not pull `bwip-js` into QR-only Wave A: its broad barcode surface produces a much larger package footprint.

### Image / EXIF

Native image APIs remain the baseline. `pica` is the strongest resize-quality spike; `compressorjs` is a smaller compression comparator. `exifr` and `ExifReader` should be tested against a real metadata corpus, including malformed images and privacy-removal validation. Squoosh should inform worker/WASM architecture rather than become a copied app.

### PDF

There is no single universal PDF dependency. Split the capability:

- **render/extract:** `pdfjs-dist` / Mozilla PDF.js, lazy + worker isolated;
- **mutation:** `pdf-lib` only after malformed/large-file corpus despite its old release cadence;
- **structural/oracle reference:** qpdf;
- **AGPL/native reference:** MuPDF, not casual dependency;
- **generation:** jsPDF is reference-only unless generation becomes an approved primary need.

### ZIP / archive

`fflate` is the compact primitive candidate; `zip.js` is the browser-stream/worker candidate. Any archive adoption is gated by zip-bomb expansion bounds, entry-count/size limits, filename/path normalization, progress and cancellation.

### MIME / signature

Use signature detection, not extensions, for security-relevant file classification. `file-type` deserves a browser-corpus spike. `mrmime` is only extension-to-MIME mapping and must not be mistaken for a safety check.

### Citation / research

Citation.js (`@citation-js/core` plus targeted plugins) is the best modular spike for BibTeX/RIS-style work. `citeproc` is a licensing reject for direct use in the current product posture. DOI/ISBN normalization/validation should remain tiny local standards-based implementations where possible.

### Local search / IndexedDB / OPFS

`fuse.js` is appropriate for fuzzy matching; `minisearch` is the stronger full-text index candidate. Do not add both until the UX requires both semantics. `idb` is acceptable as a thin IndexedDB wrapper when raw IndexedDB becomes repetitive; Dexie is broader than v1 needs. OPFS should stay native/feature-detected rather than hidden behind a large abstraction until a real file-workspace use case appears.

## Deep candidate table (55 rows)

This compact table shows release/license/maintenance/footprint/security signals. Browser, ESM, tests, TypeScript, worker, SSR/static, capability mapping and full rationale remain in the CSV.

| Family | Candidate | Release | License | Maintenance | Footprint | Dependency burden | Security signal | Verdict |
|---|---|---|---|---|---:|---|---|---|
| CSV/tabular | `papaparse` | 5.7.0 / 2026-08-24 | MIT | ACTIVE — pushed 2026-09-15 | 264.3 KiB | LOW | 1 non-withdrawn GHSA hits (GHSA-qvjc-g5vr-mfgr); 1 withdrawn; latest-version applicab... | **SPIKE** |
| CSV/tabular | `csv-parse` | 7.0.2 / 2026-08-02 | MIT | ACTIVE — pushed 2026-09-23 | 1569.3 KiB | LOW | 2 non-withdrawn GHSA hits (GHSA-8cw4-87c7-c6xx,GHSA-582f-p4pg-xc74); 0 withdrawn; lat... | **SPIKE** |
| CSV/tabular | `d3-dsv` | 3.0.1 / 2021-06-05 | ISC | QUIET — pushed 2024-01-05 | 50.0 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| CSV/tabular | `arquero` | 8.0.3 / 2025-05-29 | BSD-3-Clause | QUIET — pushed 2025-05-29 | 2663.7 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| CSV/tabular | `xlsx` | 0.18.5 / 2022-03-24 | Apache-2.0 | QUIET — pushed 2024-04-18 | 7323.3 KiB | HIGH | 5 non-withdrawn GHSA hits (GHSA-5pgg-2g8v-p4x9,GHSA-4r6h-8v6p-xvw6,GHSA-3x9f-74h4-2fq... | **AVOID** |
| JSON/YAML/TOML | `yaml` | 2.9.1 / 2026-09-11 | ISC | ACTIVE — pushed 2026-09-23 | 670.2 KiB | LOW | 2 non-withdrawn GHSA hits (GHSA-48c2-rrv3-qjmp,GHSA-f9xv-q969-pqx4); 0 withdrawn; lat... | **SPIKE** |
| JSON/YAML/TOML | `js-yaml` | 5.4.2 / 2026-09-13 | MIT | ACTIVE — pushed 2026-09-13 | 1534.5 KiB | MEDIUM | 11 non-withdrawn GHSA hits (GHSA-2883-xcg3-v3hh,GHSA-5p4m-2wfm-xmqj,GHSA-pm4m-ph32-gh... | **REFERENCE_ONLY** |
| JSON/YAML/TOML | `@iarna/toml` | 2.2.5 / 2020-04-22 | ISC | QUIET — pushed 2024-05-30 | 96.7 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **AVOID** |
| JSON/YAML/TOML | `smol-toml` | 1.9.0 / 2026-09-22 | BSD-3-Clause | PACKAGE ACTIVE — released 2026-09-22; repo activity unresolved | 136.7 KiB | LOW | 3 non-withdrawn GHSA hits (GHSA-7w5x-hrqm-74c2,GHSA-v3rj-xjv7-4jmq,GHSA-pqhp-25j4-6hq... | **SPIKE** |
| Markdown/sanitization | `marked` | 18.0.14 / 2026-09-22 | MIT | ACTIVE — pushed 2026-09-22 | 492.7 KiB | LOW | 13 non-withdrawn GHSA hits (GHSA-6v9c-7cg6-27q7,GHSA-p9wx-2529-fp83,GHSA-5v2h-r2cx-5x... | **SPIKE** |
| Markdown/sanitization | `markdown-it` | 15.0.2 / 2026-09-11 | MIT | ACTIVE — pushed 2026-09-12 | 1922.7 KiB | HIGH | 4 non-withdrawn GHSA hits (GHSA-6v5v-wf23-fmfq,GHSA-38c4-r59v-3vqw,GHSA-j5p7-jf4q-742... | **SPIKE** |
| Markdown/sanitization | `unified` | 11.0.5 / 2024-06-19 | MIT | MAINTAINED — pushed 2026-04-29 | 142.5 KiB | HIGH | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| Markdown/sanitization | `micromark` | 4.0.2 / 2025-02-27 | MIT | ACTIVE — pushed 2026-09-11 | 204.7 KiB | HIGH | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| Markdown/sanitization | `dompurify` | 3.4.16 / 2026-09-23 | (MPL-2.0 OR Apache-2.0) | ACTIVE — pushed 2026-09-23 | 1550.4 KiB | LOW | 20 non-withdrawn GHSA hits (GHSA-55q2-fjhq-7xh7,GHSA-c2j3-45gr-mqc4,GHSA-cmwh-pvxp-88... | **SPIKE** |
| diff/list/text | `diff` | 9.0.0 / 2026-04-13 | BSD-3-Clause | ACTIVE — pushed 2026-09-19 | 601.2 KiB | LOW | 2 non-withdrawn GHSA hits (GHSA-73rr-hh4g-fpgx,GHSA-h6ch-v84p-w6p9); 0 withdrawn; lat... | **ADOPT** |
| diff/list/text | `diff-match-patch` | 1.0.5 / 2020-05-20 | Apache-2.0 | QUIET — pushed 2023-05-18 | 95.2 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| URL/query/UTM | `qs` | 6.16.0 / 2026-08-29 | BSD-3-Clause | ACTIVE — pushed 2026-09-12 | 366.1 KiB | MEDIUM | 9 non-withdrawn GHSA hits (GHSA-x5fp-wj9c-mxmx,GHSA-4mjr-xmp4-gh2g,GHSA-q8mj-m7cp-5q2... | **AVOID** |
| URL/query/UTM | `query-string` | 9.5.1 / 2026-09-01 | MIT | ACTIVE — pushed 2026-09-01 | 57.9 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| date/time | `date-fns` | 4.4.0 / 2026-05-29 | MIT | ACTIVE — pushed 2026-09-22 | 10646.6 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| date/time | `dayjs` | 1.11.23 / 2026-08-17 | MIT | ACTIVE — pushed 2026-09-15 | 665.7 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| date/time | `luxon` | 3.7.2 / 2025-09-05 | MIT | ACTIVE — pushed 2026-08-09 | 4485.1 KiB | LOW | 1 non-withdrawn GHSA hits (GHSA-3xq5-wjfh-ppjc); 0 withdrawn; latest-version applicab... | **REFERENCE_ONLY** |
| date/time | `@js-temporal/polyfill` | 0.5.1 / 2025-03-31 | ISC | ACTIVE — pushed 2026-09-22 | 2911.8 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| date/time | `rrule` | 2.8.1 / 2023-11-10 | BSD-3-Clause | QUIET — pushed 2024-06-27 | 671.1 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| business math | `decimal.js` | 10.6.0 / 2025-07-06 | MIT | ACTIVE — pushed 2026-08-30 | 277.7 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **ADOPT** |
| business math | `big.js` | 7.0.1 / 2025-04-21 | MIT | QUIET — pushed 2025-04-22 | 57.6 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| business math | `currency.js` | 2.0.4 / 2021-05-19 | MIT | ACTIVE — pushed 2026-09-19 | 35.4 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| business math | `@dinero.js/core` | 2.0.0-alpha.1 / 2021-07-12 | MIT | ACTIVE — pushed 2026-09-22 | 269.2 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **AVOID** |
| hashing/encoding | `@noble/hashes` | 2.4.0 / 2026-08-27 | MIT | ACTIVE — pushed 2026-09-08 | 675.4 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| hashing/encoding | `hash-wasm` | 4.12.0 / 2024-11-19 | MIT | QUIET — pushed 2024-11-19 | 1757.8 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| QR/barcode | `qrcode` | 1.5.4 / 2024-08-05 | MIT | QUIET — pushed 2024-08-23 | 132.2 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| QR/barcode | `bwip-js` | 4.11.4 / 2026-08-19 | MIT | ACTIVE — pushed 2026-08-19 | 12621.3 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| QR/barcode | `@zxing/browser` | 0.2.1 / 2026-07-06 | MIT | ACTIVE — pushed 2026-07-06 | 5665.0 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| QR/barcode | `jsqr` | 1.4.0 / 2021-04-24 | Apache-2.0 | MAINTAINED — pushed 2026-05-15 | 273.2 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| image | `browser-image-compression` | 2.0.2 / 2023-03-06 | MIT | QUIET — pushed 2024-03-08 | 842.7 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| image | `pica` | 10.0.3 / 2026-08-15 | MIT | ACTIVE — pushed 2026-08-15 | 1220.9 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| image | `compressorjs` | 1.3.0 / 2026-04-06 | MIT | ACTIVE — pushed 2026-09-13 | 157.6 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| image | `exifr` | 7.1.3 / 2021-08-05 | MIT | QUIET — pushed 2024-03-29 | 1261.2 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| image | `exifreader` | 4.45.2 / 2026-09-21 | MPL-2.0 | ACTIVE — pushed 2026-09-21 | 1183.6 KiB | LOW | 4 non-withdrawn GHSA hits (GHSA-pj96-35fp-cfcc,GHSA-g77h-45rf-hcx4,GHSA-h64w-w9pr-82m... | **SPIKE** |
| PDF | `pdf-lib` | 1.17.1 / 2021-11-06 | MIT | QUIET — pushed 2024-07-17 | 19005.0 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| PDF | `pdfjs-dist` | 6.3.289 / 2026-08-29 | Apache-2.0 | ACTIVE — pushed 2026-09-22 | 33965.9 KiB | LOW | 3 non-withdrawn GHSA hits (GHSA-hq66-cqwq-w95j,GHSA-wgrm-67xf-hhpq,GHSA-7jg2-jgv3-fmr... | **SPIKE** |
| PDF | `jspdf` | 4.2.1 / 2026-03-17 | MIT | ACTIVE — pushed 2026-09-23 | 29484.4 KiB | MEDIUM | 15 non-withdrawn GHSA hits (GHSA-wfv2-pwc8-crg5,GHSA-7x6v-j9x4-qf24,GHSA-p5xg-68wr-hm... | **REFERENCE_ONLY** |
| ZIP/archive | `fflate` | 0.8.3 / 2026-05-16 | MIT | MAINTAINED — pushed 2026-05-16 | 778.1 KiB | LOW | 1 non-withdrawn GHSA hits (GHSA-px8p-9vwx-vf98); 0 withdrawn; latest-version applicab... | **SPIKE** |
| ZIP/archive | `jszip` | 3.10.2 / 2026-09-08 | (MIT OR GPL-3.0-or-later) | ACTIVE — pushed 2026-09-09 | 676.8 KiB | MEDIUM | 2 non-withdrawn GHSA hits (GHSA-36fh-84j7-cv5h,GHSA-jg8v-48h5-wgxg); 0 withdrawn; lat... | **REFERENCE_ONLY** |
| ZIP/archive | `pako` | 3.0.2 / 2026-09-12 | (MIT AND Zlib) | ACTIVE — pushed 2026-09-12 | 2428.4 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| ZIP/archive | `@zip.js/zip.js` | 2.17.0 / 2026-09-21 | BSD-3-Clause | ACTIVE — pushed 2026-09-21 | 8262.0 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| MIME/signature | `file-type` | 22.1.1 / 2026-09-17 | MIT | ACTIVE — pushed 2026-09-17 | 135.6 KiB | MEDIUM | 3 non-withdrawn GHSA hits (GHSA-j47w-4g3g-c36v,GHSA-5v7r-6r5c-r473,GHSA-mhxj-85r3-2x5... | **SPIKE** |
| MIME/signature | `mrmime` | 2.0.1 / 2025-02-17 | MIT | QUIET — pushed 2025-02-17 | 32.2 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| citation | `@citation-js/core` | 0.9.0 / 2026-09-18 | MIT | ACTIVE — pushed 2026-09-18 | 156.3 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| citation | `@citation-js/plugin-bibtex` | 0.9.0 / 2026-09-18 | MIT | ACTIVE — pushed 2026-09-18 | 200.7 KiB | MEDIUM | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| citation | `citeproc` | 2.4.63 / 2023-04-17 | CPAL-1.0 OR AGPL-1.0 | ACTIVE — pushed 2026-07-05 | 952.8 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **AVOID** |
| local search | `fuse.js` | 7.5.0 / 2026-07-13 | Apache-2.0 | ACTIVE — pushed 2026-08-09 | 407.4 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| local search | `minisearch` | 7.2.0 / 2025-09-16 | MIT | QUIET — pushed 2025-09-16 | 807.1 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **SPIKE** |
| local search | `flexsearch` | 0.8.212 / 2025-09-06 | Apache-2.0 | ACTIVE — pushed 2026-06-28 | 2280.0 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **REFERENCE_ONLY** |
| IndexedDB/OPFS | `idb` | 8.0.3 / 2025-05-07 | ISC | QUIET — pushed 2025-05-07 | 80.8 KiB | LOW | No GitHub Advisory Database hits returned for npm package query | **ADOPT** |
| IndexedDB/OPFS | `dexie` | 4.4.6 / 2026-09-10 | Apache-2.0 | ACTIVE — pushed 2026-09-10 | 3159.2 KiB | LOW | 1 non-withdrawn GHSA hits (GHSA-3xgx-r9j4-qw9w); 0 withdrawn; latest-version applicab... | **REFERENCE_ONLY** |

## Security and supply-chain conclusions

1. **Historical advisory count is not the same as “latest version vulnerable.”** Before pinning a dependency, CI must evaluate advisory affected ranges against the chosen version.
2. **DOMPurify is an active security component.** The first-party GitHub security page shows multiple 2026 advisories. If adopted, patch latency should be treated as a product security SLO.
3. **Archive/PDF/image inputs are hostile-input surfaces.** Size limits, decompression bounds, malformed corpus tests, cancellation and worker termination are mandatory.
4. **Zero direct dependencies is meaningful.** For `diff`, `decimal.js`, `@noble/hashes`, `fflate`, `idb` and several other candidates, transitive package burden is genuinely zero at the npm package layer.
5. **Mixed and copyleft application licenses matter even for “open source.”** Stirling PDF has separately licensed directories; IT-Tools is GPL-3.0; MuPDF is AGPL-3.0; BentoPDF currently has multiple repo/fork/license presentations. Study these repos, but do not import source without path-specific provenance.

## Primary / official source index

The following first-party sources were used or cross-checked in this lane (well above the required 20):

- https://www.papaparse.com/docs
- https://github.com/mholt/PapaParse
- https://github.com/adaltas/node-csv
- https://github.com/eemeli/yaml/releases
- https://github.com/nodeca/js-yaml
- https://marked.js.org/
- https://github.com/markdown-it/markdown-it
- https://github.com/cure53/DOMPurify
- https://github.com/cure53/DOMPurify/security/advisories
- https://github.com/kpdecker/jsdiff
- https://github.com/date-fns/date-fns
- https://github.com/js-temporal/temporal-polyfill
- https://github.com/MikeMcl/decimal.js
- https://github.com/paulmillr/noble-hashes
- https://github.com/Daninet/hash-wasm
- https://github.com/soldair/node-qrcode
- https://github.com/nodeca/pica
- https://github.com/MikeKovarik/exifr
- https://github.com/Hopding/pdf-lib
- https://github.com/mozilla/pdf.js
- https://github.com/101arrowz/fflate
- https://github.com/gildas-lormeau/zip.js
- https://github.com/sindresorhus/file-type
- https://github.com/citation-js/citation-js
- https://github.com/krisk/Fuse
- https://github.com/lucaong/minisearch
- https://github.com/jakearchibald/idb
- https://github.com/gchq/CyberChef
- https://github.com/CorentinTh/it-tools
- https://github.com/GoogleChromeLabs/squoosh
- https://github.com/goodtab/bentopdf
- https://github.com/Stirling-Tools/Stirling-PDF
- https://github.com/qpdf/qpdf
- https://github.com/zotero/zotero

## Verification against lane contract

- Census rows: **123** (required >=80) — PASS.
- Deep rows: **55** (required >=30) — PASS.
- Every deep row has license, maintenance, browser assessment, security field and adoption verdict in the CSV — validated by script/check below.
- Official/primary links: **>20** in this report, plus canonical URLs and npm license sources in the CSV — PASS.
- No invented metadata: unknown/proxy fields are labeled, and advisory applicability is not overclaimed.
- Native-platform preference is explicit by capability family.
- No dependency was installed and no source was copied from donor repositories.

## Integration recommendation

The next engineering step should not be “install the shortlist.” Create focused dependency spikes around the actual Wave A seams:

1. CSV: Papa Parse vs csv-parse adversarial/streaming benchmark.
2. YAML: `yaml` hostile-input and bundle check.
3. Markdown: parser choice + DOMPurify pinned-XSS corpus.
4. Diff: adopt `diff` behind the shared text engine and prove bundle delta.
5. Business math: adopt `decimal.js` behind explicit UtilityOS formulas/oracles.
6. Hashing: Web Crypto baseline vs noble/hash-wasm for incremental large files.
7. QR: `qrcode` generation corpus.
8. Image: native baseline vs pica/compressorjs.
9. PDF: separate `pdfjs-dist` render/extract spike from `pdf-lib` mutation spike.
10. Archive: fflate vs zip.js with hostile archive limits.
11. File type: `file-type` browser signature corpus.
12. Citation: Citation.js core + BibTeX/RIS plugin fidelity tests.
13. Search/persistence: Fuse/Minisearch only if UX needs them; `idb` only after persistence boilerplate proves itself.
