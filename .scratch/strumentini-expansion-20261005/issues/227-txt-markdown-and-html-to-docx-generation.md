# 227 — TXT Markdown and HTML to DOCX generation

**What to build:** Generate valid DOCX from normalized TXT/MD/HTML using an explicit simple style template, mapping supported headings/lists/tables/code/links/images without inventing structure.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** none; tickets 54/103/225 are complete and the bounded generator independently reopens its package.

**Status:** completed (bounded simple-style semantic DOCX generation)

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] OOXML output reopens independently.
- [x] Unsupported constructs are listed rather than silently approximated.
- [x] Unicode/newlines and simple style template are deterministic.

**Verification:** Golden semantic inputs, OOXML package validation and independent reopen.

**Evidence (2026-10-07 downstream):** `generateDocxFromSemanticText` produces a minimal deterministic DOCX package from bounded TXT/Markdown/HTML semantics using explicit Normal/Heading1–6/CodeBlock/Hyperlink styles plus simple bullet/decimal numbering. Supported generation covers paragraphs/newlines, headings, lists, fenced code, bounded tables and inert external hyperlink relationships. HTML active containers (`script/style/iframe/object/embed/template`) are dropped without execution. Image references are never fetched or silently embedded: they become visible text placeholders and are listed in `unsupportedConstructs`. Output is immediately validated by the independent OOXML analyzer and semantically reopened; `scripts/check-office-ooxml-reopen.ts` additionally writes a generated DOCX to disk and `/usr/bin/unzip -t` reports no errors before semantic reopen. Browser acceptance generates and reopens `Browser DOCX` inside an isolated worker. This is a simple semantic template, not Word layout reproduction.
