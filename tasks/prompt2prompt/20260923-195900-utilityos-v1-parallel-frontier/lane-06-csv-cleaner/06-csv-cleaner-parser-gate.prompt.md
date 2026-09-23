<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/UtilityOS`. Execute Ticket 06 on shared `main`; preserve concurrent work and stage only lane-owned paths. No branch/worktree/stash. Package files are frozen: Papa Parse 5.7.0, csv-parse 7.0.2 and Papa types are already available for this gate. Final filesystem action must be the response file below.
</external-worker-contract>

# Mission

Implement **Ticket 06 — CSV parser gate + CSV Cleaner Gold vertical**.

# Required skills

Apply `code-implement`, `code-tdd`, `code-module-design`, `security-audit`, and `browser-performance-benchmark` where relevant.

# Inputs

Read:

- `.scratch/utilityos-v1/issues/06-csv-cleaner-parser-gate.md`
- `research/lanes/06-oss-github-donor-census.md` + donor matrix
- `quality/fixtures/csv-rfc4180/vectors.json`
- `quality/fixtures/csv-cleaning/vectors.json`
- `quality/oracles/registry.json`
- Ticket 01 runtime/catalog/tool conventions

# Lane ownership

Own only:

- `src/engines/table/**`
- `src/tools/csv-cleaner/**`
- `src/components/tools/csv-cleaner/**`
- `src/pages/tools/csv-cleaner.astro`
- `tests/csv*.test.ts`
- `scripts/gold/csv-cleaner*.ts`
- `scripts/acceptance-csv-cleaner.mjs`
- `quality/receipts/csv-cleaner/**`
- `research/implementation/06-csv-parser-gate.md`
- `.scratch/utilityos-v1/issues/06-csv-cleaner-parser-gate.md`
- this lane response

Do not edit package files or shared runtime/catalog compiler unless a ticket-01 bug blocks implementation; if blocked, report instead of casually widening ownership.

# Parser gate

Compare the already-pinned candidates **Papa Parse 5.7.0** and **csv-parse 7.0.2** against UtilityOS needs. Record:

- license/source;
- maintenance/security evidence already gathered + exact installed version audit;
- browser/worker compatibility;
- lazy production bundle size;
- adversarial correctness;
- streaming/cancel ergonomics;
- transitive runtime burden.

Choose exactly one production parser. Do not remove the losing evaluation package in this lane; coordinator cleans shared package deps after all responses.

# CSV Cleaner behavior

- ordinary local file picker, no upload;
- preview and deterministic change summary;
- bounded cleanup contract, not magical repair;
- BOM, delimiters/newlines, escaped quotes, trailing empties, ragged rows, duplicate/odd headers, malformed quotes, Unicode;
- independent semantic reparse/output validation;
- hard/soft size limits before unsafe allocation;
- perceptible processing state and cancellation where meaningful;
- mobile picker path independent of drag/drop;
- manifest default export so catalog auto-discovers it;
- Gold receipt resolves existing oracle/fixture authorities rather than making a duplicate registry.

# Verification

Run full adversarial corpus, large-input/cancel/failure tests, dependency/bundle gate, LOCAL browser request assertion, mobile file-flow acceptance, Gold fail-closed sabotage, existing Ticket 01 verification, typecheck/build/diff-check.

# Response file

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-195900-utilityos-v1-parallel-frontier/lane-06-csv-cleaner/06-csv-cleaner-parser-gate.response.md`

Use standard Prompt2Prompt terminal schema.


Required response headers:

`Status: COMPLETE | PARTIAL | BLOCKED`
`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`
`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
`Attempt: <positive integer>`
`Response-Covers-Through: <lane commit or exact covered HEAD>`
`Updated-At: <ISO-8601 timestamp with timezone>`
Then include Prompt and Lane, followed by sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.

