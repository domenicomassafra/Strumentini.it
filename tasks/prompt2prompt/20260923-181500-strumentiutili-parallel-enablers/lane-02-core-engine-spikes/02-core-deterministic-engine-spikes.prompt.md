<external-worker-contract>
You are an owner-launched external worker operating directly inside `/Users/domenico/Code/StrumentiUtili.it`. Execute this lane. Own only the spike paths below and your response. Preserve concurrent work. No destructive git operations. Before ending for any reason, save the response file as the final filesystem action. Chat reply only with its absolute path.
</external-worker-contract>

# Mission

Build **real, isolated, production-quality-leaning spikes** for the deterministic primitive engines we are almost certain to need, without waiting for the final app shell.

These are not production integration and must live under `spikes/core-engines/`.

Use:

- `code-module-design`
- `code-tdd`
- `code-typescript`
- `code-implement`
- Ponytail/native-first rules embedded in `code-implement`

# Inputs

Read:

- `docs/architecture/lane-05-tool-factory-architecture.md`
- `docs/architecture/lane-05-test-seams-and-acceptance.md`
- `docs/07-tool-factory-quality-standard.md`
- `research/lanes/01-market-demand-jobs-census.md`
- `research/platform-decision-spike-2026-09-23.md`

# Lane ownership

Own only:

- `spikes/core-engines/**`
- `research/lanes/07-core-engine-spike-results.md`
- this lane's response file

Do NOT edit root package/build files or canonical product/spec/design docs.

# Required engines

Implement and test reusable pure modules for at least these families where dependency-free/native implementation is sensible:

1. text normalization/stats;
2. list set/diff/dedupe;
3. URL/query-string parse/normalize/tracking-clean;
4. UTM build/parse primitives;
5. date/duration arithmetic not requiring external holiday data;
6. business math primitives: rate conversion, margin/markup, profitability, fee gross-up;
7. encoding/hash primitives using Web Crypto/native APIs where possible;
8. filename sanitization/rename-plan primitives;
9. JSON format/validate primitives;
10. profile-default merge/provenance helper if it can remain UI/framework independent.

Do **not** implement CSV/YAML/PDF/image codecs here if a real third-party/parser spike is more appropriate.

Choose an isolated test/runtime setup that does not commit the product to a frontend framework. Inspect installed runtimes first; prefer what is already available. Keep dependency count minimal.

For each engine:

- define a narrow public seam;
- write independent known-answer tests before/with implementation;
- include boundary/Unicode/invalid-input cases;
- prove the tests bite where practical;
- document what should be promoted vs discarded.

The goal is to return **working reusable code**, not architecture prose.

# Constraints

- no app UI;
- no Astro/Preact commitment;
- no network calls;
- no server code;
- no hidden global state;
- deterministic outputs;
- prefer Web APIs/stdlib;
- no speculative plugin framework.

# Verification

- every implemented engine has runnable tests;
- all tests observed green;
- typecheck/lint if the isolated spike setup supports them;
- sabotage/pre-fix proof for at least 3 nontrivial behaviors;
- `git diff --check` clean;
- record exact runtime/dependencies and bundle-neutrality assumptions.

# Response file

`/Users/domenico/Code/StrumentiUtili.it/tasks/prompt2prompt/20260923-181500-strumentiutili-parallel-enablers/lane-02-core-engine-spikes/02-core-deterministic-engine-spikes.response.md`

Use standard Prompt2Prompt terminal schema.

Required headers: `Status: COMPLETE | PARTIAL | BLOCKED`, `Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`, `Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`, plus Attempt, Response-Covers-Through, Updated-At, Prompt and Lane. Required sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.
