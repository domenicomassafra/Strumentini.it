# 184 — Reversible semantic text chunker

**What to build:** Split long text by paragraph/sentence boundaries into stable numbered chunks with optional overlap represented separately so declared join reconstructs source exactly.

**Traces to:** US-EXP-08; AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Default round-trip reproduces source under declared newline policy.
- [x] Overlap metadata cannot duplicate text silently during restore.
- [x] Chunk size/boundary rules are deterministic.

**Verification:** Exact round-trip property tests and long Unicode corpus.

**Evidence (2026-10-06):** `chunkSemanticText` stores canonical contiguous source spans and separate `overlapBefore` metadata; `restoreSemanticChunks` rejects any non-contiguous or mutated sequence. `tests/text-expansion.test.ts` proves exact CRLF/Unicode round-trip, overlap exclusion, deterministic boundaries and mutation refusal; cand-231 binds `text-expansion`.
