# 217 — Visual PDF split delete and extract selector

**What to build:** Add thumbnail multi-select plus one shared range parser for every page, every N, ranges, custom groups and selected pages, with ZIP multi-output where applicable.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 222.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Text range and thumbnail selection resolve to the same page identities.
- [ ] Invalid ranges report exact offending token.
- [ ] Output grouping/names are previewed and ZIP integrity verified.

**Verification:** Range properties, page hashes, ZIP checks and 390px keyboard QA.
