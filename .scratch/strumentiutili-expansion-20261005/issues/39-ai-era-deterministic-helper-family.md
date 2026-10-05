# 39 — AI-era deterministic helper family

**What to build:** Add local helpers for extracting named code fences/files from chat output into a ZIP, reversible long-text chunking, original-vs-AI-edited diff with numbers/dates highlighted, PDF-copy text reflow, Markdown stripping with change disclosure, and stable-placeholder anonymize→restore for text/tables.

**Traces to:** US-EXP-08, US-EXP-09, US-EXP-10; AC-08.1, AC-10.1; DEC-EXP-02, DEC-EXP-07; C-EXP-05, C-EXP-07

**Constraints:** Deterministic only; never send content to an LLM; restore must refuse ambiguous/corrupted placeholders rather than inserting the wrong private value.

**Blocked by:** 01, 23.

**Status:** blocked

- [ ] Code extraction preserves file names when explicit and sanitizes paths before ZIP creation.
- [ ] Chunking is reversible and emits numbered/context-preserving boundaries.
- [ ] AI diff promotes changed numbers/dates/facts above cosmetic edits.
- [ ] Anonymize/restore mapping stays local and detects missing/duplicated/mutated placeholders.

**Verification:** Adversarial fenced-code/path fixtures, exact chunk round-trip, structured diff cases, anonymization round-trip and secret-leak network/telemetry assertions.

