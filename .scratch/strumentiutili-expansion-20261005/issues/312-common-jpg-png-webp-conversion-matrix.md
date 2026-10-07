# 312 — Common JPG PNG WebP conversion matrix

**What to build:** Deepen existing image conversion into truthful high-intent JPG↔PNG↔WebP directions with alpha flatten/background, quality/loss notes, output signature and route-vs-mode decisions from job identity policy.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97, 103, 104.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] Alpha→JPEG requires explicit background.
- [x] Every output is decoded/signature-verified.
- [x] Equivalent directions share engine code while high-intent routes follow policy.

**Verification:** Transparent/opaque raster corpus and conversion round trips.

**Evidence (2026-10-06):** The existing `image-format-conversion` route/oracle `cand-143` remains canonical; no duplicate direction routes or new oracle were added. `convertImageFormatLocal` now routes every JPEG/PNG/WebP direction through the same decode/canvas/encode seam and existing `outputBlob` verifier, which checks real output signature/header/type/dimensions and independently reopens the encoded image. A transparent source targeting JPEG fails with `JPEG_ALPHA_BACKGROUND_REQUIRED` unless an explicit background is supplied; the result records `sourceHadAlpha`, `alphaPolicy` and the actual background used. PNG output is described as a lossless re-encode of the browser-decoded RGBA only, while JPEG/WebP carry quality/fidelity notes and never claim recovery of previous codec loss or metadata. `quality/fixtures/image-metadata/transparent-2x2-rgba.png` provides real alpha coverage. `scripts/acceptance-image-upgrade-cluster.mjs` passes all six cross-format directions (PNG→JPEG/WebP, JPEG→PNG/WebP, WebP→PNG/JPEG), explicit alpha→JPEG refusal/background, signature+decode+dimension verification and 390px conversion UI. Focused image cluster tests and the existing image Result v2 suites pass; catalog build/check pass at 252 tools.
