# Ticket 02 — Workbench / Work Profile / portability receipt

Status: PASS
Date: 2026-09-23
Base HEAD: 56aff12

## Behavior proven

- The root surface is **Your Tools**, with the catalog hidden until the user explicitly opens Add a tool.
- Installed tools and manual ordering persist through a versioned repository backed by native IndexedDB.
- A second in-memory persistence adapter exercises the same `get/put/delete` interface in public-seam tests.
- Rapid writes are serialized so later Workbench state cannot be overwritten by an earlier slower transaction.
- Storage denial/quota failure preserves the current session state and exposes a recoverable warning.
- Recent stores only `toolId`, `lastUsedAt`, and `useCount`; clear-history is available and task content is absent.
- Work Profile persists only the canonical safe fields and tool projection passes only manifest-declared fields.
- Profile provenance is visible in the Workbench and the existing Business Day operation proves Work Profile default versus explicit current-task override.
- Export contains exactly versioned installed tools, packs, layout, safe profile, and preferences; Recent/task content is excluded.
- Import is strict-schema/version validated, previews before apply, rejects unknown content-bearing fields, and does not mutate state on invalid input.
- Add, remove, and reorder use native keyboard-operable controls; the browser acceptance executes add/reorder/remove from the keyboard.
- 390 px acceptance proves no horizontal overflow, 44 px visible button targets, and a mobile Tools/You hierarchy with Recent remaining inside Tools.
- No account/login/sync-status/server dependency was introduced.

## Verification

- `npx vitest run tests/persistence-workbench.test.ts tests/workbench-state.test.ts tests/profile-workbench.test.ts` — 10/10 PASS.
- `npm test` — 65/65 PASS.
- `npm run check` — 0 errors / 0 warnings / 0 hints.
- `npm run build` — PASS.
- `node scripts/acceptance-workbench.mjs` — PASS: IndexedDB reload, add/remove/reorder, Recent privacy, profile provenance/override, config export/import, storage denial, keyboard, 390 px.
- `npm run verify:ticket-01` — PASS, including Gold, sabotage, existing browser acceptance, and Cloudflare deploy dry-run.
- Focused strict TypeScript check for lane state/profile/persistence/portability modules — PASS.
- `git diff --check` — PASS.

## Scope discipline

No package file, global CSS, global command integration, account/sync module, server runtime, branch, worktree, or stash was added by this lane.
