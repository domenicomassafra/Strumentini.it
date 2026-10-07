# 318 — PDF metadata inspect remove upgrade

**What to build:** Deepen metadata inspection/removal with richer fields, page/document provenance, before→after diff and reparse verification without removing unrelated content.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 98, 103.

**Status:** completed

**Suggested skills:** pdf → security-audit → code-tdd

- [x] Recognized metadata fields and unknown entries are distinguished.
- [x] Removed output is reparsed before success.
- [x] Page count/text baseline remains stable unless documented.

**Verification:** Metadata corpus, before/after reparse and baseline extraction.

**Evidence (2026-10-06):** Reused the existing `pdf-metadata-inspector`/`pdf-metadata-remover` routes and oracle IDs `cand-129`/`cand-130`; no new oracle ID was consumed. Inspection now partitions recognized PDF Info fields from unknown Info entries, retains per-entry `document-info` provenance and separately reports `/Type /Metadata` XMP object IDs. Metadata cleanup is a metadata-only rewrite (`flatten=false`): it removes the addressed Info/XMP carriers without intentionally flattening page/catalog interactive content, reparses the produced PDF, requires recognized/unknown/XMP metadata to be absent, requires page count to match, and compares the bounded page-text baseline whenever source extraction is supported; unsupported source text filters are reported as an unavailable baseline rather than falsely verified. Writer metadata detection now includes metadata streams, and the metadata-only Catalog clone preserves unrelated entries such as AcroForm/Names/OpenAction while page annotations remain intact. The synthetic upgrade fixture contains recognized Title/Author/ModDate, unknown `CustomKey`, XMP metadata and two pages of text. `tests/pdf-extraction-metadata-upgrades.test.ts` verifies recognized-vs-unknown/XMP classification, output reparse, page/text stability and preservation of existing link/AcroForm content; focused PDF suites pass 19/19. The isolated browser harness passes inspection/removal evidence at 390px with zero external/non-GET/task-body requests; `.scratch/strumentini-expansion-20261005/evidence/pdf-220-318-browser.json`. `python3 quality/oracles/validate.py` passes. No global receipt was rebound.
