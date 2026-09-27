<external-worker-contract>
You are an owner-launched external implementation worker in `/Users/domenico/Code/StrumentiUtili.it`. Execute Ticket 09 on shared `main`. Preserve concurrent work; own only paths listed below. No package/spec edits, branches, worktrees, or stashes. Final filesystem action is the response file.
</external-worker-contract>

# Mission

Implement **Ticket 09 — Native-first Image Resize Gold vertical**.

# Inputs / skills

Apply `code-implement`, `code-tdd`, `code-module-design`, `browser-performance-benchmark`, and security review for untrusted images.

Read:

- Ticket 09;
- `research/lanes/09-heavy-browser-dependency-spike.md`;
- `spikes/heavy-browser/image-pipeline/` as evidence only;
- image fixtures/oracles;
- Ticket 01 runtime/catalog pattern.

# Lane ownership

Own only:

- `src/engines/image/**`
- `src/tools/image-resize/**`
- `src/components/tools/image-resize/**`
- `src/pages/tools/image-resize.astro`
- `tests/image-resize*.test.ts`
- `scripts/gold/image-resize*.ts`
- `scripts/acceptance-image-resize.mjs`
- `quality/receipts/image-resize/**`
- `.scratch/strumentiutili-v1/issues/09-image-resize-gold-vertical.md`
- lane response

Package files are frozen. Use native browser APIs first. Do not add AVIF/WASM. Do not add `pica` unless it already exists at root (it does not); if native quality is insufficient, report that specific gap rather than editing shared deps.

# Required behavior

- local image picker; createImageBitmap/canvas native path;
- bounded resize/crop policy for JPEG/WebP and safe passthrough/handling as defined by evidence;
- independent output decode verifies dimensions and MIME/signature;
- explicit orientation and metadata policy; no blanket “all metadata removed” claim;
- decoded-pixel memory preflight, not compressed-byte-only heuristics;
- recoverable corrupt/unsupported/too-large errors;
- truthful progress/state and cancellation when work is perceptible;
- mobile Files/Photos path without drag/drop requirement;
- no remote fallback;
- lazy tool implementation and Gold receipt.

The ticket asks for actual iOS Safari/Android Chrome thresholds before Gold publication. If those physical/remote device environments are unavailable to this worker, do **not** fabricate Gold completion: complete all automatable work and report `PARTIAL + WAIT_FOR_EXTERNAL` or `ACCEPTANCE_ONLY` with exact remaining device acceptance.

# Verification

Synthetic image corpus, independent decode/signature checks, corrupt/large/cancel cases, browser memory receipt, LOCAL network assertion, lazy bundle proof, desktop browser matrix available locally, mobile viewport flow, existing Ticket 01 verification, typecheck/build/diff-check.

# Response file

`/Users/domenico/Code/StrumentiUtili.it/tasks/prompt2prompt/20260923-195900-strumentiutili-v1-parallel-frontier/lane-09-image-resize/09-image-resize-gold.response.md`

Use standard Prompt2Prompt terminal schema.


Required response headers:

`Status: COMPLETE | PARTIAL | BLOCKED`
`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`
`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
`Attempt: <positive integer>`
`Response-Covers-Through: <lane commit or exact covered HEAD>`
`Updated-At: <ISO-8601 timestamp with timezone>`
Then include Prompt and Lane, followed by sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.

