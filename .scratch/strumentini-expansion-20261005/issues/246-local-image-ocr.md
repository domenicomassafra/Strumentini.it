# 246 — Local image OCR

**What to build:** Implement local OCR for supported image formats/languages after the OCR feasibility gate, exposing language, confidence where provided and page/image provenance without cloud upload.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 271.

**Status:** ready-for-agent

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Italian OCR is an explicit supported language when accepted.
- [ ] Confidence is shown only if engine provides meaningful confidence.
- [ ] Large/unsupported images fail preflight rather than crash.

**Verification:** Printed/scanned/rotated image corpus, accuracy fixtures and physical mobile/perf receipts.

**Independent incremental feasibility lane (2026-10-09; production still REFUSED):**

- Added source-only `src/engines/ocr/image-feasibility.ts` with an explicit **always-refused** production contract tied to #271: neither an OCR worker nor a model is loaded, and the API never returns fabricated recognized text/confidence. There is no public OCR route, tool manifest or network fallback. A compatible preflight **cannot** upgrade the refusal.
- Accepts **Italian (`ita`) as the only tested *spike* language**, not a production-supported language. Only `image/png` can pass the exploratory header check; checks PNG signature, IHDR format and CRC, 5 MiB file limit, 4000 px per dimension, 2 megapixels, resource budget, and independent Worker/WASM/decode prerequisites before reading any full payload. Invalid, spoofed, oversized and resource-risk files remain refused. Cancellation aborts the preflight; cancellation of an active Tesseract recognition is **not** certified.
- `tests/ocr-image-feasibility-246.test.ts` verifies the actual SHA-pinned Italian PNG header (1280×240), strict language/mime decisions, forged-but-CRC-consistent dimension bombs, CRC tampering, missing capabilities, oversized inputs, pre-aborted signals and no preflight fetch. It also checks the recorded #271 refusal and exact package/license identities: `tesseract.js@7.0.0` (Apache-2.0), `@tesseract.js-data/ita@1.0.0` (MIT).
- `tests/ocr-246-real-italian-fixture.test.ts` runs the **actual** pinned Tesseract worker with locally installed assets from the existing isolated feasibility spike, reads the existing 14,305-byte PNG whose SHA-256 is `1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b`, checks recognized text **exactly** `Fattura numero 12345 - Totale euro 678,90`, checks finite engine-defined confidence (not a calibrated correctness probability), and terminates the worker in `finally`. The local Tesseract worker emits a nonfatal `ita.special-words` warning with this model; OCR still returns the checked text. This **desktop Node spike** neither proves browser network behavior anew nor simulates mobile hardware.
- Focused test result: `node_modules/.bin/vitest run tests/ocr-image-feasibility-246.test.ts tests/ocr-246-real-italian-fixture.test.ts` **6/6 PASS**. Isolated TypeScript check of the three new files **PASS**. Repository-wide `tsc --noEmit` is currently blocked by existing errors in unrelated PDF #250/#256 browser acceptance files on main; these files were not modified. No new browser receipt, deployment, Gold or catalog modification.

**Still blocked:** #271 disallows production promotion until actual iOS Safari and Android Chrome OCR/performance testing, total browser/WASM/native-memory evidence and active-job cancellation/cleanup acceptance are available. Language assets (~6.93 MB) and core/worker (~4 MB+ candidate-dependent) are installed **only in the feasibility spike**, not in the production dependency graph. Printed/scanned/rotated accuracy corpus beyond the one pinned synthetic invoice remains unverified. Searchable PDF text layer is separately refused (#247). Thus the three production-facing acceptance checkboxes above remain **unchecked**, the status remains exactly `ready-for-agent`, and no OCR feature is falsely advertised to users.
