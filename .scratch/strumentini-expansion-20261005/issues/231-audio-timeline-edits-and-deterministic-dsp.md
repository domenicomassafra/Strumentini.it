# 231 — Audio timeline edits and deterministic DSP

**What to build:** Add trim, ordered merge, speed, volume/normalization and silence-removal on one bounded decoded-audio timeline with previewable parameters.

**Traces to:** US-EXP-06; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 230 — Audio transcode compress and target bitrate size.

**Status:** ready-for-agent

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Edit ranges cannot exceed source duration.
- [ ] Merge order/duration reconciles exactly within tolerance.
- [ ] Silence/normalization settings are previewable and disclosed.

**Verification:** Duration/waveform fixtures, boundary tolerances and cancel/memory checks.
