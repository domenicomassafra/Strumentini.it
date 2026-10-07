# 271 — OCR engine feasibility spike

**What to build:** Choose or refuse a local OCR stack for Italian images/scanned PDFs by measuring language assets, lazy bundle, startup/runtime, memory, cancellation, orientation/quality and physical mobile behavior.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; no server OCR.

**Blocked by:** None — ticket 100 is completed.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] Italian language support is verified on real corpus.
- [x] Language data loading/offline caching behavior is explicit.
- [x] Searchable-PDF text-layer capability is separately assessed.

**Verification:** OCR corpus with accuracy/runtime/mobile evidence.

**Evidence (2026-10-07):** decision is **REFUSE production promotion**. `tesseract.js@7.0.0` with local `@tesseract.js-data/ita@1.0.0` recognizes the Italian invoice fixture in every observed desktop engine; Chrome reports confidence 94 for the expected markers, and worker/core/language assets load from same origin with zero external requests. Searchable-PDF text-layer composition is explicitly separated/refused in this engine spike. The language asset alone is ~6.93 MB and the observed JS heap does not include WASM/native memory. Physical iOS Safari/Android Chrome OCR behavior remains `NOT_RUN`; that missing evidence now gates production promotion rather than leaving the feasibility decision open.
