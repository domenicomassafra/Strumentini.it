# 255 — PDF to PPTX page-as-slide baseline

**What to build:** Create PPTX with each PDF page rendered as a slide image as the reliable baseline; editable reconstruction is a separate future mode only if proven.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 225, 236, 270.

**Status:** ready-for-agent

**Suggested skills:** pdf → code-module-design → code-tdd

- [ ] Slide count/order equals selected PDF pages.
- [ ] Rendered slide image dimensions/aspect are deterministic.
- [ ] UI labels baseline as page-as-slide, not editable reconstruction.

**Verification:** Multipage corpus, PPTX reopen, slide count and rendered appearance.
