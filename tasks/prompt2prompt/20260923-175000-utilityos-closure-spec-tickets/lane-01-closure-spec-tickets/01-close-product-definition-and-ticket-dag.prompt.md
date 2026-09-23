<external-worker-contract>
You are an owner-launched external coding worker operating directly inside the repository named below. Execute the assigned lane; do not merely describe how to do it.

Authority: explicit owner requirements and repository-local instructions outrank this prompt. Inspect current state before editing and use the available tools directly.

Ownership: this is the single-writer integration lane for final product-definition/spec/ticket authorities. Preserve unrelated concurrent work. Never revert another worker. Do not overwrite an actively dirty file without first identifying whether it belongs to another running lane.

Engineering: solve root causes, prefer the smallest complete design, validate every completion claim with runnable evidence, distinguish observed truth from assumptions, and preserve falsification criteria rather than smoothing over inconvenient evidence.

Git safety: stay on the current intended branch. No force push, destructive reset/clean, hidden stash, or unrequested worktree/branch creation.

Completion: before ending this turn for ANY reason, create or refresh the response file named below as your final filesystem action. It must truthfully declare COMPLETE, PARTIAL, or BLOCKED; continuation state; stop reason; attempt number; exact branch commit covered; changes; verification; conflicts; blockers; residual work; and next exact action. A time/context boundary is normally PARTIAL + CONTINUE_NOW, not BLOCKED.

Chat: after the response file is saved, reply only: Risposta salvata in: <absolute-response-path>
</external-worker-contract>

# Mission

**Close UtilityOS product definition completely and convert it into a backlog-ready, implementation-ready ticket DAG.**

This is the owner integration lane between research/design and implementation.

Do not write production application code in this lane.

# Required DStack / Matt Pocock skills

Read and apply these as executable process guidance, in this order where applicable:

1. `/Users/domenico/.dstack/.agents/skills/business-office-hours/SKILL.md`
   - use its forcing-question logic to pressure-test the final premise using evidence already gathered;
   - do not invent new user answers; resolve from evidence where possible and label unresolved assumptions.

2. `/Users/domenico/.dstack/.agents/skills/plan-backlog-spec/SKILL.md`
   - use it to turn the reconciled thesis into a durable backlog-ready spec.

3. `/Users/domenico/.dstack/.agents/skills/plan-ceo-review/SKILL.md`
   - apply product/scope review and challenge anything that is not necessary for the first falsifiable product.

4. `/Users/domenico/.dstack/.agents/skills/plan-design-review/SKILL.md`
   - review the lane-04 design against product goals, scale, accessibility and anti-slop constraints.

5. `/Users/domenico/.dstack/.agents/skills/plan-eng-review/SKILL.md`
   - lock architecture, data flow, edge cases, performance, privacy and test boundaries.

6. `/Users/domenico/.dstack/.agents/skills/plan-tickets/SKILL.md`
   - produce tracer-bullet vertical slices with explicit blockers, 100% requirement coverage, zero orphan scope, inherited constraints and DAG validation.

Read for downstream compatibility, but do not execute production implementation:

- `/Users/domenico/.dstack/.agents/skills/code-implement/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-tdd/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/code-module-design/SKILL.md`

# Repository

`/Users/domenico/Code/UtilityOS`

Expected branch: `main`

# Hard dependency gate

Before doing integration work, verify that the original product-definition wave has all five terminal responses:

`tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/`

Required:

- lane 01 response — terminal
- lane 02 response — terminal
- lane 03 response — terminal
- lane 04 response — terminal
- lane 05 response — terminal

For lane 04 also verify its declared design artifacts actually exist.

If lane 04 is still missing:

- **do not recreate, duplicate, or impersonate lane 04**;
- write this lane's response as `BLOCKED / WAIT_FOR_EXTERNAL / EXTERNAL_DEPENDENCY`;
- state the exact missing path(s);
- make no canonical spec/ticket edits;
- stop.

This protects the original design worker from a same-lane collision.

# Inputs to ingest in full

At minimum read:

- `README.md`
- `ROADMAP.md`
- `HANDOFF.md`
- `docs/00-product-vision.md`
- `docs/01-positioning-and-novelty.md`
- `docs/02-architecture-hypothesis.md`
- `docs/03-onboarding-profile-and-packs.md`
- `docs/04-decision-history.md`
- `docs/05-brand-positioning.md`
- `docs/06-go-to-market.md`
- `docs/07-tool-factory-quality-standard.md`
- `docs/08-product-definition-pre-design-synthesis.md`
- `docs/architecture/lane-05-tool-factory-architecture.md`
- `docs/architecture/lane-05-test-seams-and-acceptance.md`
- lane 01 demand report + response
- lane 02 competitor/economics report + response
- lane 03 brand/GTM report + name screen + response
- lane 04 UX/design artifacts + response
- lane 05 architecture response
- `research/tool-catalog-200-candidate-map-2026-09-23.md`
- `research/catalog-prioritization-v1-2026-09-23.md`
- `research/free-scale-monetization-stress-test-2026-09-23.md`
- `research/platform-decision-spike-2026-09-23.md`

