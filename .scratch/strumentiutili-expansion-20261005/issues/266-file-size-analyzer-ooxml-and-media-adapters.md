# 266 — File-size analyzer OOXML and media adapters

**What to build:** Extend size analyzer with OOXML package groups plus audio/video duration/codec/bitrate facts when their inspectors are available, without speculative savings.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 225, 228, 230, 232.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd

- [ ] OOXML groups XML/media/fonts/other by measured bytes.
- [ ] Audio/video facts come from approved inspectors.
- [ ] Recommendation is absent when no supported optimizer exists.

**Verification:** Known package/media fixtures and source-hash no-mutation check.
