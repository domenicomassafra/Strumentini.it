# 34 — Heavy local media/OCR/Office feasibility refresh

**What to build:** Re-benchmark current 2026 browser-local dependency options for HEIC, OCR, Office parsing/writing, PDF advanced editing, audio codecs/DSP, and video transcoding/inspection, then publish an allow/deny matrix with lazy-load size, runtime, memory, mobile behavior, licensing, and fallback boundaries.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1, AC-09.1; DEC-EXP-05, DEC-EXP-06; C-EXP-01, C-EXP-02, C-EXP-05, C-EXP-08

**Constraints:** Research/spike only; do not promote a dependency merely because a demo renders; preserve existing production dependencies until measured evidence supports promotion.

**Blocked by:** None — child feasibility decisions 267–275 are complete.

**Status:** completed

- [x] Candidate matrix covers codec/format support, license, compressed bundle size, cold load, representative runtime, measured memory scope, cancellation, offline/local behavior, and explicit iOS Safari/Android Chrome NOT_RUN states.
- [x] Each downstream heavy family has an explicit recommended stack or a documented refusal/fallback.
- [x] No physical-device result is fabricated from desktop emulation.

**Verification:** Reproducible benchmark receipts and small real-file corpus runs on desktop plus genuine mobile evidence for promoted paths.

**Evidence (2026-10-07 re-evaluation):** the supplemental receipt `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json` gives every child family an explicit IMPLEMENT/SPIKE/REFUSE boundary and includes bounded CMS/P7M, archive, animated-GIF, 200-page PDF, larger-video and hostile-mail/EPUB probes. All current benchmark cases pass in each observed desktop engine with browser traffic constrained to loopback. Ticket 100 preflight and ticket 101 shared worker/cancellation/resource ceilings are complete. No new heavy dependency is production-promoted from this feasibility evidence: all 267–275 decisions are closure-eligible refusals at the production-promotion level, while useful candidates remain bounded spikes where recorded. Physical iOS Safari/Android Chrome remain explicitly `NOT_RUN`, the HEIC fixture is still synthetic rather than iPhone-origin, and those facts remain promotion blockers rather than fabricated acceptance.
