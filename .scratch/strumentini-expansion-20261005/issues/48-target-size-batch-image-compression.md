# 48 — Target-size + batch image compression

**What to build:** Add “riduci sotto X KB/MB” compression and a real batch compressor that can process mixed supported images locally, select a suitable encoder/profile per output format, isolate failures, and download all successful files as ZIP.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Target-size success is asserted only if final bytes are `<= target`; iterative quality/downscale strategy and minimum quality/dimension policy are visible; no fake exact-size promise.

**Blocked by:** 210, 211.

**Status:** completed (bounded JPEG/PNG/WebP route; advanced codec and physical gates separate)

- [x] User can target KB/MB and choose whether dimension reduction is allowed after quality reduction reaches its floor.
- [x] Batch result shows original/result bytes and saved percentage per file plus totals.
- [x] Files that cannot hit the target remain downloadable as best-effort only after an explicit warning, never as successful target hits.

**Verification:** Target boundary tests, mixed-format batch corpus, failure isolation, ZIP integrity, and memory/cancellation acceptance.

**Implementation proof (2026-10-08):** The existing `image-compression` route now exposes KiB/MiB targets, explicit quality floor, independently permitted pixel downscale and a sequential batch mode. The shared result renders per-file original/output byte counts and savings, aggregates, failure/target warnings and a verified ZIP download. Tickets 210/211 carry the engine tests, and Chromium/Firefox/WebKit browser acceptance includes downloads and ZIP reopening. This scope does not silently promote advanced JPEG/WebP codecs, PNG lossless/palette optimization, SVG optimization or absent physical-device evidence.
