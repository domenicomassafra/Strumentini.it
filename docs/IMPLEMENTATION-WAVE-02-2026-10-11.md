# Strumentini.it — implementation wave 02

**Implementation stage only. Not a production release, Gold promotion or backlog closure.**

Baseline: `72b9312`. Scope: continued implementation after the first independently verified local wave. Four native Chat On Steroids lanes were allocated. The original #332 worker could not resume; a replacement agent was assigned a new, non-overlapping account-sync write set. Other lanes own #337, #335 and #408. The coordinator owns the #345 navigation/privacy slice. Original tickets, previous refusals and dated release evidence remain authoritative.

## Changes and what is actually demonstrated

| Ticket | Implementation | Proof / scope boundary |
|---|---|---|
| #337 | A bounded, explicit, same-origin, one-shot PDF-output to PDF→images cross-tab transfer. Receiver obtains a native File from already verified bytes with no server upload, persistence or automatic conversion. | Only an explicitly audited PDF→images consumer pair is eligible; 64 MiB maximum, 30-second expiry, UUID capability, strict origin/source and consumed-once checks. The generic manifest handoff declarations have **not** been widened to pretend this works for every tool. Focused protocol and browser acceptance are required for closure. |
| #335 | Source-validated suggestions from real tool manifests **and** published Astro routes, gated by actual detected MIME/type, with no fabricated CSV/Office action. | Candidate recognition and suggested operation are separate: unknown/bogus/unsupported content yields no fake links, and bytes are not forwarded by a suggestion. Mobile/touch and browser acceptance are separate from synthetic tests. |
| #345 | Replaced homepage recent cards sourced from the old last-value cache with the canonical, bounded workbench completion metadata. | Focused tests and real Chromium: reload, browser history/back, verified catalog deep links, no result-value text, no injected filenames/URL arguments, 390px. Full general-purpose task/URL/query/expired-handoff state recovery is **not** claimed. |
| #408 | Independent offline consumers for actual file outputs: PDF, PNG, CSV, DOCX, XLSX and WAV. | Consumer reopening must prove real producer bytes, strict MIME/magic, truncation and untrusted-file refusal; use only installed dependencies. External desktop Word/Excel and physical audio fidelity remain NOT_RUN. |
| #332 | Account favorites add/remove reconciliation after offline/conflicting clients. | No stale local favorite may silently resurrect a server deletion. Backend migration/protocol and cross-client acceptance remain gated until the replacement worker supplies source-bound proof. |

### #332 bounded integration readback

The implementation now includes `worker/migrations/0003_favorite_sync.sql` after existing Google migration `0002`: atomic revision/CAS events, per-tool tombstones, legacy table compatibility and bounded retained event history, plus authenticated `/api/favorites/sync` GET/POST and persistent device/account baseline. First login adopts server authority (including empty account) rather than automatically publishing pre-login defaults. Legacy blind add of unknown tools for pre-migration accounts returns 409 rather than risk reviving an unrecorded old deletion. Simulated independent clients and real disposable Wrangler/D1 passed **20 focused tests** and **130 auth acceptance assertions**. **NOT_RUN:** two authorized physical browser/account profiles, schema-first staging migration, migration rollback and release canary. The migration must be admitted **before** the new Worker code; it has NOT been deployed.

## Preserved release gates

- No real Cloudflare provider login or credentials, Worker deployment, D1 production migration, remote CI/push, paid service or real-file upload.
- #115/#117 annual legal/tax primary sources, #237 irreversible PDF redaction attacks, original #277/#278/#280/#281 physical mobile tests, designer selection #352 and historical release receipt drift remain open.
- A test run may validate a narrow feature without marking the whole ticket complete. A localhost Chromium viewport does not establish physical iOS/Android parity.
- This wave does not modify prior Gold receipts and does not refresh them merely because source code changed.

## Coordinator verification

The scoped test and browser evidence for each implemented lane is tracked in its `tests/*335*`, `*337*`, `*345*`, `*408*`, and `*332*` files and the native agent handoffs. Run `npm test`, `npm run check`, `npm run build`, `npm run tickets:check`, and source-only release checks after the write sets stabilize; record any failure transparently. No deploy is authorized by a local PASS.

- Scoped suite: **25/25** across #335/#337/#345/#408 before D1 integration tests; #332 20/20 focused with related auth/recent regression tests; #408 **8/8**, six offline consumer files genuinely reopened.
- Initial full Vitest before refreshing *derived index only*: 1,865/1,866 passed, with one fail-closed stale inventory test. The index was then regenerated **only for newly discovered test-file references**; explicit diff analysis proved **no Gold eligible-count or tool status change** (257 GOLD, 255 eligible before and after). No original per-tool Gold receipts or release/canary receipts were rewritten.
- Final `npm test`: **244/244 test files, 1,866/1,866 tests PASS**. Final `npm run check`: **0 Astro/TS errors across 1,970 files**, 22 preexisting deprecated API hints.
- Final `npm run build`: **PASS**, 291 static pages, 290 unique metadata pages and 284 sitemap entries; build inspection PASS, 681 JS assets and 8,144 B of initial route JS. Source build is not a deployment.
- Non-writing `scripts/validate-release.ts --no-write-receipt` reports **BLOCKED, 0 errors and 8 release blockers**: browser evidence source stale, Gold receipt missing/not Gold/source stale, two physical-device evidence missing, rollback source stale, and dirty source tree. These are deliberately not overridden by build/test success.
- `#337` real browser positive producer-to-consumer scenario works with a verified merged PDF and no manual reselect, but the isolated harness reports a separate resource GET 404; record as *positive user flow observed*, not full green browser acceptance.
