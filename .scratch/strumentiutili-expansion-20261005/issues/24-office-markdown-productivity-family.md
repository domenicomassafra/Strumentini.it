# 24 — Office/Markdown productivity family

**What to build:** Add capability-gated local workflows for Markdown→DOCX, Office viewers/metadata cleanup/compression and related productivity jobs proven feasible by the heavy-runtime spike.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2, AC-06.1; DEC-EXP-05; C-EXP-05, C-EXP-08

**Constraints:** Do not ship a parser/converter merely because a library exists; preserve document semantics only within declared scope; password removal requires a user-supplied password and supported format.

**Blocked by:** 01 — Result System v2; 23 — spreadsheet interchange; 34 — feasibility refresh.

**Status:** blocked

- [ ] Each accepted format has a declared supported-feature matrix.
- [ ] Heavy dependencies load only on relevant routes after explicit file selection/action.
- [ ] Metadata cleanup reports what was removed and re-inspects output.
- [ ] Unsupported document features survive where possible or trigger a clear warning.

**Verification:** Representative DOCX/ODT/PPTX/ODP fixtures, output re-open tests, dependency/bundle gate and mobile memory acceptance.
