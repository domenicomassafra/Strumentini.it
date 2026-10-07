# 192 — Parser-backed CSS minifier

**What to build:** Add standards-grade/parser-backed CSS minification with syntax errors and safe output; regex minification is explicitly refused.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-typescript → security-audit → code-tdd

- [x] Invalid CSS yields exact/available diagnostic and no optimized artifact.
- [x] Strings/comments/custom properties are handled by parser semantics.
- [x] Input/output byte delta is measured.

**Verification:** CSS syntax/string/comment/custom-property corpus.

**Evidence (2026-10-06):** `cssMinifyOperation` parses/serializes through css-tree, rejects unbalanced/Raw/empty-declaration syntax with structured locations, preserves string/custom-property parser semantics and reports exact UTF-8 byte deltas. Invalid/comment/string/custom-property/idempotence tests pass; cand-238 binds `developer-minifiers`.
