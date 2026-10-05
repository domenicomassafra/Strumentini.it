# 34 — Heavy local media/OCR/Office feasibility refresh

**What to build:** Re-benchmark current 2026 browser-local dependency options for HEIC, OCR, Office parsing/writing, PDF advanced editing, audio codecs/DSP, and video transcoding/inspection, then publish an allow/deny matrix with lazy-load size, runtime, memory, mobile behavior, licensing, and fallback boundaries.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1, AC-09.1; DEC-EXP-05, DEC-EXP-06; C-EXP-01, C-EXP-02, C-EXP-05, C-EXP-08

**Constraints:** Research/spike only; do not promote a dependency merely because a demo renders; preserve existing production dependencies until measured evidence supports promotion.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Candidate matrix covers codec/format support, license, compressed bundle size, cold load, representative runtime, peak memory, cancellation, offline/local behavior, iOS Safari and Android Chrome.
- [ ] Each downstream heavy family has an explicit recommended stack or a documented refusal/fallback.
- [ ] No physical-device result is fabricated from desktop emulation.

**Verification:** Reproducible benchmark receipts and small real-file corpus runs on desktop plus genuine mobile evidence for promoted paths.

