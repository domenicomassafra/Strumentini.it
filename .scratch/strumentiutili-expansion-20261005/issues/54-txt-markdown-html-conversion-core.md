# 54 — TXT/Markdown/HTML conversion core

**What to build:** Create one normalized document-model conversion core for truthful local transforms among TXT, Markdown and HTML, then expose high-intent routes such as MD→HTML, HTML→MD, MD→TXT, TXT→HTML and HTML→TXT with sanitized preview and explicit structure-loss reporting.

**Traces to:** US-EXP-04, US-EXP-08, US-EXP-10; AC-05.1, AC-08.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-07

**Constraints:** No invented semantic structure; HTML sanitization is mandatory for preview; CommonMark/GFM differences are explicit; whitespace-sensitive HTML elements are preserved correctly.

**Blocked by:** 01.

**Status:** blocked

- [ ] Each direction documents preserved and dropped constructs.
- [ ] Markdown/HTML inputs have side-by-side source/rendered or source/result preview where useful.
- [ ] Downloads use correct extensions/encoding and preserve Unicode/newlines deterministically.

**Verification:** CommonMark/GFM/HTML fixture suite, XSS/sanitization tests, round-trip/idempotence expectations and encoding/newline cases.

