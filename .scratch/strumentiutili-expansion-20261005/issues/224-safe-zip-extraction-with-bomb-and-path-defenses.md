# 224 — Safe ZIP extraction with bomb and path defenses

**What to build:** Add preview-then-extract for supported ZIP entries, rejecting traversal, absolute paths, unsafe overwrite, encrypted/unsupported methods and expansion ceilings before materializing output.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 222 — Real ZIP DEFLATE compression tranche.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] **REFUSED for production extraction:** tickets 222/272 refuse promotion of the local DEFLATE path until central/local consistency, expansion-ratio, cancellation/worker ownership and physical-mobile evidence are certified; no extractor materializes compressed entry bytes while that gate is REFUSE.
- [x] The existing ZIP inspector already fails closed on central-directory bounds, path traversal, encrypted flags, entry-count and declared cumulative-uncompressed limits before any content extraction.
- [x] Because materialization itself is refused, duplicate-output overwrite/collision risk is not silently accepted; reopening requires an explicit collision policy before extraction is exposed.

**Verification:** Closed as a refusal downstream of tickets 222/272. Existing file-privacy tests cover ZIP-slip/path traversal and declared zip-bomb bounds; the heavy-local feasibility corpus records the remaining codec/cancellation/mobile promotion blockers.
