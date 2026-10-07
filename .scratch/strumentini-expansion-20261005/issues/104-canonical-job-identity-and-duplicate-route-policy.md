# 104 — Canonical job identity and duplicate-route policy

**What to build:** Define a generated job-identity policy from intent, jobs, aliases, inputs/outputs and materially different defaults/results so shared engines can expose useful routes without SEO/catalog duplication.

**Traces to:** US-EXP-10; AC-10.1; DEC-EXP-01, DEC-EXP-07

**Constraints:** C-EXP-03; do not use popularity or route count as identity.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** code-architecture-review → plan-tickets → code-tdd

- [x] Equivalent intents without a material user-facing difference fail the policy.
- [x] Allowed same-engine routes document the different default/result/job.
- [x] Policy works on synthetic future manifests without publishing them.

**Verification:** Adversarial manifest fixtures for duplicate, alias-only and legitimate same-engine routes.

**Evidence (2026-10-06):** `src/tool-factory/job-identity.ts` evaluates normalized intent/jobs/aliases/input/output contracts and requires an explicit `job`, `default` or `result` difference for otherwise equivalent routes. `tests/tool-factory/job-identity.test.ts` passes 4/4 adversarial cases covering equivalent intent, alias-only duplication, legitimate same-engine routes and an unpublished synthetic future manifest; `npx tsc --noEmit` and scoped diff-check pass.
