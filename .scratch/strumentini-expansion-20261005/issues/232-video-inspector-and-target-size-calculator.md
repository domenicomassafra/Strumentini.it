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
