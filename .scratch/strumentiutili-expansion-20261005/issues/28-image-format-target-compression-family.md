# 28 — Image format + target-compression family

**What to build:** Extend image conversion with HEIC→JPG/PNG where browser/runtime support is proven, explicit JPG/PNG/WebP/AVIF routes backed by the shared engine, and iterative compression to a user-specified maximum file size such as 200 KB with before/after quality/size facts.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Local-only; target-size mode must state when the target cannot be reached within minimum quality/dimension bounds; no fake "lossless" claims.

**Blocked by:** 01, 34.

**Status:** blocked

- [ ] HEIC and each accepted output format have real-device/browser fixture evidence.
- [ ] Target-size output shows original/result size, reduction %, dimensions, format, and quality strategy.
- [ ] Job-specific routes reuse one conversion/compression engine.

**Verification:** Real image corpus, byte-size assertions, perceptual/format checks, cancellation, and iOS/Android browser acceptance before Gold.

