# 256 — TXT Markdown HTML and CSV to printable PDF

**What to build:** Build one local print-layout engine for deterministic text/markup/table→PDF with page size, orientation, margins, fonts, wrapping and page-number controls.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 54, 103, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → design-impeccable → code-module-design → code-tdd

- [ ] TXT/MD/HTML/CSV map through explicit format-specific content rules.
- [ ] Long text/tables paginate without clipping/overlap.
- [ ] Output pages/size/layout warnings are reported.

**Verification:** Render-to-image visual inspection for long text/table/Unicode/page-break corpus.
