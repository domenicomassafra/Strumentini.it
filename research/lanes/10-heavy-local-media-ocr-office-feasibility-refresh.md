# Lane 10 — Heavy local media/OCR/Office feasibility refresh

**Date:** 2026-10-05  
**Ticket:** expansion #34  
**Status:** evidence tranche complete; **0 production promotions**

## Decision

The 2026 refresh supports continuing targeted spikes for HEIC, Italian OCR, semantic DOCX, bounded DOCX generation/preview, advanced PDF mutation/rendering, media inspection, and browser-native DSP/WebCodecs paths. It does **not** justify moving a new heavy dependency into production yet.

That boundary is deliberate. The real-file desktop corpus is green in the engines available on this machine, and all browser network traffic stayed local, but genuine iOS Safari and Android Chrome receipts are absent. The JS-heap measurements also exclude WASM/native/process memory, and several operations still need a worker-owned cancellation contract. Ticket 34 is therefore a measured shortlist for tickets 100/101/206 and 268–274, not an implementation shortcut around them.

Two candidate branches are already blocked by harder evidence:

- `xlsx@0.18.5` is **DENY**. The exact npm package has high-severity prototype-pollution and ReDoS advisories, and npm reports no available fix for this package line.
- `pptxgenjs@4.0.1` is **DENY**. Its installed graph pulls `image-size` with two high-severity infinite-loop DoS advisories.

The current official `@ffmpeg/core@0.12.10` artifact is also **DENY** under the repository dependency policy because npm declares it `GPL-2.0-or-later`. `@ffmpeg/ffmpeg` by itself is only the controller and therefore does not create a viable production path without an acceptable core.

## Test environment and method

The spike lives at `spikes/heavy-local-feasibility/`. The full receipt sequence is:

```bash
cd spikes/heavy-local-feasibility
npm ci
npm run bench
```

The observed host used Node 26.6.0, Vite 8.3.0, system Google Chrome 154.0.8037.97, and system Microsoft Edge 154.0.4258.53. The harness also ran Playwright Chromium, Firefox, and WebKit. WebKit is labeled `desktop-regression-not-safari` in the receipt and is never used as physical Safari proof.

The corpus contains actual binary HEIC, PNG, XLSX, DOCX, PPTX, PDF, WAV, and MP4 files. The browser performs the real parse/decode/render/write/inspect operation and verifies a marker from the result. Every context blocks non-loopback traffic before transmission. The final run recorded **13/13 passing cases in every one of the five desktop engines** and **0 external requests**.

Tesseract prints `failed to load ./ita.special-words` on stderr while the Italian traineddata path still recognizes the expected invoice markers successfully. The receipt preserves that console message; it is another reason the OCR path remains a spike instead of being promoted from a happy-path recognition result.

## Measured candidate matrix

Sizes below are gzip measurements from the Vite production build unless the asset is already compressed. Runtime and JS-heap figures are the representative system-Chrome run from the recorded receipt and are rounded for readability. The JSON matrix retains exact values.

