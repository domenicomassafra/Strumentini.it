# STR-424 — Audio codec provenance (2026-10-22)

The browser's installed encoder is the only codec used. No library, wasm payload, binary,
third-party source, or vendored patch was imported. This deliberately avoids a new codec
engine or a license obligation from ffmpeg.wasm, libav.js or custom muxers.

| Capability / upstream | Revision consulted | License | Decision |
| --- | --- | --- | --- |
| [MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) | MDN documentation reviewed 2026-10-22; browser API, no vendor commit | Browser native/W3C standard, no packaged code adopted | Probe exact requested MIME; may still fail on runtime resource limit |
| [MediaRecorder MIME type](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType) | MDN documentation reviewed 2026-10-22; browser API, no vendor commit | Browser native/W3C standard, no packaged code adopted | Compare runtime format with actual output signatures |
| [MediaRecorder constructor](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder) | MDN documentation reviewed 2026-10-22; browser API, no vendor commit | Browser native/W3C standard, no packaged code adopted | Pass `audioBitsPerSecond` as requested quality hint; report measured rate |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | MDN documentation reviewed 2026-10-22; browser API, no vendor commit | Browser native/W3C standard, no packaged code adopted | Decode input, drive recording using `MediaStreamAudioDestinationNode`, decode output |

No donor license/commit applies because no donor package was installed or copied. The
custom gap is limited to safe controls, file-size bounds, format signature/codec checks,
cancel cleanup and measured receipts. The independent `ffprobe`/`ffmpeg` browser acceptance
uses host CLI tools only; no FFmpeg codec implementation is shipped with the site.

Scope: small decoded audio files (12 MiB, 60 s). Recording is real-time and relies on
an active, resumed AudioContext. Bitrate is not frame-exact; browser support, Safari
codec capability and performance must be measured on each actual runtime. Output is
refused on missing encoder, malformed bytes, undecodable playback or material loss of
duration/signal. This is separate from STR-363 memory-device budgets (#124).
