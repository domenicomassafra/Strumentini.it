# 212 — HEIC AVIF and GIF directional image implementations

**What to build:** After the codec feasibility decision, implement only accepted directional HEIC/HEIF decode, AVIF encode/decode and GIF still/animated conversion jobs with explicit fidelity/animation rules.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-10; AC-06.1, AC-10.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 206, 268.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Only ACCEPTED directions from feasibility matrix become routes/modes.
- [ ] HEIC real-iPhone and animated GIF fixtures keep orientation/timing/transparency within declared limits.
- [ ] Static-frame extraction is distinct from animated conversion.

**Verification:** Real corpus, signature/decode, animation timing and physical mobile receipts.
