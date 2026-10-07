# 265 — File-size analyzer PDF adapter

**What to build:** Extend the size analyzer with PDF page/image/stream/metadata contribution evidence and scan-heavy vs text/vector-heavy classification where detectable.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 218, 228.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd

- [ ] Classification is evidence-based and can return unknown.
- [ ] Largest contributors link to exact measured structures/images.
- [ ] Recommendations point to compatible PDF optimizer/compressor actions.

**Verification:** Synthetic text/vector/image/scan-heavy PDFs with known composition.