| Candidate | Surface measured | Lazy gzip | Cold load | Operation | Peak JS heap delta | Security/license | Decision |
|---|---|---:|---:|---:|---:|---|---|
| `libheif-js@1.23.5` | real HEIC decode to RGBA | ~715 KB | ~117 ms | ~35 ms | ~4.2 MB | LGPL-3.0 packaging review | **SPIKE** |
| `tesseract.js@7.0.0` core path | Italian OCR worker + selected local core | ~1.50 MB | ~38 ms | ~418 ms | ~11.2 MB | Apache-2.0; audit clean | **SPIKE** |
| `@tesseract.js-data/ita@1.0.0` | Italian traineddata | ~6.91 MB already-compressed asset | shared | shared | shared | MIT | **SPIKE** |
| `xlsx@0.18.5` | XLSX parse + write | ~139 KB | ~109 ms | ~11 ms | ~2.1 MB | **2 high advisories; no npm fix** | **DENY** |
| `mammoth@1.13.0` | DOCX semantic text extraction | ~87 KB | ~70 ms | ~92 ms | ~13.3 MB | BSD-2-Clause; audit clean | **SPIKE** |
| `docx@9.8.1` | DOCX browser generation | ~125 KB | ~84 ms | ~146 ms | ~22.7 MB | MIT; audit clean | **SPIKE** |
| `docx-preview@0.4.1` | DOCX browser preview | ~49 KB | ~46 ms | ~91 ms | ~12.2 MB | Apache-2.0; audit clean | **SPIKE** |
| `pptxgenjs@4.0.1` | PPTX browser generation | ~124 KB | ~95 ms | ~136 ms | ~21.2 MB | **high transitive DoS advisories** | **DENY** |
| `@cantoo/pdf-lib@2.11.1` | PDF load/rotate/save | ~249 KB | ~132 ms | ~6 ms | ~1.4 MB | MIT; audit clean | **SPIKE** |
| `pdfjs-dist@6.4.299` | PDF text + page render | ~602 KB including worker | ~122 ms | ~94 ms | ~8.4 MB | Apache-2.0; audit clean | **SPIKE** |
| `mediabunny@1.61.3` | MP4/WAV inspection; WebCodecs surface | ~174 KB | ~136 ms | ~5 ms | ~0.2 MB | MPL-2.0; audit clean | **SPIKE** |
| `mp4box@2.4.1` | MP4 track/container inspection | ~41 KB | ~105 ms | ~4 ms | ~0.4 MB | BSD-3-Clause; audit clean | **SPIKE** |
| `@ffmpeg/ffmpeg@0.12.15` + `@ffmpeg/core@0.12.10` | WASM transcoding candidate | not executed | — | — | — | core is GPL-2.0-or-later; ~64.7 MB unpacked | **DENY** |
| `lamejs@1.2.1` | MP3 encoder candidate | not executed | — | — | — | stale package; LGPL review | **DENY** |
| `heic2any@0.0.4` | HEIC wrapper candidate | not executed | — | — | — | stale wrapper relative to current libheif substrate | **DENY** |

The initial harness shell itself is about 5.8 KB gzip; heavy candidates are dynamic imports. PDF.js is materially larger than its main chunk looks because its dedicated worker is included in the ~602 KB gzip figure. OCR is larger again: the observed Chrome path loads the Tesseract entry, local worker, one compatible core wrapper, and the 6.93 MB `.traineddata.gz` Italian asset. The spike also keeps the alternative Tesseract core variants locally available so runtime capability selection does not require a CDN.

`performance.memory` is only a JS-heap signal on Chromium. It does not include Tesseract/libheif WASM linear memory, browser-native decoded frames, canvas/GPU allocations, or total process RSS. Firefox/WebKit do not expose an equivalent value to this harness. None of the figures above is therefore a complete peak-memory acceptance measurement.

## Family decisions and fallbacks

### HEIC / HEIF

Prefer native browser image decode when a capability probe proves the exact file can be decoded. `libheif-js@1.23.5` is the fallback **SPIKE** candidate because the real HEIC fixture decodes across all observed desktop engines, but its ~715 KB gzip lazy payload, LGPL packaging review, WASM/native memory, and physical-mobile behavior must be closed before production use.

Fallback boundary: when native decode is unavailable and the local worker/resource gate cannot safely run libheif, return an explicit unsupported/limit state. Do not upload the image as an implicit fallback.

### OCR

The recommended **SPIKE** stack is `tesseract.js@7.0.0` + local `tesseract.js-core` + `@tesseract.js-data/ita@1.0.0`, owned by a terminable worker. The real Italian invoice fixture is recognized in all five desktop engines while every engine/core/language request stays on loopback.

