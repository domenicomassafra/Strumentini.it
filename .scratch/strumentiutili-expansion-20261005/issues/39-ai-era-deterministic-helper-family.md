# 39 — AI-era deterministic helper family

**What to build:** Add local helpers for extracting named code fences/files from chat output into a ZIP, reversible long-text chunking, original-vs-AI-edited diff with numbers/dates highlighted, PDF-copy text reflow, Markdown stripping with change disclosure, and stable-placeholder anonymize→restore for text/tables.

**Traces to:** US-EXP-08, US-EXP-09, US-EXP-10; AC-08.1, AC-10.1; DEC-EXP-02, DEC-EXP-07; C-EXP-05, C-EXP-07

**Constraints:** Deterministic only; never send content to an LLM; restore must refuse ambiguous/corrupted placeholders rather than inserting the wrong private value.

**Blocked by:** 54, 165, 183, 184, 185, 186, 189.

**Status:** completed

- [x] Ticket 183 preserves explicit safe file-name hints, generates deterministic fallbacks/duplicate suffixes, and refuses absolute/traversal paths before store-only ZIP creation.
- [x] Ticket 184 provides reversible semantic chunking with numbered/context-preserving boundaries and exact join semantics.
- [x] Ticket 185 promotes changed numbers/dates/fact-like tokens above cosmetic lexical changes without calling an LLM.
- [x] Ticket 186 keeps stable-placeholder anonymize/restore mappings local and refuses missing, duplicated or mutated placeholders instead of substituting the wrong private value.

**Verification:** `tests/file-privacy-engine.test.ts` covers fenced-code/path/ZIP parity; `tests/text-expansion.test.ts` covers chunk round-trip, fact-sensitive diff and anonymization restore/refusal. All participating manifests are LOCAL/network-forbidden and their Result v2 paths retain the shared privacy boundary.
