# 54 — TXT/Markdown/HTML conversion core

**What to build:** Create one normalized document-model conversion core for truthful local transforms among TXT, Markdown and HTML, then expose high-intent routes such as MD→HTML, HTML→MD, MD→TXT, TXT→HTML and HTML→TXT with sanitized preview and explicit structure-loss reporting.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-05.1, AC-08.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-07

**Constraints:** No invented semantic structure; HTML sanitization is mandatory for preview; CommonMark/GFM differences are explicit; whitespace-sensitive HTML elements are preserved correctly.

**Blocked by:** 81 — Semantic result-class conformance harness.

**Status:** completed

- [x] Each direction documents preserved and dropped constructs.
- [x] Markdown/HTML inputs have side-by-side source/rendered or source/result preview where useful.
- [x] Downloads use correct extensions/encoding and preserve Unicode/newlines deterministically.

**Verification:** CommonMark/GFM/HTML fixture suite, XSS/sanitization tests, round-trip/idempotence expectations and encoding/newline cases.

**Evidence (2026-10-06):** `src/engines/text-markup-conversion/index.ts` implements one normalized block/inline document model for Markdown→HTML, HTML→Markdown, Markdown→TXT, TXT→HTML and HTML→TXT; the existing `markdown-preview` route now reuses the same core. `quality/fixtures/text-markup-conversion/vectors.json` + `tests/text-markup-conversion.test.ts` cover exact five-direction literals, CommonMark/GFM scope disclosure, active-content/unsafe-link XSS cases, supported-subset round-trip stability, CRLF/CR→LF determinism, decomposed Unicode preservation, `<pre>/<code>` whitespace and `<textarea>` RCDATA. `scripts/acceptance-text-markup-converter.mjs` passed at 390px against the existing Astro dev server with sanitized preview, no live raw-Markdown HTML, Markdown download, preserved preformatted whitespace and no external/write task request. Result v2 inventory/migration tests and the ticket-scoped oracle validator pass; full catalog/build gates may temporarily depend on concurrently added tools outside ticket 54.
