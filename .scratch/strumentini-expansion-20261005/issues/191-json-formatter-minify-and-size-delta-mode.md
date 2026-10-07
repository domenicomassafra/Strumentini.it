# 191 — JSON formatter minify and size-delta mode

**What to build:** Upgrade existing JSON formatter with explicit prettify/minify modes, byte delta and complete download using the existing parser—not a duplicate route.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd

- [x] Invalid JSON never emits optimized output.
- [x] Minify/prettify use the same parser and parse to the same JSON value under the existing duplicate-key policy.
- [x] Byte delta uses `TextEncoder` encoded input/output bytes.

**Verification:** Focused developer-engine tests cover semantic parse equality, exact minified output, byte counts/delta and invalid-input refusal. Result v2 already exposes complete download for developer text-code tools.
