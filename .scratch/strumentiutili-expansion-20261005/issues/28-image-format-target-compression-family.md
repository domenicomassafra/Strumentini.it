# 28 — Image format + target-compression family

**What to build:** Integrate the format-specific compressor and conversion work from tickets 47–49 into the public image family, with coherent route aliases, shared workspace/handoffs and one capability matrix; do not build a second codec path here.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Local-only; target-size mode must state when the target cannot be reached within minimum quality/dimension bounds; no fake "lossless" claims.

**Blocked by:** 47, 48, 49.

**Status:** blocked

- [ ] HEIC and each accepted output format inherit real-device/browser fixture evidence from the detailed codec tickets.
- [ ] Target-size and codec-specific routes share one file workspace, result vocabulary and handoff graph.
- [ ] Job-specific routes reuse the detailed engines without duplicate encoding logic.

**Verification:** Real image corpus, byte-size assertions, perceptual/format checks, cancellation, and iOS/Android browser acceptance before Gold.
