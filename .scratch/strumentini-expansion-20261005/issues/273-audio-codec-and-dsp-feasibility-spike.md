# 273 — Audio codec and DSP feasibility spike

**What to build:** Choose or refuse local browser audio codec/DSP dependencies for transcode/compress/edit workflows with exact format matrix, licensing, worker support, bundle, runtime, memory and mobile results.

**Traces to:** US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; feasibility only.

**Blocked by:** None for the feasibility decision. Ticket 100 preflight and ticket 101 shared worker/cancellation runtime are complete; physical iOS/Android evidence remains a promotion prerequisite.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] Accepted codecs/containers are enumerated directionally.
- [x] DSP features are separated from codec availability.
- [x] Physical iOS/Android is an explicit production-promotion gate and remains NOT_RUN; no desktop result is substituted.

**Verification:** Audio corpus benchmark and decision matrix.

**Evidence (2026-10-07 re-evaluation):** decision is **REFUSE audio codec/DSP production promotion from this feasibility lane**. Web Audio OfflineAudioContext DSP is measured separately from codec/container support; Mediabunny/WebCodecs remain exact-runtime-capability spikes, while the current official ffmpeg.wasm core stays refused by the repository licence gate and lamejs remains refused as the baseline. Ticket 100 preflight and ticket 101 worker termination/resource ceilings are complete. The WAV/MP4 desktop corpus and DSP case run locally with zero external requests. Physical iOS Safari/Android Chrome behavior remains NOT_RUN; that absence prevents positive promotion and is not replaced by desktop/WebKit evidence.
