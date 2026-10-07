# 247 — Scanned PDF OCR and searchable text layer

**What to build:** Apply the accepted OCR stack to scanned PDF pages and produce selectable/searchable text-layer output while preserving page appearance within declared tolerance.

**Traces to:** US-EXP-04, US-EXP-06; AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 246.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Output contains selectable/searchable text on OCRed pages.
- [ ] Visual page rendering remains within documented tolerance.
- [ ] Mixed born-digital/scanned pages do not duplicate existing text silently.

**Verification:** Mixed PDF corpus, text search/extraction, rendered comparison and mobile/perf.