The footprint is the main constraint: the Italian traineddata alone is ~6.93 MB on disk/transfer in this local setup, and the selected worker/core path adds several more megabytes before decoded/WASM memory. Fail capability, pixel-count, file-size, or memory preflight with a clear local error. Searchable-PDF generation remains a separate integration concern.

### Office

There is no single approved Office stack from this tranche. `mammoth` is a useful semantic DOCX extraction **SPIKE**; it explicitly disables external file access by default. `docx` is a bounded DOCX-generation **SPIKE**. `docx-preview` is only a preview **SPIKE** and must not be described as Word-faithful rendering from this evidence.

`xlsx@0.18.5` and `pptxgenjs@4.0.1` are **DENY** on the current security graph. Until ticket 270 produces clean audited XLSX/PPTX choices plus fidelity fixtures, the product should refuse fidelity-sensitive Office conversion/editing claims rather than silently degrading or uploading documents.

### PDF

Keep the existing in-house PDF engine for the operations it already handles. `@cantoo/pdf-lib@2.11.1` is the preferred advanced-mutation **SPIKE** candidate and `pdfjs-dist@6.4.299` is the preferred lazy render/text **SPIKE** candidate. The PDF.js v6 cleanup contract is represented explicitly by `PDFDocumentLoadingTask.destroy()` in the harness.

Promotion still requires hostile/corrupt/large-file corpus coverage, forced cancellation/restart, full memory evidence, and physical mobile receipts. Advanced operations that cannot satisfy those limits should remain unavailable rather than pretending structural mutation establishes rendering fidelity.

### Audio

Use browser-native Web Audio for bounded DSP experiments and Mediabunny/WebCodecs for codecs that pass runtime capability probes. The corpus verifies a two-second DSP render plus WAV/MP4 inspection. Codec support must be treated as a runtime capability, not inferred from a browser brand.

`lamejs` is not the 2026 baseline. Unsupported local codecs should return an explicit unsupported state; there is no server transcoding fallback in this plan.

### Video

`mediabunny@1.61.3` is the primary **SPIKE** for general media inspection/container work, with `mp4box@2.4.1` as the smaller MP4-specific alternate. The full MP4Box build passes the corpus; its `simple` build was tried during harness development and failed on the generated H.264/AAC fixture, so the receipt intentionally measures the full build.

Video transcoding remains capability-gated WebCodecs work. The current official ffmpeg.wasm core is denied by the repository license policy, so unsupported transcodes must fail locally with a clear explanation instead of falling back to remote processing.

## Cancellation and mobile gate

Cancellation is not yet a reason to promote any candidate. Tesseract exposes an explicit worker lifecycle and cleanup, Mediabunny exposes `Input.dispose()`, and PDF.js exposes loading/render cancellation seams. HEIC, Office generation/parsing, and object-model PDF mutation need outer worker ownership so cancellation can terminate computation rather than merely hide UI progress. Ticket 101 owns that common runtime contract.

The physical mobile matrix remains:

| Lane | Status | Meaning |
|---|---|---|
| iOS Safari | `NOT_RUN` | no genuine iOS receipt attached |
| Android Chrome | `NOT_RUN` | no genuine Android receipt attached |
| Playwright WebKit | desktop regression only | explicitly **not Safari** evidence |

Because ticket 34 promotes **zero** paths, it does not fabricate or waive the physical-device requirement. Tickets 206 and the family spikes must attach the real-device receipts before any heavy path can become production-allowed.

## Evidence artifacts

Machine-readable receipts are under `quality/benchmarks/heavy-local-feasibility/`:

- `package-metadata.json`
- `npm-audit.json`
- `bundle-sizes.json`
- `desktop-runtime.json`
- `decision-matrix.json`

The spike itself is isolated under `spikes/heavy-local-feasibility/`, including exact dependency pins, the real-file corpus, build/runtime collectors, network blocking, and decision-matrix invariants. No production manifest/schema used by expansion ticket 70 is part of this tranche.
