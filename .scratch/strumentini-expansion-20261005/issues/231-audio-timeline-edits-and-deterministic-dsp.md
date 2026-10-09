# 231 — Audio timeline edits and deterministic DSP

**What to build:** Add trim, ordered merge, speed, volume/normalization and silence-removal on one bounded decoded-audio timeline with previewable parameters.

**Traces to:** US-EXP-06; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 230 — Audio transcode compress and target bitrate size.

**Status:** ready-for-agent

**Partial implementation:** isolated PCM16 WAV DSP subset delivered; full ticket remains open.

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] Edit ranges cannot exceed source duration **for the verified WAV PCM16 subset** (integer source-frame half-open bounds).
- [x] Merge order/duration reconciles exactly within tolerance **for the verified WAV PCM16 subset** (integer frame reconciliation at common native sample rate).
- [ ] Silence/normalization settings are previewable and disclosed.

**Verification:** Duration/waveform fixtures, boundary tolerances and cancel/memory checks.

**2026-10-09 isolated implementation (#231, not production promotion):** `src/engines/browser-audio/timeline-231.ts` accepts only strict mono/stereo RIFF/WAVE signed PCM16 at 8–48 kHz. Sources must share rate and channel count; ranges are native integer frames. It previews the ordered trim/merge duration and edit parameters, renders linear gain and linear endpoint fade with sample precision, and refuses gain that would saturate PCM16. Input budget is 12 MiB/file, 24 MiB combined, 8 sources, 128 segments; output is at most 60 seconds and 12 MiB. No ffmpeg/lame/Mediabunny codec promotion, resampling or lossy encoding. Caller provides `AbortSignal` and can terminate the worker hosting this synchronous bounded core. The module itself does not introduce or advertise a production UI.

**Evidence:** `tests/audio-timeline-231.test.ts` covers real RIFF parsing, stereo reordered cuts, fades and gain, invalid trim/frame/layout/gain/format limits, saturation refusal and cancellation including abort during render. `scripts/acceptance-audio-timeline-231.ts` generates physical PCM16 WAV inputs/outputs and independently reopens them with Python stdlib `wave`/`struct` to verify frame count, channel ordering, 440 channel samples, fades and native sample rate. Run with `./node_modules/.bin/vitest run tests/audio-timeline-231.test.ts` and `./node_modules/.bin/tsx scripts/acceptance-audio-timeline-231.ts`.

**Remaining acceptance and blockers:** Speed, normalization (including loudness targets), silence removal, waveform preview UI, sampled audio playback, physical iOS/Android proof and a general accepted codec worker are NOT_RUN/not implemented. #230 closed as a documented REFUSAL under #273, so this limited WAV DSP work must not be treated as permission to release general transcode/edit claims or mark #231 DONE. Cuts are hard joins and can click. Memory/termination performance beyond the static bounds and unit cancellation checks needs the shared #101 worker integration and device benchmarks before promotion.
