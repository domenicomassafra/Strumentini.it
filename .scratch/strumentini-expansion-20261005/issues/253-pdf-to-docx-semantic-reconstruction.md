# 253 — PDF to DOCX semantic reconstruction

**What to build:** Implement a bounded editable DOCX reconstruction only after document-model and PDF extraction evidence, clearly labelling unsupported layout fidelity.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 220, 225, 226, 269.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 269 records `richConversion=REFUSE_UNPROVEN`; the existing PDF extraction and DOCX package seams do not establish a PDF→DOCX reconstruction fidelity contract.
- [x] No generated DOCX or layout-loss report is exposed without evidence supporting the semantic mappings.
- [x] No scanned-input/OCR fallback is claimed while the rich-conversion path is refused.

**Verification:** Closed as a refusal downstream of ticket 269. Reopen only after a bounded reconstruction path passes semantic fidelity and independent DOCX reopen checks.
