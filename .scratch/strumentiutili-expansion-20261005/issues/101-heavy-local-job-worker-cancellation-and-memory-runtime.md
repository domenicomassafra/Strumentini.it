# 101 — Heavy local-job worker cancellation and memory runtime

**What to build:** Create shared worker-backed execution for codec/OCR/Office/media jobs with progress, cancel, deterministic cleanup and explicit memory/file ceilings.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1; DEC-EXP-05

**Constraints:** C-EXP-01, C-EXP-08; no unbounded duplicate buffers; release resources on cancel.

**Blocked by:** 72, 100.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → browser-performance-benchmark

- [x] Long jobs expose monotonic progress or honest indeterminate state.
- [x] Cancel releases worker/object URL/buffer resources.
- [x] Size/memory ceiling fails before OOM-risk work.

**Verification:** Controlled worker cancel/retry/cleanup plus runtime/memory benchmark receipts.

Evidence (2026-10-06): `src/runtime/heavy-local-job.ts` reuses ticket 100 preflight and provides the shared worker protocol, deterministic cancellation/stale suppression, explicit transfer/owned-resource cleanup, monotonic progress enforcement, a local-only `networkPolicy: "forbidden"` start contract, and hard dynamic working-set accounting. `tests/heavy-local-job.test.ts` + `tests/heavy-preflight.test.ts` pass 15/15 focused tests, including cancel-time input-buffer release and optional worker failure `code` preservation as `workerCode` under `exactOptionalPropertyTypes`. `npx tsx scripts/acceptance-heavy-local-runtime.ts` writes `quality/benchmarks/heavy-local-runtime/controlled-runtime.json` with PASS receipts for success/cleanup, cancel+retry+stale suppression plus owned-resource release, dynamic resource breach, and preflight-before-worker. The runtime/tests/acceptance files contain no network API or URL use, and global `npx tsc --noEmit` passes.
