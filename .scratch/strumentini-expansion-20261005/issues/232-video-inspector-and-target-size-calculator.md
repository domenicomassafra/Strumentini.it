# 232 — Video inspector and target-size calculator

**What to build:** Inspect local video stream/container facts and compute target-MB↔bitrate math without loading the transcoder on inspection-only route.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 206, 274.

**Status:** ready-for-agent

**Suggested skills:** code-tdd → qa-browser → browser-performance-benchmark

- [ ] Unknown metadata stays unknown; VFR is not misreported as fixed fps.
- [ ] Rotation/multistream facts are exposed when available.
- [ ] Inspector route proves transcoder chunk is absent.

**Verification:** CFR/VFR/rotation/multistream corpus and independent probe comparison.

**Implementation slice (2026-10-08, NOT closure):** `src/engines/video/target-size.ts` now calculates a bounded, explicit decimal-MB/binary-MiB budget from duration, subtracting audio/overhead **only if the caller supplies those estimates**, never pretending to infer an audio track, real encoder bitrate or compression outcome. Dedicated positive/negative tests live in `tests/video-target-size.test.ts`. Inspector UI/route, real local container/codec probe, CFR/VFR/rotation/multistream corpus and independent browser/transcoder-laziness proof remain **not implemented/NOT_RUN**, so status stays `ready-for-agent` and this is not a Gold or release result.

**Further bounded implementation (2026-10-08, still NOT closure):** `src/engines/video/mp4-inspection.ts` now reads only ISO BMFF headers and a capped 8 MiB `moov` atom from local Blob slices; large `mdat` payloads are not loaded, no decoder/transcoder/network is called. It extracts independently testable movie duration, handler track counts, dimensions, codec FourCC and display matrices, and returns container-wide calculated bitrate distinctly from per-stream bitrate. FPS and CFR/VFR remain **unknown**, and fragmented MP4 total duration is unknown. `tests/video-mp4-inspection-232.test.ts` uses four tiny synthetic FFmpeg `lavfi` fixtures (H.264 12fps, audio+video, and positive/negative rotation) independently inspected with FFprobe: source durations 1.25s/1.20s, dimensions 64×48/80×60, tracks 1/2 and rotations +90/-90. These are synthetic test vectors, NOT real camera/mobile codec acceptance, and not a verified inspector route. Browser UI/wiring, diverse real multi-stream/VFR corpus, current-build bundle proof, performance/physical acceptance remain OPEN.
