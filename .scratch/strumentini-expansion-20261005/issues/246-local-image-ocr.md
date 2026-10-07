# 246 — Local image OCR

**What to build:** Implement local OCR for supported image formats/languages after the OCR feasibility gate, exposing language, confidence where provided and page/image provenance without cloud upload.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 271.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Italian OCR is an explicit supported language when accepted.
- [ ] Confidence is shown only if engine provides meaningful confidence.
- [ ] Large/unsupported images fail preflight rather than crash.

**Verification:** Printed/scanned/rotated image corpus, accuracy fixtures and physical mobile/perf receipts.
