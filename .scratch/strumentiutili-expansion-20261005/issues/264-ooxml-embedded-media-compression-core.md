# 264 — OOXML embedded-media compression core

**What to build:** Add shared media recompression/resizing inside valid OOXML packages on top of safe package rebuild and accepted image codecs, preserving relationships and editable structure.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 207, 208, 225.

**Status:** blocked

**Suggested skills:** security-audit → code-module-design → code-tdd → browser-performance-benchmark

- [ ] Only supported embedded raster media is changed.
- [ ] Relationship targets and package validity remain intact.
- [ ] Result reports media changed/skipped, bytes saved and fidelity warning.

**Verification:** DOCX/PPTX/XLSX media-heavy corpus and independent reopen.