# Owner intent to preserve

The owner wants:

- a genuinely comprehensive product, potentially hundreds of tools;
- tools that actually work well, not an SEO farm;
- use of abundant AI/token capacity up front to improve evidence, testing and quality;
- low recurring infra and token costs;
- full-free/open-source/brand-asset strategy to remain viable;
- ads only if they later make strategic sense;
- a product for knowledge workers / independent professionals rather than an Italy-only fiscal site;
- role-aware onboarding and editable personal tool selection;
- a large catalog hidden behind a calm relevant personal surface;
- no false DONE claims.

# Reconciliation rules

Do not average conflicting findings.

For each contradiction:

1. identify the claims and their evidence;
2. decide whether one source is stronger;
3. if still unresolved, encode it as a product hypothesis/experiment rather than pretending it is settled.

Critical tension to preserve:

> Lane 01 did **not** establish broad generic demand for a persistent utility workspace.

Therefore the first product must be designed to **test/falsify** workspace retention rather than assuming it.

Also preserve:

- catalog breadth is supply, not positioning;
- tool count/free/privacy/packs/workflows are not unique by themselves;
- UtilityOS is codename-only;
- no public brand is selected yet;
- deterministic local-first normal path;
- no normal-path LLM requirement;
- no runtime executable plugin marketplace in v1;
- Gold-quality gates before catalog-size claims.

# Required canonical artifacts

Create or update the following authorities.

## 1. `PRODUCT-SPEC.md`

This becomes the implementation source of truth.

Use stable IDs:

- `C-XX` — constitution/non-negotiable constraints
- `DEC-XX` — implementation/product decisions
- `US-XX` — user stories
- `AC-XX.Y` — acceptance criteria
- `EXP-XX` — falsification/validation experiments

Minimum content:

- problem and target;
- explicit non-goals;
- first wedge(s);
- product surface;
- onboarding;
- Your Tools;
- Library;
- Packs;
- Work Profile;
- search/command behavior;
- individual tool experience;
- local/privacy contract;
- context handoff;
- portability;
- anonymous use;
- optional sync boundary;
- Gold quality;
- accessibility;
- desktop/mobile;
- performance;
- analytics events needed only to test hypotheses;
- business-model posture;
- public-brand unresolved status;
- first implementation scope;
- later/not-v1 scope;
- failure/stop rules.

Every acceptance criterion must be objectively verifiable.

## 2. `DESIGN.md`

Integrate lane 04's accepted design into a canonical design source of truth.

Preserve:

- chosen UX direction and why;
- desktop + mobile IA;
- onboarding sequence;
- shell/navigation;
- Your Tools / Recent / Library / Packs / Work Profile;
- search/command surface;
- individual tool anatomy;
- states/errors/empty/loading;
- accessibility;
- responsive behavior;
- design-system primitives;
- visual anti-patterns;
- ad boundary;
- any prototype evidence.

Do not invent visual decisions absent from lane 04; mark unresolved ones.

## 3. `PRODUCT-MARKETING-CONTEXT.md`

Synthesize durable:

- product;
- audiences;
- jobs;
- pains;
- alternatives;
- differentiation;
- objections/anti-fit;
- proof;
- brand voice;
- acquisition/activation/retention model;
- full-free/OSS posture;
- public-name status.

Keep naming candidates as research, not final brand.

## 4. `IMPLEMENTATION-PLAN.md`

Turn lane 05 architecture + final design into the actual implementation plan.

Resolve or explicitly gate:

- browser floor;
- shell technology;
- build tool;
- runtime schema strategy;
- parser/codec dependency spikes;
- v1 account/sync scope;
- v1 analytics posture;
- PWA/offline promise.

Apply native-first/YAGNI logic.

Include:

- module boundaries;
- data/control flows;
- first tracer tool;
- first shared primitive engines;
- TDD seams;
- privacy/network gates;
- bundle/lazy-loading strategy;
- failure handling;
- Gold pipeline;
- deployment shape;
- rollback/safety.

# First implementation scope

Do not mechanically build the old Wave A 40 just because it was previously drafted.

Reconcile market evidence with engineering leverage.

Choose a **small Gold vertical set** that simultaneously:

1. proves the shell/runtime/manifest architecture;
2. exercises Work Profile reuse;
3. creates visibly different role packs;
4. includes at least one real-file/data job;
5. tests whether the workspace beats one-off search;
6. can be implemented and certified without regulatory/live-data complexity.

Target roughly 8–15 initial public Gold tools unless the integrated evidence strongly justifies another number.

