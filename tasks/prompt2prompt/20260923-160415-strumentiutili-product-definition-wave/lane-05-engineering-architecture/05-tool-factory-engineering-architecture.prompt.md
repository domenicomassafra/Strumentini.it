<external-worker-contract>
You are an owner-launched external coding worker operating directly inside the repository named below. Execute the assigned lane; do not merely describe how to do it.

Authority: explicit owner requirements and repository-local instructions outrank this prompt. Inspect current state before editing and use the available tools directly.

Ownership: change only this lane's scope. Assume other agents may be working concurrently. Preserve unrelated changes, never revert another lane, and do not overwrite a dirty shared file you do not own. Record a collision instead.

Engineering: solve the root cause, prefer the smallest complete change, validate every completion claim with runnable evidence, and distinguish observed truth from assumptions. Do not delegate this lane again unless the prompt explicitly authorizes it.

Git safety: stay on the current intended branch unless explicitly told otherwise. No force push, destructive reset/clean, hidden stash, or unrequested worktree/branch creation.

Completion: before ending this turn for ANY reason (completed work, blocker, external-platform timebox such as a ~25 minute reasoning limit, context/quota boundary, or voluntary handoff), create or refresh the response file named below as your final filesystem action. It must truthfully declare COMPLETE, PARTIAL, or BLOCKED; declare the continuation state and stop reason; record the attempt number and exact branch commit covered; and contain changes, tests/proof, commits, conflicts, blockers, residual work, and the exact next action. A time/context boundary is normally PARTIAL + CONTINUE_NOW, not BLOCKED.

Chat: after the response file is saved, reply only: Risposta salvata in: <absolute-response-path>
</external-worker-contract>

# Mission

Design the **engineering architecture and Tool Factory** that could support hundreds of high-quality StrumentiUtili.it tools while keeping runtime cost, bundle size and maintenance low.

Do not implement the production app in this wave. Produce an engineering plan strong enough that the next integrated wave can safely run `plan-tickets` and then `code-implement`/TDD.

Use:

- `/Users/domenico/.dstack/.agents/skills/code-module-design/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/plan-eng-review/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-tdd/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-typescript/SKILL.md` as implementation-language guidance only
- `/Users/domenico/.dstack/.agents/skills/code-implement/SKILL.md` to understand downstream execution expectations, but do not implement production code now

# Repository and current state

Repository: `/Users/domenico/Code/StrumentiUtili.it`

Read:

- `docs/02-architecture-hypothesis.md`
- `docs/07-tool-factory-quality-standard.md`
- `research/tool-catalog-200-candidate-map-2026-09-23.md`
- `research/catalog-prioritization-v1-2026-09-23.md`
- `research/free-scale-monetization-stress-test-2026-09-23.md`

Current architecture hypothesis is static/PWA + TypeScript + browser APIs + workers + lazy WASM + tiny optional sync backend.

# Lane ownership

You exclusively own:

- `docs/architecture/lane-05-tool-factory-architecture.md`
- `docs/architecture/lane-05-test-seams-and-acceptance.md`
- optional diagrams/spec artifacts under `docs/architecture/lane-05-*`
- your response file

Do not modify shared canonical docs or production source.

# Required work

1. Validate or challenge the current stack hypothesis. Prefer native browser/stdlib and minimal dependencies.
2. Design the module boundaries:
   - app shell;
   - tool registry/manifest;
   - tool runtime;
   - Work Profile;
   - pack registry;
   - search/command palette;
   - context handoff;
   - local persistence;
   - optional account/sync;
   - analytics/feedback;
   - ad boundary if ever enabled.
3. Define a concrete tool contract/schema suitable for 200–500 tools:
   - metadata;
   - input/output;
   - capabilities;
   - maintenance class;
   - privacy class;
   - lazy dependencies;
   - tests/oracles;
   - pack membership;
   - Work Profile fields;
   - offline support.
4. Design the Tool Factory:
   - scaffolding/generator if justified;
   - shared primitive engines;
   - catalog generation;
   - CI gates;
   - Gold certification;
   - browser/mobile matrix;
   - dependency/license checks;
   - bundle/perf budgets;
   - accessibility gates;
   - regression/sabotage proof where meaningful.
5. Decide how many engines/primitives should underpin the first 40 tools. Try to reduce duplication.
6. Define TDD seams in advance as required by the DStack TDD skill. Candidate seams may include:
   - tool manifest validation;
   - pure tool execution;
   - Work Profile default injection;
   - pack resolution;
   - context handoff;
   - local persistence;
   - lazy loading.
   Challenge these if the public interfaces should differ.
7. Define independent correctness-oracle strategy by tool class.
8. Define security/privacy boundaries for local vs remote vs AI tools.
9. Define large-file/mobile/WASM failure behavior and cancellation.
10. Define hosting/build strategy and how catalog growth avoids initial-bundle growth.
11. Produce a proposed **future ticket DAG outline** only as architecture guidance. Do not create actual ticket files yet; the integrated next wave will run `plan-tickets` after all research responses are reconciled.
12. Identify architecture decisions that still require owner choice before implementation.

# Constraints and non-goals

- No production implementation.
- No speculative microservice architecture.
- No new dependency unless the report justifies why browser/native/installed options fail.
- No server-side path for ordinary deterministic tools.
- No per-use LLM dependency for core tools.
- Do not over-generalize into a plugin framework unless 200-tool scale truly requires it.
- Preserve low-ops/full-free feasibility.

# Verification

- Architecture must explicitly support the 200-tool candidate map.
- First-40 primitive mapping must show reuse rather than 40 isolated implementations.
- Test seams must be public-behavior seams, not internals.
- Include at least one failure-mode table covering mobile, memory, unsupported API, large file, corrupt input, stale data and sync failure.
- Include a dependency/YAGNI review.
- `git diff --check`.
- Commit only lane-owned paths + response if committing.

# Response file

Final filesystem action:

`/Users/domenico/Code/StrumentiUtili.it/tasks/prompt2prompt/20260923-160415-strumentiutili-product-definition-wave/lane-05-engineering-architecture/05-tool-factory-engineering-architecture.response.md`

# Prompt2Prompt Response

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer; start at 1 and increment every time the same prompt is continued>
Response-Covers-Through: <current lane git commit, or N/A when no git commit exists>
Updated-At: <ISO-8601 timestamp with timezone>
Prompt: tasks/prompt2prompt/20260923-160415-strumentiutili-product-definition-wave/lane-05-engineering-architecture/05-tool-factory-engineering-architecture.prompt.md
Lane: lane-05-engineering-architecture

## Result
What is now true.

## Changes
Files changed, commits created, runtime/config mutations, and anything deliberately left untouched.

## Verification
Exact commands/checks and their results.

## Conflicts or blockers
Concurrent edits, unavailable dependencies/hosts, ambiguous authority, or `None`.

## Residual work
Everything still required if status is PARTIAL/BLOCKED; `None` only when genuinely complete.

## Integration notes
Anything the main agent must preserve, merge, re-check, or clean up.

## Next exact action
The first concrete continuation step, or `None — lane complete`.
