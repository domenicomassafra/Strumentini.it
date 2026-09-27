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

Define the **best product UX/UI shape** for UtilityOS before implementation.

The key problem is not drawing a prettier 200-card toolbox. The product must make a huge catalog feel personal, calm, fast and obvious, with onboarding-generated tools, professional packs, a personal workspace and full-library discovery.

Use the DStack design skills as executable guidance:

- `/Users/domenico/.dstack/.agents/skills/design-consultation/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/design-system/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/plan-design-review/SKILL.md`
- use `design-impeccable` principles only for any prototype surface you actually create

Research current competitor UI/UX before designing. Inspect ToopTools, SolveKit, TinyWow, Raycast, Setapp, smarterfaster, IT-Tools-class sites and strong non-toolbox workspace patterns.

# Repository and current state

Repository: `/Users/domenico/Code/UtilityOS`

Read:

- `docs/00-product-vision.md`
- `docs/03-onboarding-profile-and-packs.md`
- `docs/05-brand-positioning.md`
- `research/competitive-brand-gtm-2026-09-23.md`
- `research/tool-catalog-200-candidate-map-2026-09-23.md`

# Lane ownership

You exclusively own:

- `design/lane-04/UX-BLUEPRINT.md`
- `design/lane-04/DESIGN-SYSTEM-CANDIDATE.md`
- optional self-contained prototypes under `design/lane-04/prototypes/`
- optional research screenshots/reference notes under `design/lane-04/references/`
- your response file

Do not edit root/shared canonical docs or implement production code.

# Required work

1. Perform a competitor UX teardown focused on:
   - first impression;
   - catalog discovery;
   - search/command palette;
   - favorites/personal workspace;
   - onboarding;
   - pack/plugin discovery;
   - tool page anatomy;
   - mobile behavior;
   - trust/privacy presentation;
   - ads and clutter.
2. Define the product information architecture for:
   - anonymous visitor;
   - first-run onboarding;
   - signed-in/synced user;
   - Your Tools;
   - Recent;
   - Library;
   - Packs;
   - Work Profile;
   - search/command palette;
   - individual tool page;
   - mobile.
3. Produce 3 materially different UX concepts, for example:
   - dashboard/workbench;
   - command-first;
   - object/input-first.
   These are examples, not mandatory. Choose better directions if research supports them.
4. Stress-test all 3 against a 200–500-tool catalog.
5. Recommend one direction and explain tradeoffs.
6. Define first-run onboarding screens and exactly which questions deserve to exist.
7. Define how recommendations explain "why this tool is in your workspace" without becoming AI slop.
8. Define the full tool-page anatomy including:
   - task;
   - inputs;
   - outputs;
   - Work Profile defaults;
   - privacy/runtime badge;
   - related tools/handoff;
   - add/remove;
   - documentation/methodology;
   - ads policy if any.
9. Define desktop and mobile hierarchy.
10. Create a candidate design system:
   - typography hierarchy;
   - spacing;
   - density;
   - icon approach;
   - component inventory;
   - states;
   - accessibility;
   - motion restraint;
   - visual territories consistent with "quiet utility".
11. If useful, create one or more static HTML prototypes in your owned prototype directory. They must be clearly labeled non-production.

# Constraints and non-goals

- No production application code.
- No generic SaaS gradient/slop.
- No literal toolbox/wrench design as the default.
- Do not hide 200 tools behind an unusable mega-menu.
- Avoid AI-first UI unless research proves it improves the task.
- Anonymous first value must remain possible.
- Mobile is not an afterthought.
- Accessible keyboard operation is a product requirement.

# Verification

- At least 8 competitor/product UX references.
- 3 genuinely distinct design concepts.
- Explicit desktop + mobile treatment.
- Explicit 200–500-tool scale stress test.
- If HTML prototype exists, open/test it locally and record proof.
- `git diff --check`.
- Commit only lane-owned paths + response if committing.

# Response file

Final filesystem action:

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-04-product-design/04-product-ux-design-blueprint.response.md`

# Prompt2Prompt Response

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer; start at 1 and increment every time the same prompt is continued>
Response-Covers-Through: <current lane git commit, or N/A when no git commit exists>
Updated-At: <ISO-8601 timestamp with timezone>
Prompt: tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-04-product-design/04-product-ux-design-blueprint.prompt.md
Lane: lane-04-product-design

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

