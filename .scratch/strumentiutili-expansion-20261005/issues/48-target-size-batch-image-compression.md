# 48 — Target-size + batch image compression

**What to build:** Add “riduci sotto X KB/MB” compression and a real batch compressor that can process mixed supported images locally, select a suitable encoder/profile per output format, isolate failures, and download all successful files as ZIP.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Target-size success is asserted only if final bytes are `<= target`; iterative quality/downscale strategy and minimum quality/dimension policy are visible; no fake exact-size promise.

**Blocked by:** 47.

**Status:** blocked

- [ ] User can target KB/MB and choose whether dimension reduction is allowed after quality reduction reaches its floor.
- [ ] Batch result shows original/result bytes and saved percentage per file plus totals.
- [ ] Files that cannot hit the target remain downloadable as best-effort only after an explicit warning, never as successful target hits.

**Verification:** Target boundary tests, mixed-format batch corpus, failure isolation, ZIP integrity, and memory/cancellation acceptance.

