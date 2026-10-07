# 187 — Italian Gulpease readability

**What to build:** Add Gulpease score with visible letter/word/sentence intermediates, interpretation and difficult-sentence contributors while explaining metric limitations.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd → inclusive-design

- [x] Formula/intermediate counts are visible.
- [x] Italian sentence/token segmentation policy is documented.
- [x] Score is not presented as absolute writing quality.

**Verification:** Published worked examples plus punctuation/abbreviation cases.

**Evidence (2026-10-06):** `italianGulpeaseReadability` exposes formula, letter/word/sentence intermediates, declared Italian token/sentence policy, difficult-sentence contributors and limitations including the ~100-word sample caveat. Published interpretation examples at scores 60 and 72 are recorded from Lucisano/Piemontese-derived sources, and punctuation/abbreviation tests pass; cand-234 binds `text-expansion`.
