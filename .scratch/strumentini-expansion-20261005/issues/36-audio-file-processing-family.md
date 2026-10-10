# 36 — Audio file-processing family

**What to build:** Add local audio convert, trim, merge, speed/volume adjustment, silence removal, and deterministic cleanup/normalization only where the selected DSP stack proves acceptable quality and browser performance.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Codec list is evidence-driven; preserve source when possible; no cloud transcription/cleanup hidden behind a local-looking UI.

**Blocked by:** 230, 231.

**Status:** completed

- [x] Convert/trim/merge share one file timeline/export workspace where technically sensible.
- [x] Output exposes codec/container, duration, sample rate/bitrate where known, and before→after size.
- [x] Silence-removal/cleanup parameters are previewable and cancellable.

**Verification:** Real audio corpus across accepted formats, duration/waveform/export checks, performance/memory receipts, and genuine mobile acceptance.

**2026-10-10 functional closure (bounded PCM/WAV subset):** The public `/tools/audio-generator/` page now includes a discoverable `#audio-processing` WAV workspace. The single existing #231 timeline/Worker handles source PCM WAV 8/16/24/32 bit and IEEE float32 → canonical WAV signed PCM16, then trimmed/ordered merge, 0.5–2× pitch-changing speed, bounded gain, silence removal and sample-peak normalization. No compressed MP3/AAC, resampling, pitch-preservation, LUFS or general-purpose codec promotion is claimed: upstream #230 closed as a documented *refusal* under #273. The importer checks RIFF/chunk/codec/byte-rate/frame-size coherence and explicitly rejects malformed or unsupported input. Bit-depth reduction quantizes samples, disclosed in UI. Source File bytes are not rewritten.

**Source-backed preview, cancel and receipt:** A separate Worker `kind: preview` job measures actual silence spans, frame count, duration, peak and deterministic PCM16 output bytes before publishing any WAV. Both preview and render are cancellable by terminating the disposable Worker; no late/stale download is published. The resulting player and download are generated from real PCM16 output samples; visible receipt shows codec/container, source encoding/bitrate/duration, output bitrate/sample rate/channels/duration, and input sum bytes → output WAV bytes. No network processing or uploads.

**Validated on final isolated static build:** `tests/audio-processing-family-036.test.ts` **9/9**, and focused #036/#231 suites **40/40 PASS**; Astro check **0 errors/0 warnings** (21 unrelated deprecation hints); Astro static build **291 pages PASS** at `/tmp/str036-audio-final`. `AUDIO036_DIST=/tmp/str036-audio-final node tests/audio-processing-036.browser.mjs`: **78/78 PASS** over desktop Chromium/Firefox/WebKit (390 px), genuine Float32 WAV 32,044 bytes → 12,842-byte PCM16 WAV, independently reopened with FFprobe (`pcm_s16le`, 8 kHz, 1 channel, 0.799875 seconds). Strict pre-export silence preview (1601 actual measured frames), cancelled-held Worker without output, then verified download, with 3/3 Workers constructed/terminated per browser, no offsite or POST. Re-run of original `AUDIO231_DIST=/tmp/str036-audio-final AUDIO231_BROWSERS=chromium,firefox,webkit node scripts/acceptance-audio-timeline-ui-231.browser.mjs` **129/129 PASS**, including real ordered trim/merge, silence/normalization, independently re-opened downloaded WAV and cancellation. Near-ceiling `AUDIO231_STRESS_DIST=/tmp/str036-audio-dist node scripts/acceptance-audio-timeline-stress-231.browser.mjs` **PASS** with real 60 s/48 kHz/stereo 11,520,044-byte WAV, 347 ms desktop run, 3/3 Workers terminated, output budget and cancellation gates. #036 60-second PCM8→PCM16 CPU/memory snapshot: `node --import tsx tests/audio-processing-036-memory.mjs` **PASS**, 5,760,044 input → 11,520,044 output bytes, 28.4 ms and Node RSS before/after 35,033,672 → 46,699,080 bytes (snapshot delta 11,665,408). RSS snapshots are neither Worker peak memory nor mobile-device evidence. See `evidence/ticket036-audio-20261010.md`.

**Separate physical-device gate:** Genuine Android Chrome and iOS Safari physical QA remains **NOT_RUN**, inherited existing #280 and #281. This local functional ticket closure does not certify a physical device, Gold, a public deploy, or new lossy codecs. Generated catalog/dashboard projections may need a single PRIME sync after merge of the audio-generator manifest and this ticket. No commit/push/deploy by worker.
