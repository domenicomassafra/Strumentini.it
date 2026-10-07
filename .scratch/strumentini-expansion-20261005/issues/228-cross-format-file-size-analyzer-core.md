# 228 — Cross-format file-size analyzer core

**What to build:** Build the diagnostic-only deep module for why a file is large, first with image and ZIP adapters and evidence-based next-action ids; it must never promise savings before compression runs.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 97, 222.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] The analyzer is read-only and returns the source SHA-256; tests compare the exact source bytes before/after analysis.
- [x] Image mode reports bounded header dimensions, pixel count, encoding and metadata-risk facts; ZIP mode reports central-directory compressed/uncompressed totals, methods and largest entries without decompression.
- [x] Unsupported/opaque input returns `kind: unknown` and `estimatedSavingsBytes: null`; all modes explicitly refuse to promise savings before an actual transform produces measured output bytes.

**Verification:** `tests/file-privacy-engine.test.ts` covers synthetic PNG, store-ZIP and opaque-binary cases, source byte equality, SHA-256 identity, exact ZIP largest-entry ordering and no-guessed-savings behavior. Oracle `cand-250` binds the existing image/ZIP standards fixtures to this diagnostic-only composition.
