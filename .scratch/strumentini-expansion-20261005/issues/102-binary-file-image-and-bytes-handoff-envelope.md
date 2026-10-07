# 102 — Binary file image and bytes handoff envelope

**What to build:** Generalize current CSV-only handoff to bounded same-origin file/image/bytes envelopes using explicit descriptors and safe transfer/storage, enabling real continue-with workflows without re-upload.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-10.1

**Constraints:** C-EXP-05, C-EXP-08, C-EXP-09; same-origin and size/type validation; no raw bytes in URL fragment.

**Blocked by:** 75, 76, 100.

**Status:** completed

**Suggested skills:** code-module-design → security-audit → code-typescript → code-tdd → qa-browser

- [x] Descriptors validate against target manifest declarations.
- [x] Oversize/incompatible target fails before transfer.
- [x] Existing CSV handoff remains compatible and binary payload is ephemeral.

**Verification:** Origin/token/type/size security cases plus binary round-trip and CSV regression.

**Evidence (2026-10-06):** `src/runtime/binary-handoff.ts` accepts only verified artifact descriptors, validates target `handoff.accepts` type/format/size declarations before transfer, caps ephemeral payloads at 64 MiB, uses a same-origin window/token handshake and puts only the opaque token in the URL fragment. `tests/binary-handoff.test.ts` proves incompatible/oversize rejection, origin/source/token/phase guards, structured-clone binary round-trip and compatibility with the existing CSV handoff; the focused handoff/result graph suite passes 19/19 related tests, and `npx tsc --noEmit` plus scoped diff-check pass.
