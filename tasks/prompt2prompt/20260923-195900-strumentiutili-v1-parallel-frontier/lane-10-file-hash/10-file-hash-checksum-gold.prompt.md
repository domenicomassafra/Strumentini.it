<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/StrumentiUtili.it`. Execute Ticket 10 on shared `main`, preserve concurrent work, stage only owned paths, and do not edit frozen package/spec files. No branch/worktree/stash. Response file must be the final filesystem action.
</external-worker-contract>

# Mission

Implement **Ticket 10 — File Hash / Checksum Verifier Gold vertical** with bounded incremental local hashing.

# Inputs / skills

Apply `code-implement`, `code-tdd`, `code-module-design`, `browser-performance-benchmark`, security review.

Read:

- Ticket 10;
- heavy-browser hashing evidence and benchmark receipts;
- OSS donor matrix;
- `quality/fixtures/sha2-known-answers`, `file-hash`;
- Ticket 01 production seams.

# Shared evaluation packages already pinned

- `hash-wasm` 4.12.0
- `@noble/hashes` 2.4.0

Do not edit package files. Compare both, choose exactly one production incremental implementation, and record the loser as evaluation-only. Coordinator will remove the loser after integration.

# Lane ownership

Own only:

- `src/engines/file-hash/**`
- `src/tools/file-hash/**`
- `src/components/tools/file-hash/**`
- `src/pages/tools/file-hash.astro`
- `tests/file-hash*.test.ts`
- `scripts/gold/file-hash*.ts`
- `scripts/acceptance-file-hash.mjs`
- `quality/receipts/file-hash/**`
- `research/implementation/10-hash-dependency-gate.md`
- `.scratch/strumentiutili-v1/issues/10-file-hash-checksum-gold-vertical.md`
- lane response

# Required behavior

- compare exact versions/licenses/security/browser-worker/bundle/throughput/progress/cancel/memory;
- explicit supported algorithm list; SHA-256 minimum, others only with oracle support and product justification;
- published vectors and Web Crypto bounded oracle;
- incremental File/Blob reading with bounded chunks; multi-gigabyte design must not full-buffer;
- internal chunk-size invariance;
- expected checksum parser normalizes only documented representation differences;
- progress truthful and cancellation cannot emit success;
- read/worker/algorithm/malformed-checksum failures normalized;
- no filename/hash/content telemetry and no upload;
- mobile file picker;
- lazy dependency/worker loading;
- Gold receipt linked to existing oracle/fixture authorities.

# Verification

Known-answer vectors, independent Web Crypto cross-check, chunk-size invariance, large synthetic File/Blob benchmark, cancel/failure injection, LOCAL request/content scan, mobile viewport file flow, dependency/bundle report, existing Ticket 01 verification, typecheck/build/diff-check.

# Response file

`/Users/domenico/Code/StrumentiUtili.it/tasks/prompt2prompt/20260923-195900-strumentiutili-v1-parallel-frontier/lane-10-file-hash/10-file-hash-checksum-gold.response.md`

Use standard Prompt2Prompt terminal schema.


Required response headers:

`Status: COMPLETE | PARTIAL | BLOCKED`
`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`
`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
`Attempt: <positive integer>`
`Response-Covers-Through: <lane commit or exact covered HEAD>`
`Updated-At: <ISO-8601 timestamp with timezone>`
Then include Prompt and Lane, followed by sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.

