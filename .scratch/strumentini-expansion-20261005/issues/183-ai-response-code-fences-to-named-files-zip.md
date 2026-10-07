# 183 — AI response code fences to named files ZIP

**What to build:** Deterministically parse code fences/file-name hints from pasted AI output into a preview tree and safe ZIP without any LLM call.

**Traces to:** US-EXP-08; AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 222 — Real ZIP DEFLATE compression tranche.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-typescript → code-tdd → inclusive-design

- [x] Explicit absolute, drive-qualified, NUL and parent-traversal paths fail closed through the shared archive path policy before ZIP construction; safe path segments use the existing filename sanitizer.
- [x] Unnamed fences receive deterministic `snippet-NNN` names with language-derived extensions, while case-insensitive duplicate names receive `-2`, `-3`, ... suffixes.
- [x] Preview metadata and the store-only ZIP are created from the same parsed file list; tests reopen the ZIP central directory and prove its ordered paths exactly equal the preview list.

**Verification:** `tests/file-privacy-engine.test.ts` covers explicit/generated names, duplicate suffixes, unclosed fences, traversal/absolute refusal and independent central-directory parity. Oracle `cand-251` binds CommonMark fence structure, PKWARE ZIP facts and the synthetic fixture corpus. No LLM/network request or DEFLATE promotion is involved.
