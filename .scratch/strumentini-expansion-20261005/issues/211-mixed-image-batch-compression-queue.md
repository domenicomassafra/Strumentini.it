# 211 — Mixed-image batch compression queue

**What to build:** Build a bounded mixed JPEG/PNG/WebP queue selecting the proper adapter per file with isolated failures, aggregate savings and download-all ZIP.

**Traces to:** US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 79, 207, 208, 210, 222.

**Status:** completed (bounded sequential queue; real-device promotion separately gated)

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] One corrupt file never removes successful outputs.
- [x] Concurrency stays within declared resource budget.
- [x] Aggregate totals reconcile exactly to per-file bytes.

**Verification:** Mixed corpus, failure isolation, cancel, ZIP integrity and mobile run.

**Implementation proof (2026-10-08):** `src/engines/image/batch-compression.ts` reuses the canonical single-image encoder by detected source MIME, processes one file at a time with a limit of 8 files and 80 MiB, and isolates errors per input. The existing local ZIP engine stores only successful results and rechecks the archive central-directory entries against the verified output inventory. Actual Blob sizes determine exact per-file and aggregate savings. `tests/image-batch-compression.test.ts` covers corrupt-file isolation, cancellation, totals, duplicate-safe filenames and ZIP content-byte reopening. Chromium/Firefox/WebKit acceptance tests prove mixed JPEG+PNG+corrupt input, ZIP download, byte signatures and responsive 390px layout. This does **not** assert physical iOS/Android measurements, HEIC/AVIF or advanced codec promotion.
