# 245 — PDF A conversion decision and implementation

**What to build:** Benchmark a PDF/A-capable local path and implement only accepted conformance profile(s), clearly separating conversion from independent formal conformance validation.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1, AC-09.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 206, 269.

**Status:** completed

**Suggested skills:** pdf → research-primary-sources → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 269 records `pdfA=REFUSE_UNPROVEN`; no PDF/A profile is claimed from the current bounded PDF stack.
- [x] No output is labelled PDF/A without an approved conversion path plus independent formal conformance validation.
- [x] Font/color/transparency limitations therefore remain an explicit reason for refusal rather than an implicit fidelity promise.

**Verification:** Closed as a refusal downstream of ticket 269. Reopen only with an approved PDF/A-capable path and independent profile-validation evidence.
