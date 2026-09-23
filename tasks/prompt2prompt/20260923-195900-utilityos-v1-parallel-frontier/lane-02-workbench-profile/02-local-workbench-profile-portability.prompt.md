<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/UtilityOS`. Execute the lane completely; do not merely plan. Work on shared `main`, preserve concurrent edits, stage only lane-owned paths, and never create a branch/worktree/stash. Do not edit frozen shared package files or canonical product/spec authorities. Before ending for any reason, write the response file below as your final filesystem action. Chat reply only: `Risposta salvata in: <absolute-response-path>`.
</external-worker-contract>

# Mission

Implement **Ticket 02 — Local Workbench, Work Profile, and portable configuration** as a real vertical production slice on top of the completed Ticket 01 tracer.

# Required skills

Read and apply:

- `/Users/domenico/.dstack/.agents/skills/code-implement/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-tdd/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-module-design/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/plan-design-review/SKILL.md` where the workbench UX needs validation

# Inputs

Read in full:

- `.scratch/utilityos-v1/issues/02-local-workbench-profile-portability.md`
- `PRODUCT-SPEC.md`
- `DESIGN.md`
- `IMPLEMENTATION-PLAN.md`
- current Ticket 01 production seams under `src/runtime/`, `src/catalog/`, `src/pages/`, `src/components/`
- `design/lane-04/UX-BLUEPRINT.md` sections for Your Tools / Recent / Work Profile / mobile

# Lane ownership

Own only:

- `src/workbench/**`
- `src/persistence/**`
- `src/profile/**`
- `src/components/workbench/**`
- `src/pages/index.astro`
- `tests/workbench*.test.ts`
- `tests/persistence*.test.ts`
- `tests/profile-workbench*.test.ts`
- `scripts/acceptance-workbench.mjs`
- `quality/receipts/workbench/**`
- `.scratch/utilityos-v1/issues/02-local-workbench-profile-portability.md`
- this lane's response file

Do not edit:

- `src/layouts/BaseLayout.astro` (Ticket 03 owns global command integration)
- `src/styles/global.css`
- `package.json`, `package-lock.json`
- other ticket files

Use component-local CSS modules or lane-owned styles.

# Required work

Implement all Ticket 02 acceptance criteria, including:

- Your Tools as the primary root surface, not a catalog/card wall;
- installed tool state and manual order through a versioned persistence **interface**;
- IndexedDB adapter plus a second in-memory adapter for real seam tests;
- storage denied/quota failure as recoverable state without destroying in-memory use;
- Recent storing only tool-level activity metadata, never raw task input/output/URLs/files;
- canonical safe Work Profile fields and visible provenance;
- explicit task overrides remain authoritative;
- add/remove/reorder keyboard operability;
- versioned config export containing only installed tools, packs if present, order/layout, safe profile, preferences;
- import schema/version validation, preview, atomic apply, rollback/no mutation on malformed input;
- mobile/touch-complete Workbench hierarchy;
- no account/login/sync placeholders.

Native-first: implement IndexedDB directly unless measured repetition genuinely justifies a wrapper. Package files are frozen.

# TDD seams

Tests must exercise public behavior seams:

- persistence `get/put/delete` or the final deep equivalent;
- workbench state module;
- Work Profile resolution/edit seam;
- export/import module;
- real browser user behavior.

Use red→green vertical slices, not a speculative horizontal framework.

# Verification

At minimum:

- unit/integration tests for both persistence adapters;
- reload persistence browser proof;
- add/remove/reorder browser proof;
- Recent inspection proving task content absent;
- profile edit + use-site provenance proof;
- storage-denial/quota injected failure proof;
- export artifact inspection;
- invalid import leaves state unchanged;
- keyboard + 390px mobile acceptance;
- existing `npm run verify:ticket-01` remains green;
- `npm run check`, `npm run build`, `git diff --check` green.

Commit only lane-owned paths if cleanly possible.

# Response file

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-195900-utilityos-v1-parallel-frontier/lane-02-workbench-profile/02-local-workbench-profile-portability.response.md`

Required headers:

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer>
Response-Covers-Through: <lane commit or exact covered HEAD>
Updated-At: <ISO timestamp>
Prompt: tasks/prompt2prompt/20260923-195900-utilityos-v1-parallel-frontier/lane-02-workbench-profile/02-local-workbench-profile-portability.prompt.md
Lane: lane-02-workbench-profile

Then: Result / Changes / Verification / Conflicts or blockers / Residual work / Integration notes / Next exact action.

