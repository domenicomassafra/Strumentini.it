# 259 — PPTX to PDF fidelity-gated conversion

**What to build:** Implement PPTX→PDF only if approved local rendering passes slide fidelity and font/media limitations; animations/transitions are explicitly out of static-PDF scope.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 206, 225, 270.

**Status:** completed

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [x] **REFUSED for production implementation:** ticket 270 records faithful Office rendering as `REFUSE_UNPROVEN`; no approved PPTX→PDF renderer exists.
- [x] Unsupported fonts/media/effects therefore remain unsupported instead of being represented as faithful static output.
- [x] No hidden cloud rendering is used.

**Verification:** Closed as a refusal downstream of ticket 270. Reopen only after an approved local renderer passes the presentation fidelity corpus and promotion gate.
