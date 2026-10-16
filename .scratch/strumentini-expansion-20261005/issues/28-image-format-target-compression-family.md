MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

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

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #367, #393.

**Next actionable AC:** HEIC and each accepted output format inherit real-device/browser fixture evidence from the detailed codec tickets.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
