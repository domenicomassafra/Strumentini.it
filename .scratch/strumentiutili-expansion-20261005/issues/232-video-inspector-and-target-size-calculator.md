# 232 — Video inspector and target-size calculator

**What to build:** Inspect local video stream/container facts and compute target-MB↔bitrate math without loading the transcoder on inspection-only route.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 206, 274.

**Status:** blocked

**Suggested skills:** code-tdd → qa-browser → browser-performance-benchmark

- [ ] Unknown metadata stays unknown; VFR is not misreported as fixed fps.
- [ ] Rotation/multistream facts are exposed when available.
- [ ] Inspector route proves transcoder chunk is absent.

**Verification:** CFR/VFR/rotation/multistream corpus and independent probe comparison.
