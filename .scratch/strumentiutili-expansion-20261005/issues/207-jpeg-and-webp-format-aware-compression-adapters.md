# 207 — JPEG and WebP format-aware compression adapters

**What to build:** Implement codec-specific JPEG and WebP compression behind one interface with truthful lossy/lossless support, encoder settings and keep-original warning when output grows.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 268.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] **REFUSED for production implementation:** ticket 268 records `jpegWebpAdvancedCodecControls=REFUSE_NO_VETTED_UNIFORM_CODEC_PATH`; no advanced JPEG/WebP codec controls are exposed as if uniformly supported.
- [x] The feasibility corpus records actual native encoded type/bytes where browser-native paths were measured, without promoting those measurements into a cross-browser codec contract.
- [x] No route claims successful compression or size reduction from an unapproved codec path; existing bounded image behavior remains unchanged.

**Verification:** Closed as a refusal downstream of ticket 268. Reopen only after a vetted uniform JPEG/WebP codec path passes the declared quality/performance/mobile promotion gate.
