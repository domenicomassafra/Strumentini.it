# 37 — Video inspect/subtitle utilities

**What to build:** Add local video inspection (codec/container/fps/rotation/bitrate/duration), bitrate↔target-size calculation, subtitle readability checks, SRT/VTT→clean transcript, subtitle offset/rescale + SRT↔VTT, exact-frame extraction, and webcam test.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Prefer inspection/parsing without transcoding; subtitle limits/targets must be configurable/source-labelled rather than universal claims.

**Blocked by:** 232, 233, 305.

**Status:** ready-for-agent

- [ ] Inspector reports actual stream/container facts and variable-frame-rate status when detectable.
- [x] Subtitle tools preserve cue ordering/text and report overlaps/reading-rate issues precisely for the bounded SRT/VTT contract verified by #233.
- [x] Frame extraction exports the real decoded frame at the chosen timestamp with disclosed seek precision (not frame-exact equivalence) as verified by #305/#308.

**Verification:** Media/subtitle fixture corpus, timecode boundary tests, VFR cases, permission tests for webcam, and mobile playback/seek acceptance.

**2026-10-09 cross-ticket acceptance audit (partial, not completed):** #233 `tests/subtitle-transform.test.ts` covers real SRT/VTT fixtures, SRT↔VTT roundtrip, cue order/text preservation, offset+scale, configurable CPS and source-labelled overlap diagnostics, Unicode combining sequences and fail-closed unsupported cue settings/blocks. #305 `node tests/video-frame-camera-305.browser.mjs` passed **27 browser checks** on a real two-color local MP4 with actual decoded red/green PNG frame pixels, requested-vs-presented timestamps, permission mock camera and zero offsite; #308 `node tests/video-contact-sheet-308.browser.mjs` passed **28 browser checks**, including ZIP PNG hashes and presented-frame callback tolerance limited to **160 ms**. These are *not* a frame-perfect/physical camera or device certification. **AC1 remains unchecked**: `src/engines/video/mp4-inspection.ts` conservatively reports `frameRateMode: "unknown"` because sample decode deltas in `stts` alone do not prove the presentation cadence under `ctts` and edits. VFR presentation inference requires validated combined-sample timing evidence, independent FFprobe corpus and unsupported-movie-fragment handling. No fake FPS/VFR truth, no Gold, no status promotion while AC1 and physical-mobile acceptance remain outstanding.
