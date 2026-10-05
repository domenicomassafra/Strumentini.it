# 41 — Italian text/language long-tail family

**What to build:** Add Italian-focused and high-value text jobs not already covered: Gulpease readability with sentence hints, syllabification only if a defensible rule engine is available, mojibake/encoding repair, PDF-copy reflow, strip-Markdown-with-diff, phone/link/hashtag/mention extractors, indentation/tab cleanup, line-length/order transforms, title/sentence casing refinements, and reusable numeric extraction summaries.

**Traces to:** US-EXP-03, US-EXP-08, US-EXP-10; AC-05.1, AC-08.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-07

**Constraints:** Do not duplicate an existing text tool under a new name when an alias/mode suffices; language metrics explain limits rather than grading prose as objectively good/bad.

**Blocked by:** 01.

**Status:** blocked

- [ ] Existing case/whitespace/list/text tools gain modes/aliases where appropriate instead of duplicate routes.
- [ ] Gulpease result shows score interpretation and the concrete sentences driving difficulty indicators.
- [ ] Encoding/reflow transforms show before→after/change counts and remain reversible where claimed.

**Verification:** Italian language fixtures, mojibake corpus, extractor false-positive cases, route-deduplication assertions, and copy/download acceptance.

