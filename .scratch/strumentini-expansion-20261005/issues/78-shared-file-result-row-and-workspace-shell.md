# 78 — Shared file result row and workspace shell

**What to build:** Add the shared local-file workspace/result row for file, image, PDF and later Office/media jobs: detected type, name, size, status/progress, before→after facts, actions and multi-file composition.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1

**Constraints:** C-EXP-04, C-EXP-05, C-EXP-09; extend current design system, no second dropzone language.

**Blocked by:** 72, 76.

**Status:** completed

**Suggested skills:** interaction-design → design-impeccable → inclusive-design → qa-browser

- [x] Single and multi-file rows share one contract.
- [x] Progress/cancel/retry are coherent and recoverable.
- [x] Privacy copy reflects actual runtime/network policy.

**Verification:** Long-name/mixed-file/cancel-retry fixtures at desktop and 390px.

**Evidence:** tests/file-result-workspace.test.ts proves single/multi-file rows, progress/cancel/retry coherence and runtime-policy privacy copy; shared FileResultWorkspace is exercised by migrated file/image/PDF families.
