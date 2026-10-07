# 55 — DOCX semantic conversion pack

**What to build:** Add local DOCX↔Markdown/HTML/TXT conversions and TXT/MD/HTML→DOCX generation using the normalized document model, with headings, lists, tables, links, images and code mapped where supported and unsupported Word constructs reported.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-04.1, AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** “Semantic conversion” is distinct from pixel-perfect Word layout; tracked changes, floating objects, complex fields/macros and unsupported styles are disclosed rather than silently misrepresented.

**Blocked by:** none; 226 and 227 are complete on the bounded semantic path.

**Status:** completed (bounded semantic pack; not pixel-faithful Word rendering)

- [x] DOCX→MD/HTML/TXT preserves recoverable document structure and extracts/links embedded assets safely.
- [x] MD/TXT/HTML→DOCX generates a valid OOXML document with an explicit simple style template.
- [x] Result includes unsupported/lost construct report and output structure counts.

**Verification:** DOCX fixture corpus with headings/lists/tables/images/hyperlinks/footnotes/styles, OOXML validation, round-trip semantic comparison and mobile memory receipt.

**Evidence (2026-10-07 downstream):** tickets 226/227 now share `src/engines/ooxml/office-semantics.ts`. DOCX extraction emits a deterministic block model for paragraphs, headings, lists, tables and safe hyperlink relationships plus explicit `structureCounts`; embedded image relationships are linked to inert package-part references with MIME/byte size and visible placeholders, but image bytes are not executed or rendered. TXT/Markdown/HTML generation uses an explicit simple style/numbering template, omits active HTML containers, never fetches image URLs, emits unsupported/loss notes and immediately reopens through the bounded analyzer + semantic extractor. `tests/office-downstream.test.ts` covers structure/link/table/newline/Unicode/active-HTML cases; `scripts/check-office-ooxml-reopen.ts` independently validates generated DOCX with `/usr/bin/unzip -t`; `quality/receipts/office-downstream/browser-acceptance.json` proves the heavy-worker path at 390px with zero external requests. This closes semantic conversion only: tracked/floating/field/layout/font fidelity remains explicitly outside scope.
