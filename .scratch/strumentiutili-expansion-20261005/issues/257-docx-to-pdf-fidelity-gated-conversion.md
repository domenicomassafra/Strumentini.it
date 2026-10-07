# 257 — DOCX to PDF fidelity-gated conversion

**What to build:** Implement DOCX→PDF only if the Office/PDF rendering feasibility gate accepts a local stack, with fidelity corpus and unsupported Word feature list.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 206, 226, 270.

**Status:** completed

**Suggested skills:** pdf → browser-performance-benchmark → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 270 records `faithfulOfficeRender=REFUSE_UNPROVEN`; the bounded DOCX semantic/preview paths are explicitly non-fidelity renderers.
- [x] Unsupported Word layout/fonts/fields/macros remain unsupported rather than being hidden behind a PDF fidelity claim.
- [x] No cloud conversion/upload fallback is introduced.

**Verification:** Closed as a refusal downstream of ticket 270. Reopen only after an approved local renderer passes the fidelity corpus and promotion gate.
