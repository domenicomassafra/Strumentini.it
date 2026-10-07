# 250 — PDF n-up pages per sheet

**What to build:** Add 2-up/4-up/custom bounded n-up imposition with paper size, orientation, margins/gaps and page-order preview.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Sheet/page mapping is previewed and deterministic.
- [ ] Blank padding policy is explicit.
- [ ] Output geometry and source-page order are verified.

**Verification:** Page-numbered fixture PDFs and rendered imposition checks.
