<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/Strumentini.it`. Execute this lane on shared `main`. Preserve concurrent work, stage only owned paths, no branches/worktrees/stashes, no destructive git. Frozen package/spec files must remain untouched. Final filesystem action is the response file below; chat reply only with its absolute path.
</external-worker-contract>

# Mission

Implement **Ticket 03 — Deterministic Search, Command Palette, and compact Library** using catalog metadata only and without eager tool implementation loading.

# Required skills

Apply `code-implement`, `code-tdd`, `code-module-design`, and `plan-design-review` from `/Users/domenico/.dstack/.agents/skills/`.

# Inputs

Read:

- `.scratch/strumentini-v1/issues/03-search-library-command.md`
- `PRODUCT-SPEC.md`, `DESIGN.md`, `IMPLEMENTATION-PLAN.md`
- `src/catalog/manifest.ts`, `scripts/build-catalog.ts`, `src/runtime/registry.ts`
- lane-04 UX blueprint search/library/command sections

# Lane ownership

Own only:

- `src/search/**`
- `src/library/**`
- `src/components/search/**`
- `src/components/library/**`
- `src/pages/library.astro`
- `src/layouts/BaseLayout.astro`
- `tests/search*.test.ts`
- `tests/library*.test.ts`
- `scripts/acceptance-search-library.mjs`
- `quality/receipts/search-library/**`
- `.scratch/strumentini-v1/issues/03-search-library-command.md`
- this lane response

Do not edit `src/pages/index.astro` or Ticket 02 workbench paths. Do not edit global CSS; use lane-owned CSS modules/styles.

# Required work

- deterministic search metadata from generated catalog: name, aliases, jobs/verbs, category, role/pack tags when present, input types, runtime;
- ranking order that can distinguish installed/recent context when supplied but remains useful before Ticket 02 integration;
- global Cmd+K/Ctrl+K semantic combobox/listbox with arrow keys, Enter, Esc, focus restore;
- dense Library rows/facets, not card wall;
- URL-addressable query/filter state and back-navigation preservation;
- zero-result preserves query, suggests metadata-derived close intents only, and exposes Request this tool with no AI prose;
- explicit mobile Search destination;
- generated 500-tool fixture proving bounded/virtualized or paged DOM growth;
- search and Library must not load tool implementation chunks.

Design the search interface so Ticket 02 can later pass installed/recent context without a direct import from Workbench internals.

# Verification

- ranking fixtures;
- keyboard browser acceptance;
- focus restoration proof;
- 500-item bounded DOM/performance receipt;
- URL/back-state browser proof;
- production network/chunk proof: search/library fetch no tool implementation before open;
- existing Ticket 01 verification green;
- typecheck/build/diff-check green.

# Response file

`/Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20260923-195900-strumentini-v1-parallel-frontier/lane-03-search-library/03-search-library-command.response.md`

Use the full standard Prompt2Prompt headers and sections described by the wave coordinator.


Required response headers:

`Status: COMPLETE | PARTIAL | BLOCKED`
`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`
`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
`Attempt: <positive integer>`
`Response-Covers-Through: <lane commit or exact covered HEAD>`
`Updated-At: <ISO-8601 timestamp with timezone>`
Then include Prompt and Lane, followed by sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.

