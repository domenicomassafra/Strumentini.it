# 223 — GZIP single-file compress and decompress

**What to build:** Add a dedicated gzip/gunzip job with original/result bytes, header facts and verified byte round-trip/integrity for single-file semantics.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 272.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → browser-performance-benchmark

- [x] **REFUSED for production promotion:** ticket 272 exercises valid/corrupt GZIP fixtures with `fflate@0.8.3` but refuses promotion because bounded expansion, cancellation ownership and physical-mobile cost are not yet certified.
- [x] The feasibility corpus proves byte-equal valid decompression, but that result remains isolated evidence rather than a production route while the promotion gate is REFUSE.
- [x] No GZIP output/download claim is exposed in the product until the accepted implementation can return verified filename/type/integrity under the shared bounded runtime.

**Verification:** Closed as a refusal downstream of ticket 272 using the heavy-local archive corpus and machine-readable decision receipt. Reopen only after the ticket-272 promotion requirements are satisfied.
