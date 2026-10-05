# 47 — JPEG/PNG/WebP/SVG compression engines

**What to build:** Replace the current one-size-fits-all canvas re-encode model with format-aware local compression for JPEG, PNG, WebP and SVG: JPEG-native lossy controls, PNG lossless + palette/lossy modes, WebP lossy/lossless controls, and SVGO-style vector optimization.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Preserve alpha/vector semantics where applicable; “lossless” requires pixel/DOM-semantic proof appropriate to the format; codecs are lazy and benchmarked; SVG scripts/external references get explicit safety treatment.

**Blocked by:** 01, 34.

**Status:** blocked

- [ ] JPEG has normal/high-compression presets plus expert controls only when the codec exposes them reliably.
- [ ] PNG distinguishes pixel-lossless optimization from palette/color-lossy compression and verifies transparency.
- [ ] WebP distinguishes lossy/lossless and exposes alpha/effort controls only when supported by the chosen codec.
- [ ] SVG optimization shows raw and gzip byte reduction, visual original-vs-optimized preview, multipass/precision settings and unsafe/aggressive changes separately.

**Verification:** Real corpus per format, byte/pixel/vector-render comparisons, malformed input cases, bundle/runtime/mobile receipts, and output-signature verification.

