# 308 — Video AI context contact-sheet export

**What to build:** Create deterministic timestamped contact sheets plus source metadata/context manifest for video review/AI workflows without calling any AI service.

**Traces to:** US-EXP-08

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 232, 305.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] Timestamps and extracted frames correspond deterministically within the explicitly enforced 160 ms presentation tolerance, with `requestVideoFrameCallback` evidence; unsupported/time-inaccurate decoders fail closed.
- [x] Manifest includes source MP4 facts, source SHA-256, actual frame timestamps and SHA-256 only, with `generatedInterpretation: null`.
- [x] Multi-output ZIP STORE download includes generated contact-sheet.png, frame-NN.png and manifest.json, and archive directory is independently re-inspected before release.

**Verification:** Known video timeline corpus and frame/timestamp/manifest equality.

**Completed bounded acceptance 2026-10-09:** Reuses the existing `/tools/video-inspector/` frame-extraction workspace; no duplicate tool route. `src/engines/video/contact-sheet-308.ts` verifies bounded MP4 size, parsed nonfragmented duration, browser duration parity, requested evenly spaced frame positions, actual `requestVideoFrameCallback` presented timestamps (max 160 ms error), individual PNG SHA-256 and the source SHA-256. It creates a labeled grid via local canvas and ZIP with all source-frame PNGs plus `manifest.json`. The browser UI shows verified request→presentation times and exposes both PNG and ZIP, with explicit cancel/reset cleanup, no upload or AI call. `tests/video-contact-sheet-308.test.ts` includes three independent contract tests; `tests/video-contact-sheet-308.browser.mjs` PASS **26/26** against a real two-second red/green MP4 on a compiled site in Chromium desktop at 390px: source hash, manifest frame hashes, all four image signatures/dimensions, actual colors/times, sheet dimensions, ZIP reopen, zero offsite and zero page errors. The existing #305 frame extraction remains independently tested. **Not claimed:** exact-frame editing, arbitrary codec compatibility, physical iOS/Android thermal/memory acceptance, multi-browser evidence, AI semantic interpretation or new Gold status. MP4 fragmented/unknown duration, browsers without presented-frame callback, and time error >160 ms are unsupported and rejected rather than guessed.
