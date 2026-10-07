# 193 — Semantic HTML minifier

**What to build:** Add parser-backed HTML minification with safe/default and explicitly advanced modes, preserving meaningful whitespace in pre/textarea/inline text contexts.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-typescript → security-audit → code-tdd

- [x] Safe mode preserves text meaning and sensitive whitespace contexts.
- [x] Invalid/unsupported constructs produce warning/refusal rather than corrupt output.
- [x] Scripts/styles are treated as content with parser-aware rules, not regex.

**Verification:** Whitespace-sensitive HTML corpus and DOM/text equivalence checks.

**Evidence (2026-10-06):** `htmlMinifyOperation` uses parse5. Safe mode preserves every parsed text node while removing ordinary comments; advanced mode explicitly removes bounded block-layout whitespace. pre/textarea/script/style are untouched, conditional comments warn/preserve and parse errors refuse output. Focused DOM/text/sensitive-whitespace tests pass; cand-239 binds `developer-minifiers`.
