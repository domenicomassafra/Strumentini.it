# 36 — Audio file-processing family

**What to build:** Add local audio convert, trim, merge, speed/volume adjustment, silence removal, and deterministic cleanup/normalization only where the selected DSP stack proves acceptable quality and browser performance.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Codec list is evidence-driven; preserve source when possible; no cloud transcription/cleanup hidden behind a local-looking UI.

**Blocked by:** 230, 231.

**Status:** ready-for-agent

- [ ] Convert/trim/merge share one file timeline/export workspace where technically sensible.
- [ ] Output exposes codec/container, duration, sample rate/bitrate where known, and before→after size.
- [ ] Silence-removal/cleanup parameters are previewable and cancellable.

**Verification:** Real audio corpus across accepted formats, duration/waveform/export checks, performance/memory receipts, and genuine mobile acceptance.
