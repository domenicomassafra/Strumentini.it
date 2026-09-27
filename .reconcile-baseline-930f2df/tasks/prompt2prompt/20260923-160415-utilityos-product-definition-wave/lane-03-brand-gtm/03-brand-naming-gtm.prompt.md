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

Create a **brand, naming and go-to-market research package** for the product currently codenamed UtilityOS.

The public name is NOT UtilityOS. The product may be free/open source and should build a strong developer/product brand. The brand must work internationally and not lock the project to freelancers, developers, Italy, AI, or a specific current feature.

Use:

- `/Users/domenico/.dstack/.agents/skills/marketing-product-context/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/marketing-agi/SKILL.md` — positioning, competitor, launch modules
- `/Users/domenico/.dstack/.agents/skills/marketing-growth/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/research-deep-research/SKILL.md`

# Repository and current state

Repository: `/Users/domenico/Code/UtilityOS`

Read:

- `README.md`
- `docs/00-product-vision.md`
- `docs/05-brand-positioning.md`
- `docs/06-go-to-market.md`
- `research/competitive-brand-gtm-2026-09-23.md`

Known constraint: UtilityOS is externally collided and is codename-only.

# Lane ownership

You exclusively own:

- `research/lanes/03-brand-naming-gtm.md`
- `research/lanes/03-name-screen.csv`
- optional additional `research/lanes/03-brand-*` artifacts
- your response file

Do not edit the shared brand docs; this lane supplies evidence for later integration.

# Required work

1. Build a durable `PRODUCT-MARKETING-CONTEXT` equivalent inside your lane report:
   - product;
   - audiences;
   - jobs;
   - pains;
   - alternatives;
   - differentiation;
   - objections;
   - anti-fit;
   - proof points;
   - brand voice;
   - business/brand objective.
2. Generate at least 50 public-name candidates across several naming territories:
   - invented/abstract;
   - metaphorical;
   - short compound only where truly strong;
   - names evoking readiness, small jobs, workbench, precision, calm utility, personal fit.
3. Avoid obvious `Tool/Kit/Box/OS/AI/Work` clichés unless a candidate is exceptionally strong.
4. Perform initial collision screening for every serious candidate:
   - exact web;
   - domain availability/usage;
   - GitHub;
   - npm/PyPI where relevant;
   - App Store/Play Store search where practical;
   - EUIPO/USPTO/UKIPO or other first-pass trademark databases where accessible.
5. Produce a top 8–12 shortlist with:
   - pronunciation;
   - meaning/territory;
   - collision risk;
   - domain path;
   - visual/logo potential;
   - international fit;
   - likely confusion.
6. Do NOT claim legal clearance. Label the exercise as preliminary screening.
7. Build 3 differentiated positioning territories and score them using the Marketing AGI discipline. Include:
   - hero;
   - subhead;
   - proof points;
   - CTA;
   - why this beats "200+ tools";
   - what type of user each territory attracts.
8. Design the launch/growth loop:
   - individual tool acquisition;
   - role/pack pages;
   - shareable packs;
   - OSS/GitHub;
   - community distribution;
   - Product Hunt/HN viability;
   - newsletter/content only where justified.
9. Include a brand-risk section: what would make the project look like an SEO tool farm or AI-slop site?

# Constraints and non-goals

- No final legal trademark opinion.
- No public brand selection on behalf of the owner; recommend a shortlist.
- No app implementation.
- No logo production required; describe visual territories only.
- No invented customer testimonials or usage metrics.
- Full-free/open-source must remain a first-class strategy.

# Verification

- >=50 generated candidates.
- >=20 candidates receive explicit collision notes.
- >=8 shortlisted names receive deeper screening.
- 3 positioning territories are materially different, not superficial wording changes.
- Current sources cited with dates.
- `git diff --check`.
- Commit only lane-owned paths + response if committing.

# Response file

Final filesystem action:

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-03-brand-gtm/03-brand-naming-gtm.response.md`

# Prompt2Prompt Response

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer; start at 1 and increment every time the same prompt is continued>
Response-Covers-Through: <current lane git commit, or N/A when no git commit exists>
Updated-At: <ISO-8601 timestamp with timezone>
Prompt: tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-03-brand-gtm/03-brand-naming-gtm.prompt.md
Lane: lane-03-brand-gtm

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

