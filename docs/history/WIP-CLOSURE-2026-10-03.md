# Strumentini.it — WIP closure record

Date: **2026-10-03**

This record explains what happened to the old branches, worktrees, stashes, prompt waves and orphaned commits so a future maintainer does not recreate them by accident.

## Active Git state at closure

- `main` was the only local branch.
- `origin/main` was the only remote branch (`git ls-remote --heads origin`).
- Local `main` and `origin/main` were aligned at `aaa0c7f` before the closure commit.
- One worktree only: `/Users/domenico/Code/Strumentini.it`.
- No stash.
- Historical utilityos/worker branches had already been merged into `main` or deleted.

The old WIP therefore did **not** exist as active branches anymore. The remaining confusion came from stale coordination documents and unreachable Git objects.

## Historical coordination material

The following are retained as provenance only:

- `.scratch/strumentini-v1/`
- `tasks/prompt2prompt/`
- `docs/history/2026-10-01-MEGA-HANDOFF.md`

They now carry explicit historical/superseded markers. Current authority is `PROJECT-STATUS.md`, `HANDOFF.md`, `ROADMAP.md` and the generated certification index.

## Orphaned commit review

`git fsck --no-reflogs --unreachable` found old dropped-stash/amend objects plus several normal commits no longer named by a branch.

Known normal commits reviewed during closure:

| Commit | Historical intent | Disposition |
|---|---|---|
| `6b38f43` | pre-amend checkpoint | obsolete/superseded; no archive ref added |
| `71c1432` | cross-family browser acceptance hardening | mostly superseded but retained as an explicit archive tag for traceability |
| `173ab004` → `c7188eee` | bounded 200-tool catalog/performance architecture + refreshed receipts | unique design/code remained outside `main`; retained through the child archive tag |
| `2936ebd` | expanded accessibility hardening | unique/superseded mix; retained as an archive tag for selective future comparison |

Archive tags created:

- `archive/2026-09-24-performance-wip` → `c7188eee` (includes parent `173ab004`)
- `archive/2026-09-24-a11y-wip` → `2936ebd`
- `archive/2026-09-24-browser-acceptance-wip` → `71c1432`

These tags are **archives, not development branches**. Do not branch from them wholesale or cherry-pick the full commits blindly: current `main` has evolved substantially since September 24. Any useful idea must be ported selectively onto current code and then pass current certification/evidence rules.

## Performance receipt correction

`quality/receipts/catalog-performance.json` was tracked on `main`, but the receipt named generated files such as `search-catalog.ts`, `workbench-catalog.ts`, `runtime-tool-index.ts`, `handoff-catalog.ts` and source `src/engines/table/io.ts` that are not present in current `main` history. Those files came from the orphaned performance WIP.

The receipt was therefore archived as:

`docs/history/2026-09-24-catalog-performance-wip-receipt.json`

It is historical evidence of an experiment, not a current PASS claim. A future performance tranche must generate a fresh receipt from the source actually committed to `main`.

## What may still be worth porting later

The performance archive contains ideas that should be reassessed against current `main`, not treated as already accepted architecture:

- small generated catalog projections for search / Workbench / runtime / handoff;
- lazy loading of search and Workbench metadata;
- runtime module caching;
- separation of table file I/O from CSV parsing/operations;
- stronger initial-route bundle/performance gates.

The accessibility archive contains additional focus, announcement, semantic-state and shared-control hardening. Much of the current design system has since evolved, so only missing behavior should be ported.

## Garbage collection policy

No forced history rewrite, force-push or immediate `git gc --prune=now` is required for project closure. Meaningful orphaned normal commits are now named by archive tags; obsolete dropped-stash objects can expire through normal Git garbage collection. This avoids destroying recoverability merely for cosmetic object-store cleanup.

## Closure rule going forward

There is one active development line: `main`. New experimental work must either land on `main`, be explicitly closed, or be archived with a clearly named `archive/` tag plus a note here. Do not leave unnamed WIP commits as pseudo-backups.

## 2026-10-04 reconciliation addendum

The archive refs were re-audited after the full redesign/backend/auth tranche landed. They remain historical references only, not work to resume. The current `main` already contains the useful catalog projections, lazy search/runtime loading, registry caching, performance checks, command-palette focus restoration, mobile overflow checks and current cross-family/browser acceptance equivalents. Library/Workbench-specific deltas target surfaces that were deliberately retired by the redesign. Remaining source differences are not accepted WIP and must not be cherry-picked merely to make the archive commits disappear.

The active Git state was rechecked again: one `main` worktree, no local WIP branch and no stash. Product work still listed in `ROADMAP.md` (the certification frontier and physical-device evidence) is roadmap/release work, not abandoned Git WIP.
