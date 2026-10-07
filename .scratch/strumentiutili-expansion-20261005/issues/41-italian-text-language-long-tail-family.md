# 41 — Italian text/language long-tail family

**What to build:** Add Italian-focused and high-value text jobs not already covered: Gulpease readability with sentence hints, syllabification only if a defensible rule engine is available, mojibake/encoding repair, PDF-copy reflow, strip-Markdown-with-diff, phone/link/hashtag/mention extractors, indentation/tab cleanup, line-length/order transforms, title/sentence casing refinements, and reusable numeric extraction summaries.

**Traces to:** US-EXP-03, US-EXP-08, US-EXP-10; AC-05.1, AC-08.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-07

**Constraints:** Do not duplicate an existing text tool under a new name when an alias/mode suffices; language metrics explain limits rather than grading prose as objectively good/bad.

**Blocked by:** 187, 188, 189, 190, 309.

**Status:** completed

- [x] Existing text-writing/shared seams were extended with modes/aliases where appropriate; only distinct jobs received new canonical routes, while syllabification was refused rather than duplicated with an undefended rule engine.
- [x] Ticket 187 reports Gulpease score interpretation plus the concrete sentence-level indicators used to explain difficult passages, without grading prose as objectively good/bad.
- [x] Tickets 188–189 expose before→after/change information for mojibake repair and PDF-copy reflow; reversible claims are limited to transforms that actually preserve enough information to restore source semantics.

**Verification:** `tests/text-expansion.test.ts` covers Italian readability fixtures, mojibake/reflow and extractor edge cases; the text catalog/deduplication suites verify canonical route reuse. Ticket 309 records the evidence-backed REFUSE decision for syllabification instead of shipping a weak duplicate implementation.
