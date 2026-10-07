# 107 — Related-tool and handoff graph policy

**What to build:** Replace heuristic same-category suggestions with deterministic compatible-job/input-output edges where evidence exists, capability-gating transfers that runtime cannot actually perform.

**Traces to:** US-EXP-10; AC-10.1; DEC-EXP-01

**Constraints:** C-EXP-05, C-EXP-09; no self-links, duplicate edges or unsupported handoff theater.

**Blocked by:** 75, 102, 104.

**Status:** completed

**Suggested skills:** code-architecture-review → interaction-design → code-tdd

- [x] Graph excludes self/duplicate/unsupported edges.
- [x] Handoff edge exists only when source artifact and target declaration are compatible.
- [x] Non-transfer related-tool suggestions remain distinct from executable handoffs.

**Verification:** Graph unit fixtures plus representative chained browser workflow.

Evidence (2026-10-06): `src/runtime/related-tool-graph.ts` builds a deterministic graph from the canonical generated catalog plus `handoff-catalog`, rejects duplicate ids/routes, dead or misaligned routes and stale handoff projections, bounds related suggestions to four, and de-duplicates executable edges per target/runtime. Executable edges are capability-gated to the runtimes that exist today: exact `table/csv` for the existing CSV handoff and `file|image|bytes` for binary handoff v1; other declared descriptor/job/input matches remain non-transfer related evidence. `tests/related-tool-graph.test.ts` includes sabotage cases for self-links, overlapping descriptors, unsupported date-time/structured runtimes, route drift and CSV format mismatch. Focused handoff/graph tests pass 21/21; `npm run catalog:check`, `npx tsc --noEmit`, and `git diff --check` pass. A fresh `npx astro build` generated all 220 pages, and `node scripts/acceptance-table-handoff.mjs` passed the real same-origin Cleaner→Dedupe chained browser workflow with no payload persistence/task-content network transfer. Generated HTML also confirms executable `csv-cleaner -> csv-dedupe` is not duplicated in the related rail, while non-transfer `csv-to-json -> json-to-csv` remains visible as a related suggestion.