The 200+ catalog remains planned supply, not first-implementation scope.

# plan-tickets output

After the canonical artifacts pass review, apply `plan-tickets`.

Use local ticket files under:

`.scratch/utilityos-v1/issues/`

One file per ticket:

`NN-slug.md`

Each ticket must include:

- What to build
- Traces to
- Constraints
- Blocked by
- Status: ready-for-agent
- Acceptance criteria
- Verification

Rules:

- tracer-bullet vertical slices;
- each ticket fits one fresh context window;
- each complete ticket is independently demoable/verifiable;
- prefactoring only when it makes the next vertical slice smaller;
- wide refactors use expand-contract;
- 100% `US/AC` coverage;
- zero orphan tickets;
- valid DAG;
- at least one unblocked frontier ticket;
- no implementation snippets unless they encode an approved decision better than prose.

Also create:

`.scratch/utilityos-v1/TICKET-DAG.md`

containing:

- ticket list;
- blocker graph;
- current unblocked frontier;
- which tickets can safely run in parallel;
- integration/verification gates;
- which ticket should be the first tracer bullet and why.

# Review gates

Before declaring COMPLETE:

## Product/CEO gate

Challenge:

- is first scope too broad?
- does every v1 feature prove a hypothesis or enable a required tool?
- are we building a workspace before proving anyone wants one?
- can anything be removed without weakening validation?

## Design gate

Verify:

- no wall of hundreds of cards;
- mobile is first-class;
- keyboard accessibility;
- onboarding questions actually change behavior;
- Work Profile reuse is visible;
- user can reach a tool without signup;
- large catalog remains discoverable;
- no generic AI/SaaS visual slop.

## Engineering gate

Verify:

- no tool code in initial bundle by default;
- local tools cannot accidentally use network adapters;
- TDD seams are public behavior seams;
- first tools reuse engines;
- context handoff is typed and indirect;
- dependency count remains justified;
- heavy capabilities are lazy;
- no premature plugin marketplace;
- zero backend dependency for ordinary deterministic execution.

# No implementation in this lane

Do NOT:

- scaffold the production app;
- install frontend dependencies;
- implement tools;
- deploy;
- create an implementation Prompt2Prompt wave.

Why:

The Prompt2Prompt workflow requires the next dependent wave to be generated **after this response is ingested**, so the implementation prompts reflect the actual approved ticket frontier rather than a speculative plan.

# Verification

Before completion:

1. run `git diff --check`;
2. validate that all required canonical files exist;
3. validate all `US-XX`, `AC-XX.Y`, `DEC-XX`, `C-XX` references used by tickets resolve;
4. prove every AC is covered by at least one ticket;
5. prove every ticket traces to an approved ID;
6. validate blocker graph is acyclic;
7. prove at least one ticket is unblocked;
8. list the unblocked frontier explicitly;
9. verify no lane-04 artifacts were overwritten except through intentional canonical synthesis into DESIGN.md;
10. commit the closure artifacts and local tickets to `main` if the repository state permits it without touching unrelated active work;
11. run `git status --short --branch` and report exact state.

# Completion definition

COMPLETE means:

- all five research/design lanes were ingested;
- product contradictions were reconciled or explicitly converted into experiments;
- PRODUCT-SPEC.md exists and is acceptance-testable;
- DESIGN.md exists;
- PRODUCT-MARKETING-CONTEXT.md exists;
- IMPLEMENTATION-PLAN.md exists;
- plan review gates are complete;
- ticket files exist;
- traceability coverage is 100%;
- dependency DAG is valid;
- implementation frontier is explicit;
- no production application code was prematurely added.

# Response file

Final filesystem action:

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-175000-utilityos-closure-spec-tickets/lane-01-closure-spec-tickets/01-close-product-definition-and-ticket-dag.response.md`

Use exactly:

# Prompt2Prompt Response

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer>
Response-Covers-Through: <current lane git commit, or N/A>
Updated-At: <ISO-8601 timestamp with timezone>
Prompt: tasks/prompt2prompt/20260923-175000-utilityos-closure-spec-tickets/lane-01-closure-spec-tickets/01-close-product-definition-and-ticket-dag.prompt.md
Lane: lane-01-closure-spec-tickets

## Result
What is now true.

## Changes
Files changed, commits created, runtime/config mutations, and anything deliberately left untouched.

## Verification
Exact commands/checks and their observed results.

## Conflicts or blockers
Concurrent edits, unavailable dependency, missing lane, ambiguous authority, or `None`.

## Residual work
Everything still required if PARTIAL/BLOCKED; `None` only when genuinely complete.

## Integration notes
What the owner/main agent must preserve before generating the implementation wave.

## Next exact action
The first concrete continuation step, or `None — closure complete; generate implementation Prompt2Prompt wave from the unblocked ticket frontier`.
