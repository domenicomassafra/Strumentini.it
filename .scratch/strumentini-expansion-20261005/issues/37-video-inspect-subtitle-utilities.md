# 37 — Video inspect/subtitle utilities

**What to build:** Add local video inspection (codec/container/fps/rotation/bitrate/duration), bitrate↔target-size calculation, subtitle readability checks, SRT/VTT→clean transcript, subtitle offset/rescale + SRT↔VTT, exact-frame extraction, and webcam test.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Prefer inspection/parsing without transcoding; subtitle limits/targets must be configurable/source-labelled rather than universal claims.

**Blocked by:** 232, 233, 305.

**Status:** blocked

- [ ] Inspector reports actual stream/container facts and variable-frame-rate status when detectable.
- [ ] Subtitle tools preserve cue ordering/text and report overlaps/reading-rate issues precisely.
- [ ] Frame extraction exports the real decoded frame at the chosen timestamp with disclosed seek precision.

**Verification:** Media/subtitle fixture corpus, timecode boundary tests, VFR cases, permission tests for webcam, and mobile playback/seek acceptance.
