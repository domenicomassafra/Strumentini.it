# 105 — Italian search-intent regression corpus

**What to build:** Create an Italian query corpus for high-intent jobs, formats, aliases and shared-engine routes plus zero-result recovery, then make ranking regressions mechanically visible.

**Traces to:** US-EXP-10; AC-10.1

**Constraints:** C-EXP-03, C-EXP-04; no fake popularity ranking.

**Blocked by:** 104 — Canonical job identity and duplicate-route policy.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] Specific job query ranks its intended route above generic siblings.
- [x] Format aliases and common Italian phrasing resolve consistently.
- [x] Zero-result state offers bounded recovery without fabricating matches.

**Verification:** Search unit ranking plus command palette and /cerca browser fixtures.

**Verified:** `quality/fixtures/search-intent-it/corpus.json` covers 40 ranked Italian intents across PDF, images, CSV, text, dates, developer and marketing, plus 4 bounded typo recoveries and 6 deliberately unsupported intents that must stay at zero matches. `npm run search:intent-it`, `tests/search-ranking.test.ts`, `tests/search-intent-it.test.ts`, `npm run catalog:check` and `npx tsc --noEmit` pass. Fresh `scripts/acceptance-directory.mjs` passes `/cerca` and command-palette discovery with focus restoration, URL/reload/back persistence, 390px behavior and zero eager tool chunks. Generated search metadata preserves historical manifest keywords while adding only explicit localized `searchTerms`; no query→tool table was added to the search engine.
