<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/StrumentiUtili.it`. Execute Ticket 08 on shared `main`, preserve concurrent changes, stage only lane-owned paths, and do not touch frozen package/spec files. No branches/worktrees/stashes. Save the response file as the final filesystem action.
</external-worker-contract>

# Mission

Implement **Ticket 08 — Text/list and research-reference Gold family**: T11 List Compare/Dedupe, T12 Text Diff, T13 DOI/ISBN Normalizer.

# Inputs / skills

Apply `code-implement`, `code-tdd`, `code-module-design`.

Read:

- Ticket 08 file;
- `spikes/core-engines/src/lists.ts` and promotion ledger;
- fixtures `list-set-ops`, `text-diff`, `doi`, `isbn`, Unicode/line-ending fixtures;
- current runtime/catalog/Gold tracer conventions.

# Lane ownership

Own only:

- `src/engines/text-list/**`
- `src/engines/research-reference/**`
- `src/tools/list-compare/**`
- `src/tools/text-diff/**`
- `src/tools/doi-isbn-normalizer/**`
- corresponding `src/components/tools/.../**`
- routes for those three tools under `src/pages/tools/`
- `tests/text-list*.test.ts`, `tests/research-reference*.test.ts`
- `scripts/gold/text-research*.ts`
- `scripts/acceptance-text-research.mjs`
- `quality/receipts/text-research/**`
- `.scratch/strumentiutili-v1/issues/08-text-list-research-gold-family.md`
- lane response

No package-file edits. Start from proven dependency-free core behavior.

# Required behavior

- explicit normalization/equality modes for list compare/dedupe;
- deterministic intersection/difference/dedupe with Unicode/line-ending fixtures and valid algebraic properties;
- preserve the existing LCS safety guard; if large diff needs alternative behavior, make it bounded and explicit rather than silently removing protection;
- diff additions/removals have text/symbol semantics, not color only;
- DOI normalize/validate only deterministic DOI syntax rules the project can defend;
- ISBN-10/13 normalization + check-digit validation from independent fixtures;
- never invent bibliographic metadata or fetch remote metadata;
- three independently searchable/openable manifests that share deep modules;
- methodology copy says exactly what is and is not normalized;
- all three LOCAL + Gold.

# Verification

Literal fixtures + properties, large-diff guard, non-color accessibility browser acceptance, keyboard/mobile flows, zero task-content network, Gold per tool, bundle proof of shared primitive reuse, existing Ticket 01 verification, typecheck/build/diff-check.

# Response file

`/Users/domenico/Code/StrumentiUtili.it/tasks/prompt2prompt/20260923-195900-strumentiutili-v1-parallel-frontier/lane-08-text-research/08-text-list-research-gold-family.response.md`

Use standard Prompt2Prompt terminal schema.


Required response headers:

`Status: COMPLETE | PARTIAL | BLOCKED`
`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`
`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
`Attempt: <positive integer>`
`Response-Covers-Through: <lane commit or exact covered HEAD>`
`Updated-At: <ISO-8601 timestamp with timezone>`
Then include Prompt and Lane, followed by sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.

