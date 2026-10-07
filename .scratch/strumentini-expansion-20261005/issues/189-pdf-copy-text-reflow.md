# 189 — PDF-copy text reflow

**What to build:** Add deterministic reflow for pasted PDF-extracted text by repairing line wraps/hyphenation only under explicit rules, with before/after diff and original preserved.

**Traces to:** US-EXP-08; AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [x] No punctuation/word content is invented.
- [x] Hyphenation ambiguity is surfaced.
- [x] Change counts and original/result are both accessible.

**Verification:** Line-wrap/hyphen/column-like text corpus and idempotence.

**Evidence (2026-10-06):** `reflowPdfCopyText` joins paragraph wraps under explicit rules, preserves visible hyphens while surfacing ambiguity, removes only U+00AD at wraps, protects list/column-like lines and reports change counts. Focused wrap/hyphen/idempotence tests pass and Result v2 shows Prima/Dopo; cand-236 binds `text-expansion`.
