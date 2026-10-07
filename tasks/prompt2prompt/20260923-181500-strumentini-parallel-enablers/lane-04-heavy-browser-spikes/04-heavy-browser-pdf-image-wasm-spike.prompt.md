<external-worker-contract>
You are an owner-launched external worker in `/Users/domenico/Code/Strumentini.it`. Execute this lane only. Preserve concurrent work. No destructive git operations. Final filesystem action must be the response file; chat reply only with its path.
</external-worker-contract>

# Mission

De-risk the **heavy local browser-tool stack** so we know which PDF/image/archive/QR/metadata capabilities are realistically reusable and performant before the product tickets reach them.

This lane may create isolated runnable spikes but must not integrate production app code.

Use:

- `research-primary-sources`
- `github-repo-management`
- `security-audit`
- `browser-performance-benchmark`
- `code-module-design`
- `code-tdd`

# Inputs

Read:

- `research/platform-decision-spike-2026-09-23.md`
- `research/lanes/01-market-demand-jobs-census.md`
- `docs/07-tool-factory-quality-standard.md`
- `docs/architecture/lane-05-tool-factory-architecture.md`

# Lane ownership

Own only:

- `spikes/heavy-browser/**`
- `research/lanes/09-heavy-browser-dependency-spike.md`
- optional benchmark output under `quality/benchmarks/heavy-browser/**`
- this lane's response file

# Required work

Research and, where practical, run focused local/browser spikes for:

- PDF page merge/split/reorder/rotate;
- PDF rendering/text extraction/metadata as separate capability classes;
- image resize/crop/format conversion;
- JPEG/WebP/AVIF compression paths;
- EXIF read/remove;
- ZIP create/inspect;
- QR encode/decode;
- large-file incremental hashing;
- file-signature detection.

For every candidate library/approach compare:

- license;
- maintenance;
- browser support;
- bundle/WASM size;
- worker compatibility;
- memory behavior;
- mobile constraints;
- cancel/progress feasibility;
- security/advisories;
- quality limitations;
- exact Strumentini.it tool coverage.

Create at least **3 runnable isolated spikes** that exercise realistic browser-local operations with synthetic files and collect timing/memory/bundle evidence where tooling permits.

Do not force one library to solve every PDF/image job. Prefer deep capability-specific modules.

Explicitly recommend:

- what is safe for early Gold scope;
- what belongs in later heavy Wave C;
- what should be rejected entirely.

# Verification

- >=20 candidate approaches/libraries assessed;
- >=3 runnable spikes with observed output;
- synthetic/legal fixtures only;
- at least one mobile/memory risk analysis per heavy family;
- exact versions/licenses recorded;
- `git diff --check` clean.

# Response file

`/Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20260923-181500-strumentini-parallel-enablers/lane-04-heavy-browser-spikes/04-heavy-browser-pdf-image-wasm-spike.response.md`

Use standard Prompt2Prompt terminal schema.

Required headers: `Status: COMPLETE | PARTIAL | BLOCKED`, `Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`, `Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`, plus Attempt, Response-Covers-Through, Updated-At, Prompt and Lane. Required sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.
