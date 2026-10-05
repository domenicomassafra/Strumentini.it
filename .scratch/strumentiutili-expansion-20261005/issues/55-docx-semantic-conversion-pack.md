# 55 — DOCX semantic conversion pack

**What to build:** Add local DOCX↔Markdown/HTML/TXT conversions and TXT/MD/HTML→DOCX generation using the normalized document model, with headings, lists, tables, links, images and code mapped where supported and unsupported Word constructs reported.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-04.1, AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** “Semantic conversion” is distinct from pixel-perfect Word layout; tracked changes, floating objects, complex fields/macros and unsupported styles are disclosed rather than silently misrepresented.

**Blocked by:** 34, 54.

**Status:** blocked

- [ ] DOCX→MD/HTML/TXT preserves recoverable document structure and extracts/links embedded assets safely.
- [ ] MD/TXT/HTML→DOCX generates a valid OOXML document with an explicit simple style template.
- [ ] Result includes unsupported/lost construct report and output structure counts.

**Verification:** DOCX fixture corpus with headings/lists/tables/images/hyperlinks/footnotes/styles, OOXML validation, round-trip semantic comparison and mobile memory receipt.

