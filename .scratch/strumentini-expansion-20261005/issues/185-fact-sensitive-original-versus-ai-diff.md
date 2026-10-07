# 185 — Fact-sensitive original versus AI diff

**What to build:** Add deterministic diff mode that promotes changed lexical numbers, dates, URLs and IDs above cosmetic edits without claiming factual truth.

**Traces to:** US-EXP-08; AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [x] Fact-sensitive markers are defined lexically and documented.
- [x] Formatting-only changes can be separated.
- [x] No claim that unchanged tokens are factually correct is made.

**Verification:** Worked text pairs with numbers/dates/URLs/formatting.

**Evidence (2026-10-06):** `factSensitiveTextDiff` lexically classifies URLs, dates, numbers and digit-bearing structured IDs before the ordinary diff and separately reports whitespace-only edits. The UI presents those marker changes first and states that no factual truth is inferred. Focused marker/formatting tests pass; cand-232 binds `text-expansion`.
