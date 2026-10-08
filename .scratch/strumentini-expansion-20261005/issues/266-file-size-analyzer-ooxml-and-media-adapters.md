# 266 — File-size analyzer OOXML and media adapters

**What to build:** Extend size analyzer with OOXML package groups plus audio/video duration/codec/bitrate facts when their inspectors are available, without speculative savings.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 225, 228, 230, 232.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] OOXML groups XML/media/fonts/other by measured bytes.
- [x] Audio/video facts come from bounded MP4 moov inspector and strict RIFF PCM WAVE headers; unsupported input stays unknown.
- [x] Recommendation is absent when no supported optimizer exists (MP4/PCM WAV report recommendedOptimizer: null).

**Verification:** Known package/media fixtures and source-hash no-mutation check.

**2026-10-09 functional implementation:** `src/engines/file-privacy/size-adapters.ts` and `analyzeFileSize` now inspect real DOCX/PPTX/XLSX OOXML ZIP entries using the existing package preflight, with measured compressed and uncompressed byte groups (XML/media/fonts/other), ZIP overhead and per-part largest-media ranking. ZIP-based Office detection requires matching extension and actual OOXML package kind, refuses malformed/macros/encrypted/traversal via existing hard limits. The already shipped bounded MP4 inspector reports declared movie duration, brand, video/audio tracks, codec FourCC, rotation and **container** average bitrate only when proven; stream bitrate, FPS and fragmented total duration remain unknown. Strict PCM RIFF WAVE header provides duration/sample rate/channels/PCM declared bitrate only when all chunk lengths and block alignment validate; MP3 and unsupported audio formats remain unknown. The analyzer hashes the original file with SHA-256 before work and never transforms source bytes or reports a speculative future savings value. Recommended optimizer is `ooxml-media-compression` only for supported Office packages, **null** for MP4/PCM; no unapproved audio/video compression advertised. Source inspector Gold history is preserved without new Gold receipts.

**Acceptance:** `tests/file-size-adapters-266.test.ts` **8/8 PASS** with genuine DOCX/PPTX/XLSX+MP4 fixtures, fragmented MP4, generated strict PCM WAV, invalid Office extension, corrupt PCM sample rates, source byte parity; legacy `tests/file-privacy-engine.test.ts` **16/16 PASS**. `npx tsc --noEmit --pretty false` **PASS**. Static Astro build **283 pages PASS**. `node tests/file-size-266.browser.mjs` actual local compiled public route **21 browser checks PASS** (Office measured groups, MP4 regular+fragmented, no POST/offsite, 390px viewport). This is a bounded feature AC completion, **not** iOS/Android physical evidence, broad MP3 media codec acceptance or a new Gold receipt.
