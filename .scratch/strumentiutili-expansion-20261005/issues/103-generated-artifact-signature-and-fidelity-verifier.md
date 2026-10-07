# 103 — Generated artifact signature and fidelity verifier

**What to build:** Build reusable post-generation verification adapters that inspect actual signature/container/type and attach fidelity/loss evidence before a generated artifact can be marked successful.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2, AC-09.1

**Constraints:** C-EXP-01, C-EXP-02, C-EXP-05; never self-certify from requested extension.

**Blocked by:** 76, 100.

**Status:** completed

**Suggested skills:** code-module-design → security-audit → code-tdd

- [x] Common output signatures return measured type/mismatch reason.
- [x] Format adapters can add reopen/parse/pixel/page/relationship proof.
- [x] Failed verification prevents a misleading success state.

**Verification:** Known-good, wrong-extension, truncated and malformed representative files.

**Evidence (2026-10-06):** `src/runtime/artifact-verifier.ts` measures PNG/JPEG/GIF/WebP/PDF/ZIP/GZIP signatures and basic container completeness from bytes, compares the measured MIME with the declared MIME and accepts independent reopen/parse proof with structured facts. Failed signature/container/MIME/reopen verification creates an invalid output descriptor whose download is not ready. `tests/artifact-verifier.test.ts` plus `tests/format-evidence.test.ts` pass 9/9 representative good, mismatch, truncated and failed-reopen cases; `npx tsc --noEmit` and scoped diff-check pass.
