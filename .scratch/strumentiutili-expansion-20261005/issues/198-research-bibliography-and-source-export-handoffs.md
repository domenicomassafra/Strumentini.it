# 198 — Research bibliography and source export handoffs

**What to build:** Add explicit BibTeX/RIS/plain-table export and compatible handoffs among existing research tools while preserving source identity and never inventing missing metadata.

**Traces to:** US-EXP-01, US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 93 — Migrate research and reference renderers to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] Citation dedupe/sort table presentations retain title, DOI, ISBN, author/year and URL columns, and their complete Result v2 download is now a CSV artifact rather than a generic JSON dump. BibTeX/RIS converter downloads remain exact `.bib`/`.ris` artifacts.
- [x] Evidence-table export now carries an explicit ISBN column in addition to title/DOI; absent source fields serialize as empty cells and are never synthesized. The existing explicit source field still wins over hostname fallback where supplied.
- [x] Research table exports reuse the certified table/CSV handoff runtime only where a real lossless CSV table exists; RIS/BibTeX does not advertise a fabricated transfer runtime and instead retains exact local reuse. CSV cells keep the existing formula-prefix neutralization and RFC-style quoting.

**Verification:** `quality/fixtures/research-source-inventory/vectors.json`, `tests/research-knowledge-engine.test.ts` and `tests/research-result-v2.test.ts` cover DOI/ISBN/title identity, empty metadata, source/provenance separation, formula-safe CSV, complete table downloads and exact RIS/BibTeX conversion/reuse. Research manifests for citation/evidence table outputs declare only the supported `table/csv` handoff descriptor.
