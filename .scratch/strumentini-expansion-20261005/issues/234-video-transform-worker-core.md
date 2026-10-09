# 234 — Video transform worker core

**What to build:** Implement one lazy cancellable seam for accepted common-input→MP4, compression/target bitrate, trim and audio extraction; separate GIF/LUFS/contact-sheet follow-ons can consume it.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 232, 274.

**Status:** ready-for-agent

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Actual encoder support drives UI options.
- [ ] A/V sync and trim bounds meet documented tolerance.
- [ ] Worker cleans up on cancel/error and output signature/codec/size is verified.

**Verification:** Real media corpus, independent probes, sync/duration and physical iOS/Android evidence.

**Partial candidate (2026-10-09, #234; ticket remains OPEN):** `src/engines/video/audio-extract-234.ts`,
`wav-worker-234.ts` and the optional `VideoAudioExtract234.tsx` implement one measured
suboperation: **local AAC/mp4a in a nonfragmented MP4 with exactly one video and one audio
track → uncompressed PCM16 WAV**. The browser's `AudioContext.decodeAudioData` must really
decode the source; the audio samples are passed to a disposable Worker for WAV writing.
The MP4 sample entry `mp4a` is inspected; the precise MPEG-4 audio profile is
selected by the browser decoder, not inferred from the four-character code.
Optional start/end boundaries cut **only the decoded audio**, rounded to the decoded sample
rate; the WAV signature, header, sample count, channels, rate and size are rechecked before
download. This is **not** stream-copy, lossless extraction of AAC, MP4 remux or video editing.
The browser may resample to 48 kHz; source AAC priming and edit-list alignment are not
proven sample-accurate. No A/V sync with a newly generated video is claimed.

Hard gates: MP4/M4V ≤12 MiB, declared duration ≤60 s, one audio `mp4a` and one video
track, decoded mono/stereo 8–96 kHz, PCM WAV ≤16 MiB, decoded-vs-declared duration within
150 ms. Reject fragmented MP4, unknown timeline, multiple tracks/codecs, unavailable
browser APIs, invalid cuts or unverifiable output. An AbortSignal cancels the worker and
prevents partial publication; on abort/error resources are released. No backend upload.

**Explicit refusals:** Video trim, video compression, target-bitrate video output, conversion
to MP4 and A/V mux/sync remain **UNSUPPORTED** until a locally deployable, verified video
encoder/muxer is present and duration/frame/codec/sync output tests pass. A host-installed
FFmpeg binary does not make FFmpeg available to this browser application. #306/#038 must
not treat this subset as their dependency fully satisfied. Physical iOS/Android acceptance
and  real camera media remain pending.

**Scoped proof:** `npx vitest run tests/video-audio-transform-234.test.ts` → **6/6 PASS**.
The checked-in MP4 fixture contains two externally generated AAC tones, 440 Hz followed
by 880 Hz. The independent test-only FFmpeg decoder supplies real float PCM to the same
PCM16 writer loaded by the browser Worker; independent FFprobe identifies the output as
`pcm_s16le` mono 48 kHz, and sample-window zero crossings/RMS confirm both frequencies
and non-silence after 0.5-second audio cuts. FFmpeg exposes 256 more decoded AAC samples
than the container's exact two-second timeline: this is why sample-exact source alignment
and A/V sync remain unverified. `tests/video-audio-transform-234.browser.mjs` contains a
full UI/download/browser proof but **has not been executed** under current shared-host
load. Chromium decode of the existing synthetic AAC MP4 was probed in isolation; this
does not replace full UI/Worker/physical-device acceptance.
