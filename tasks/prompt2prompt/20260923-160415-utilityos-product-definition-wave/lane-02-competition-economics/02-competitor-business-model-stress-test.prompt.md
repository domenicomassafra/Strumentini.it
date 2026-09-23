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

Perform an aggressive **competitor, differentiation, economics, OSS and full-free business-model stress test** for UtilityOS.

The owner is explicitly open to the product being fully free forever for brand farming, optionally open source, and perhaps monetized only through restrained advertising/sponsors later. Determine whether that is strategically coherent and what the product must do differently from current utility sites/workspaces.

Use:

- `/Users/domenico/.dstack/.agents/skills/research-deep-research/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/research-primary-sources/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/research-last30days/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/marketing-agi/SKILL.md` — competitor teardown + positioning modules
- `/Users/domenico/.dstack/.agents/skills/marketing-growth/SKILL.md`

# Repository and current state

Repository: `/Users/domenico/Code/UtilityOS`

Read:

- `README.md`
- `docs/01-positioning-and-novelty.md`
- `docs/06-go-to-market.md`
- `research/competitive-brand-gtm-2026-09-23.md`
- `research/free-scale-monetization-stress-test-2026-09-23.md`
- `research/tool-catalog-200-candidate-map-2026-09-23.md`

# Lane ownership

You exclusively own:

- `research/lanes/02-competitor-business-model-stress-test.md`
- optional supporting matrices under `research/lanes/02-competitor-*`
- your adjacent response file

Do not edit shared canonical files or another lane's paths.

# Required work

1. Build a current 2026 landscape of at least 35 direct and adjacent products:
   - broad utility sites;
   - client-side/local-first toolboxes;
   - developer toolboxes;
   - freelancer/professional utility suites;
   - personalized workspaces/launchers;
   - installable command ecosystems;
   - open-source utility collections.
2. For the top 15 closest products, capture:
   - product thesis;
   - target;
   - tool count/coverage;
   - personalization;
   - onboarding;
   - packs/plugins;
   - shared context/profile;
   - local/server processing;
   - monetization;
   - OSS/license where applicable;
   - distribution;
   - strongest moat;
   - weakness relative to UtilityOS thesis.
3. Stress-test each claimed differentiator and label it:
   - already commodity;
   - partially occupied;
   - relatively open;
   - unproven.
4. Evaluate four economic models:
   - fully free / brand asset;
   - fully free + ads;
   - OSS + hosted free;
   - free core + optional paid sync/team/private packs.
5. Model qualitative economics and infra risk at meaningful traffic. Use official Cloudflare/Google/AdSense docs for normative claims.
6. Research current AdSense policy constraints for highly interactive utility pages and EEA consent burden.
7. Evaluate open-source licensing strategy options (MIT/Apache/AGPL or split surfaces) without making legal claims beyond source evidence.
8. Identify the most dangerous strategic failure modes:
   - SEO tool farm;
   - catalog maintenance explosion;
   - AI Search substitution;
   - no repeat usage;
   - cloneability;
   - privacy promise mismatch;
   - ad UX damage.
9. End with a recommended positioning/economic posture, but state what evidence could overturn it.

# Constraints and non-goals

- No application implementation.
- No branding/name generation; Lane 03 owns naming.
- Do not assume paid SaaS is the goal.
- Do not equate stars/traffic estimates with customer value unless sourced.
- Distinguish official product claims from third-party estimates.
- Use current primary docs for pricing/policy/platform limits.

# Verification

- At least 35 distinct products in the landscape.
- At least 15 detailed comparable rows.
- At least 10 first-party/primary sources.
- At least 5 recent community/product-launch sources.
- Explicit contradiction/gap round before final recommendations.
- `git diff --check`.
- If committing, stage only owned lane paths + response.

# Response file

Final filesystem action:

`/Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-02-competition-economics/02-competitor-business-model-stress-test.response.md`

# Prompt2Prompt Response

Status: COMPLETE | PARTIAL | BLOCKED
Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE
Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER
Attempt: <positive integer; start at 1 and increment every time the same prompt is continued>
Response-Covers-Through: <current lane git commit, or N/A when no git commit exists>
Updated-At: <ISO-8601 timestamp with timezone>
Prompt: tasks/prompt2prompt/20260923-160415-utilityos-product-definition-wave/lane-02-competition-economics/02-competitor-business-model-stress-test.prompt.md
Lane: lane-02-competition-economics

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

