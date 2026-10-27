# 309 — Italian syllabification feasibility spike

**What to build:** Research a defensible Italian syllabification ruleset/library/source and record IMPLEMENT or REFUSE with ambiguity cases; do not ship heuristic syllables as authoritative.

**Traces to:** US-EXP-03; AC-09.1

**Constraints:** C-EXP-02, C-EXP-03; feasibility only; no fake linguistic certainty.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** research-primary-sources → plan-tickets → code-tdd

- [x] Rules/source/licence and known ambiguity boundaries are documented.
- [x] Evaluation corpus includes apostrophes, digraphs, hiatus/diphthongs and foreign words.
- [x] If quality/source is insufficient the feature remains refused.

**Verification:** Primary-source/library evaluation report and held-out word corpus.

**Evidence (2026-10-06):** `docs/RESEARCH-DECISIONS-2026-10-27.md` records **REFUSE** for an authoritative syllabification feature after comparing Treccani rules with the maintained `hyphen@1.14.1` Italian typographic-hyphenation path and its underlying `hyph-it` licence/source. `quality/fixtures/italian-syllabification/corpus.json` includes apostrophe, digraph, hiatus/diphthong/triphthong, consonant-cluster and foreign-word cases plus concrete source-backed mismatches; `tests/italian-syllabification-feasibility.test.ts` passes 3/3 and `npx tsc --noEmit` passes. No production syllabifier or dependency was added.
